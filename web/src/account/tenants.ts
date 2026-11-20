// The plans a signed-in person can use: their own private plan, and shared plans they are
// a member of or invited to. A shared plan is a Firestore document listing who may use it
// (see firestore.rules); its change log is kept under it. Membership is access control,
// which the rules must read from one place, so it is a document that is updated, not part
// of the append-only change log.
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'

import { getFirebase } from '@/firebase'
import type { Account } from './index'

/** A plan someone can use, and who else uses it. */
export type Tenant = {
  /** 'private' for the person's own plan; otherwise the shared plan's id. */
  id: string
  name: string
  /** Who shared it, by account id. The private plan's owner is the person. */
  owner: string
  members: string[]
  /** Members' names, by account id, as they were when they joined. */
  names: Record<string, string>
  /** Emails invited to join and not yet answered. */
  invited: string[]
}

export const PRIVATE = 'private'

const TENANTS = 'tenants'

/** The person's own plan, kept apart from any shared one. */
export function privateTenant(account: Account): Tenant {
  return {
    id: PRIVATE,
    name: 'Just me',
    owner: account.uid,
    members: [account.uid],
    names: { [account.uid]: displayName(account) },
    invited: [],
  }
}

export function displayName(account: Account): string {
  return account.name ?? account.email ?? 'Someone'
}

/** Where a plan's change log is kept in Firestore. */
export function entriesPath(tenant: Tenant, account: Account): string {
  return tenant.id === PRIVATE ? `users/${account.uid}/entries` : `${TENANTS}/${tenant.id}/entries`
}

const normalEmail = (email: string) => email.trim().toLowerCase()

/**
 * Calls `onChange` with the shared plans the person is a member of, and those they are
 * invited to, now and whenever either changes. Returns a function that stops watching.
 */
export function watchTenants(
  account: Account,
  onChange: (tenants: { joined: Tenant[]; invites: Tenant[] }) => void,
  onError: (error: Error) => void,
): () => void {
  const { db } = getFirebase()
  const tenants = collection(db, TENANTS)
  let joined: Tenant[] | undefined
  let invites: Tenant[] = []
  const report = () => joined && onChange({ joined, invites })
  const read = (d: QueryDocumentSnapshot) => ({ ...(d.data() as Omit<Tenant, 'id'>), id: d.id })

  // Two queries, one per rule that lets the person read a plan.
  const stopJoined = onSnapshot(
    query(tenants, where('members', 'array-contains', account.uid)),
    (snapshot) => {
      joined = snapshot.docs.map(read)
      report()
    },
    onError,
  )
  const email = account.email ? normalEmail(account.email) : null
  const stopInvites = email
    ? onSnapshot(
        query(tenants, where('invited', 'array-contains', email)),
        (snapshot) => {
          invites = snapshot.docs.map(read).filter((t) => !t.members.includes(account.uid))
          report()
        },
        onError,
      )
    : () => {}
  return () => {
    stopJoined()
    stopInvites()
  }
}

/** Starts a new shared plan that only the person is in, yet. Returns its id. */
export async function createTenant(account: Account, name: string): Promise<string> {
  const created = await addDoc(collection(getFirebase().db, TENANTS), {
    name,
    owner: account.uid,
    members: [account.uid],
    names: { [account.uid]: displayName(account) },
    invited: [],
  } satisfies Omit<Tenant, 'id'>)
  return created.id
}

const tenantDoc = (id: string) => doc(getFirebase().db, TENANTS, id)

export async function invite(tenantId: string, email: string): Promise<void> {
  await updateDoc(tenantDoc(tenantId), { invited: arrayUnion(normalEmail(email)) })
}

export async function takeBackInvite(tenantId: string, email: string): Promise<void> {
  await updateDoc(tenantDoc(tenantId), { invited: arrayRemove(normalEmail(email)) })
}

export async function join(tenantId: string, account: Account): Promise<void> {
  await updateDoc(tenantDoc(tenantId), {
    members: arrayUnion(account.uid),
    [`names.${account.uid}`]: displayName(account),
    invited: arrayRemove(normalEmail(account.email ?? '')),
  })
}

export async function decline(tenantId: string, account: Account): Promise<void> {
  await updateDoc(tenantDoc(tenantId), { invited: arrayRemove(normalEmail(account.email ?? '')) })
}

/** Takes a member off a shared plan: themselves leaving, or the owner removing them. */
export async function removeMember(tenantId: string, uid: string): Promise<void> {
  await updateDoc(tenantDoc(tenantId), {
    members: arrayRemove(uid),
    [`names.${uid}`]: deleteField(),
  })
}
