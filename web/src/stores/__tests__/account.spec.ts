import { createPinia, setActivePinia } from 'pinia'
import { createStorage, defineDriver, type Driver } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Account } from '@/account'
import type { Tenant } from '@/account/tenants'
import { importJson } from '@/data/repository'
import starter from '@/data/templates/starter.json'
import { getDeviceStorage, useDeviceDriver, usePhoneStorage } from '@/storage'
import { useAccountStore } from '@/stores/account'
import { useAppStore } from '@/stores/app'

/** Who sign-in says is signed in; the test calls it to sign in or out. */
let announce: (account: Account | null) => Promise<void> = async () => {}
vi.mock('@/account', () => ({
  watchAccount: (onChange: (account: Account | null) => Promise<void>) => {
    announce = onChange
    void onChange(null)
    return () => {}
  },
  signInWithGoogle: vi.fn<() => Promise<void>>(),
  signOutOfAccount: vi.fn<() => Promise<void>>(),
}))

/** The cloud, standing in for Firestore: one driver per collection. */
let collections: Record<string, Driver> = {}
const collectionDriver = (path: string) => (collections[path] ??= memoryDriver())
vi.mock('@/storage', async (actual) => {
  const storage = await actual<typeof import('@/storage')>()
  return {
    ...storage,
    cloudStorage: (path: string) => createStorage({ driver: collectionDriver(path) }),
    useCloudStorage: (path: string, options: { own: boolean }) =>
      storage.useDriver(collectionDriver(path), options),
  }
})

/** Shared plans in the cloud, standing in for the tenants collection and its rules. */
let shared: Record<string, Tenant> = {}
let listeners: Array<() => void> = []
const notify = () => listeners.forEach((l) => l())
vi.mock('@/account/tenants', async (actual) => {
  const real = await actual<typeof import('@/account/tenants')>()
  const update = (id: string, change: (t: Tenant) => Tenant) => {
    shared[id] = change(shared[id]!)
    notify()
  }
  return {
    ...real,
    watchTenants: (
      account: Account,
      onChange: (found: { joined: Tenant[]; invites: Tenant[] }) => void,
    ) => {
      const report = () =>
        onChange({
          joined: Object.values(shared).filter((t) => t.members.includes(account.uid)),
          invites: Object.values(shared).filter(
            (t) => !t.members.includes(account.uid) && t.invited.includes(account.email ?? ''),
          ),
        })
      listeners.push(report)
      report()
      return () => (listeners = listeners.filter((l) => l !== report))
    },
    createTenant: async (account: Account, name: string) => {
      const id = `t${Object.keys(shared).length + 1}`
      shared[id] = { ...real.privateTenant(account), id, name }
      notify()
      return id
    },
    invite: async (id: string, email: string) =>
      update(id, (t) => ({ ...t, invited: [...t.invited, email] })),
    takeBackInvite: async (id: string, email: string) =>
      update(id, (t) => ({ ...t, invited: t.invited.filter((e) => e !== email) })),
    join: async (id: string, account: Account) =>
      update(id, (t) => ({
        ...t,
        members: [...t.members, account.uid],
        invited: t.invited.filter((e) => e !== account.email),
      })),
    decline: async (id: string, account: Account) =>
      update(id, (t) => ({ ...t, invited: t.invited.filter((e) => e !== account.email) })),
    removeMember: async (id: string, uid: string) =>
      update(id, (t) => ({ ...t, members: t.members.filter((m) => m !== uid) })),
  }
})

/** A cloud that never confirms a write, like Firestore while the phone is offline. */
const offline = defineDriver(() => ({
  ...memoryDriver(),
  name: 'offline',
  setItem: () => new Promise<void>(() => {}),
}))

const me: Account = { uid: 'me', name: 'Me', email: 'me@example.com' }
const partner: Account = { uid: 'partner', name: 'Partner', email: 'partner@example.com' }
const meals = () => useAppStore().household.meals.map((m) => m.name)
const phoneChanges = () => getDeviceStorage().getKeys('changes')

/** A phone, signed out; with the starter meals unless `empty`. */
async function phone({ empty = false } = {}) {
  useDeviceDriver()
  usePhoneStorage()
  setActivePinia(createPinia())
  const account = useAccountStore()
  account.follow()
  const app = useAppStore()
  await vi.waitFor(() => expect(app.loaded).toBe(true))
  if (!empty) {
    app.replaceAll(importJson(JSON.stringify(starter)))
    await app.save()
  }
  return { app, account }
}

beforeEach(() => {
  collections = {}
  shared = {}
  listeners = []
})

describe('signing in', () => {
  it('brings what she made on this phone into her own plan', async () => {
    const { app } = await phone()
    const before = meals()
    await announce(me)
    await vi.waitFor(async () => expect(await phoneChanges()).toEqual([]))
    await app.load()
    expect(meals()).toEqual(before)
  })

  it('keeps showing what is on this phone while the account is offline', async () => {
    const { app } = await phone()
    const before = meals()
    collections['users/me/entries'] = offline()
    await announce(me)
    expect(app.loaded).toBe(true)
    expect(meals()).toEqual(before)
    // Nothing was confirmed, so the phone still has everything.
    expect((await phoneChanges()).length).toBeGreaterThan(0)
  })

  it('an edit made just before signing in ends up in her own plan', async () => {
    const { app } = await phone()
    app.setUserName('Typed just now')
    await announce(me)
    await vi.waitFor(async () => expect(await phoneChanges()).toEqual([]))
    await app.load()
    expect(app.data.userName).toBe('Typed just now')
  })

  it('signing out and in again still shows everything', async () => {
    const { app } = await phone()
    const before = meals()
    await announce(me)
    await vi.waitFor(async () => expect(await phoneChanges()).toEqual([]))
    await announce(null)
    expect(meals()).toEqual([])
    await announce(me)
    expect(app.loaded).toBe(true)
    expect(meals()).toEqual(before)
  })
})

describe('sharing a plan', () => {
  /** She signs in and shares her plan with the partner, who signs in on another phone. */
  async function sharedWithPartner() {
    const mine = await phone()
    await announce(me)
    await mine.account.share('Our family')
    await mine.account.invite(partner.email!)
    const theirs = await phone({ empty: true })
    await announce(partner)
    return { mine, theirs }
  }

  it('starts as a copy of her plan, and the app switches to it', async () => {
    const { app, account } = await phone()
    const before = meals()
    await announce(me)
    await account.share('Our family')
    expect(account.current?.name).toBe('Our family')
    expect(account.plans.map((p) => p.name)).toEqual(['Just me', 'Our family'])
    expect(meals()).toEqual(before)
    expect(app.loaded).toBe(true)
  })

  it('the invited person sees the invite, and after joining sees the same meals', async () => {
    const { mine, theirs } = await sharedWithPartner()
    expect(theirs.account.invites.map((p) => p.name)).toEqual(['Our family'])
    expect(meals()).toEqual([])

    await theirs.account.accept(theirs.account.invites[0]!)
    expect(theirs.account.invites).toEqual([])
    expect(theirs.account.current?.name).toBe('Our family')
    expect(theirs.app.household.meals.map((m) => m.name)).toEqual(
      mine.app.household.meals.map((m) => m.name),
    )
  })

  it('declining an invite leaves her in her own plan', async () => {
    const { theirs } = await sharedWithPartner()
    await theirs.account.decline(theirs.account.invites[0]!)
    expect(theirs.account.invites).toEqual([])
    expect(theirs.account.plans.map((p) => p.name)).toEqual(['Just me'])
  })

  it('her own plan stays as it was while the shared one changes', async () => {
    const { app, account } = await phone()
    await announce(me)
    await account.share('Our family')
    app.setUserName('Only in the shared plan')
    await app.save()
    await account.switchTo('private')
    expect(app.data.userName).toBe('')
    await account.switchTo(account.plans[1]!.id)
    expect(app.data.userName).toBe('Only in the shared plan')
  })

  it('the phone remembers which plan it showed last', async () => {
    const { account } = await phone()
    await announce(me)
    await account.share('Our family')
    await announce(null)
    await announce(me)
    expect(account.current?.name).toBe('Our family')
  })

  it('leaving a shared plan goes back to her own', async () => {
    const { theirs } = await sharedWithPartner()
    await theirs.account.accept(theirs.account.invites[0]!)
    await theirs.account.leave()
    expect(theirs.account.current?.name).toBe('Just me')
    expect(theirs.account.plans.map((p) => p.name)).toEqual(['Just me'])
  })

  it('someone taken off a shared plan is moved back to their own', async () => {
    const { mine, theirs } = await sharedWithPartner()
    await theirs.account.accept(theirs.account.invites[0]!)
    await mine.account.removeMember(partner.uid)
    await vi.waitFor(() => expect(theirs.account.current?.name).toBe('Just me'))
  })
})
