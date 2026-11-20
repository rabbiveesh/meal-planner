// @vitest-environment node
// Who may read and write what, checked against firestore.rules in the local emulator:
//   npm run test:emulator
// Skipped by a plain `vitest run`, which has no emulator to talk to.
import { readFileSync } from 'node:fs'

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  arrayRemove,
  arrayUnion,
  deleteField,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const host = process.env.FIRESTORE_EMULATOR_HOST

describe.runIf(host)('access rules', () => {
  let env: RulesTestEnvironment

  beforeAll(async () => {
    const [hostname, port] = (host ?? 'localhost:8080').split(':')
    env = await initializeTestEnvironment({
      projectId: 'demo-meal-planner-rules',
      firestore: {
        rules: readFileSync(new URL('../../../../firestore.rules', import.meta.url), 'utf8'),
        host: hostname,
        port: Number(port),
      },
    })
  })
  afterAll(() => env.cleanup())
  beforeEach(() => env.clearFirestore())

  const as = (uid: string, email = `${uid}@example.com`) =>
    env.authenticatedContext(uid, { email, email_verified: true }).firestore()
  const plan: {
    name: string
    owner: string
    members: string[]
    names: Record<string, string>
    invited: string[]
  } = {
    name: 'Our family',
    owner: 'owner',
    members: ['owner'],
    names: { owner: 'Owner' },
    invited: ['partner@example.com'],
  }

  /** A shared plan made by `owner`, with `partner` invited. */
  async function sharedPlan(extra: Partial<typeof plan> = {}) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'tenants/t'), { ...plan, ...extra })
      await setDoc(doc(ctx.firestore(), 'tenants/t/entries/e'), { key: 'e', value: '1' })
    })
  }

  describe('her own plan', () => {
    it('only she can read and write it', async () => {
      await assertSucceeds(setDoc(doc(as('me'), 'users/me/entries/e'), { value: 1 }))
      await assertFails(getDoc(doc(as('other'), 'users/me/entries/e')))
      await assertFails(setDoc(doc(as('other'), 'users/me/entries/x'), { value: 1 }))
    })
  })

  describe('a shared plan', () => {
    it('anyone signed in can start one with only themselves in it', async () => {
      const mine = { ...plan, invited: [] }
      await assertSucceeds(setDoc(doc(as('owner'), 'tenants/new'), mine))
      await assertFails(
        setDoc(doc(as('owner'), 'tenants/other'), { ...mine, members: ['owner', 'partner'] }),
      )
      await assertFails(setDoc(doc(as('someone'), 'tenants/third'), mine))
    })

    it('members can read and write its data; nobody else can', async () => {
      await sharedPlan({ members: ['owner', 'partner'], invited: [] })
      await assertSucceeds(getDoc(doc(as('partner'), 'tenants/t/entries/e')))
      await assertSucceeds(setDoc(doc(as('partner'), 'tenants/t/entries/x'), { value: 1 }))
      await assertFails(getDoc(doc(as('stranger'), 'tenants/t/entries/e')))
      await assertFails(setDoc(doc(as('stranger'), 'tenants/t/entries/y'), { value: 1 }))
    })

    it('someone invited can see the invite, but not the data until they join', async () => {
      await sharedPlan()
      await assertSucceeds(getDoc(doc(as('partner'), 'tenants/t')))
      await assertFails(getDoc(doc(as('partner'), 'tenants/t/entries/e')))
      await assertFails(getDoc(doc(as('stranger'), 'tenants/t')))
    })

    it('someone invited can join, adding only themselves', async () => {
      await sharedPlan()
      const partner = as('partner')
      await assertFails(
        updateDoc(doc(partner, 'tenants/t'), {
          members: arrayUnion('partner', 'friend'),
          invited: arrayRemove('partner@example.com'),
        }),
      )
      await assertSucceeds(
        updateDoc(doc(partner, 'tenants/t'), {
          members: arrayUnion('partner'),
          'names.partner': 'Partner',
          invited: arrayRemove('partner@example.com'),
        }),
      )
      await assertSucceeds(getDoc(doc(partner, 'tenants/t/entries/e')))
    })

    it('an email that is not verified does not count as invited', async () => {
      await sharedPlan()
      const unverified = env
        .authenticatedContext('partner', { email: 'partner@example.com', email_verified: false })
        .firestore()
      await assertFails(getDoc(doc(unverified, 'tenants/t')))
    })

    it('someone invited can decline, and that is all they can change', async () => {
      await sharedPlan()
      const partner = as('partner')
      await assertFails(
        updateDoc(doc(partner, 'tenants/t'), { invited: [], name: 'Renamed by a guest' }),
      )
      await assertSucceeds(
        updateDoc(doc(partner, 'tenants/t'), { invited: arrayRemove('partner@example.com') }),
      )
    })

    it("people find their own plans and invites, and nobody can list everyone else's", async () => {
      await sharedPlan()
      const tenants = (db: ReturnType<typeof as>) => collection(db, 'tenants')
      await assertSucceeds(
        getDocs(query(tenants(as('owner')), where('members', 'array-contains', 'owner'))),
      )
      await assertSucceeds(
        getDocs(
          query(tenants(as('partner')), where('invited', 'array-contains', 'partner@example.com')),
        ),
      )
      await assertFails(getDocs(tenants(as('stranger'))))
      await assertFails(
        getDocs(query(tenants(as('stranger')), where('members', 'array-contains', 'owner'))),
      )
    })

    it('someone not invited cannot join', async () => {
      await sharedPlan()
      await assertFails(
        updateDoc(doc(as('stranger'), 'tenants/t'), { members: arrayUnion('stranger') }),
      )
    })

    it('a member can leave, but cannot remove anyone else or change the plan', async () => {
      await sharedPlan({
        members: ['owner', 'partner', 'friend'],
        names: { owner: 'Owner', partner: 'Partner', friend: 'Friend' },
        invited: [],
      })
      const partner = as('partner')
      await assertFails(updateDoc(doc(partner, 'tenants/t'), { members: arrayRemove('friend') }))
      await assertFails(updateDoc(doc(partner, 'tenants/t'), { invited: ['x@example.com'] }))
      await assertSucceeds(
        updateDoc(doc(partner, 'tenants/t'), {
          members: arrayRemove('partner'),
          'names.partner': deleteField(),
        }),
      )
      await assertFails(getDoc(doc(partner, 'tenants/t/entries/e')))
    })

    it('the owner can invite and remove people, but not leave their own plan', async () => {
      await sharedPlan({ members: ['owner', 'partner'], invited: [] })
      const owner = as('owner')
      await assertSucceeds(
        updateDoc(doc(owner, 'tenants/t'), { invited: arrayUnion('x@example.com') }),
      )
      await assertSucceeds(updateDoc(doc(owner, 'tenants/t'), { members: arrayRemove('partner') }))
      await assertFails(updateDoc(doc(owner, 'tenants/t'), { members: arrayRemove('owner') }))
    })
  })
})
