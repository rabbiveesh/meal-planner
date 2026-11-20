// All persistence goes through this module. Facts about this phone alone (its device id,
// tonight's prep ticks) are kept in `getDeviceStorage()`, which is this phone's
// localStorage and never syncs. The household's data is an append-only change log kept in
// `getStorage()`: in the device storage while signed out, and once signed in in the
// Firestore collection of the plan in use (her own, or one she shares), so every phone
// signed in to it sees it. Tests swap in unstorage's
// memory driver.
import { createStorage, type Driver, type Storage } from 'unstorage'
import localStorageDriver from 'unstorage/drivers/localstorage'

import { getFirebase } from '@/firebase'
import firestoreDriver from './firestore'

const onThisPhone = () => localStorageDriver({ base: 'meal-planner' })

let deviceStorage: Storage = createStorage({ driver: onThisPhone() })
let storage: Storage = deviceStorage

/** Where the household's change log is kept right now. */
export function getStorage(): Storage {
  return storage
}

/** What belongs to this phone alone. */
export function getDeviceStorage(): Storage {
  return deviceStorage
}

/**
 * Swap where the change log is kept, e.g. the memory driver in tests (no driver). `own`
 * says whether it stands for her own plan (the default) or a shared one.
 */
export function useDriver(driver?: Driver, { own = true }: { own?: boolean } = {}): void {
  storage = createStorage(driver ? { driver } : {})
  ownPlan = own
}

/** Swap where this phone's own facts are kept, e.g. the memory driver in tests. */
export function useDeviceDriver(driver?: Driver): void {
  deviceStorage = createStorage(driver ? { driver } : {})
}

/** Keep the change log in the device storage: the signed-out place. */
export function usePhoneStorage(): void {
  storage = deviceStorage
  ownPlan = false
}

/**
 * A change log kept in the cloud, in one Firestore collection (a plan's entries). Entries
 * are only ever added, so each phone fetches an entry once and afterwards only what is new.
 */
export function cloudStorage(collection: string): Storage {
  return createStorage({
    driver: firestoreDriver({ firestore: getFirebase().db, collection, incremental: true }),
  })
}

let ownPlan = false

/**
 * Keep the change log in the cloud collection of the plan in use. `own` says it is her own
 * plan, which changes still on this phone are moving into.
 */
export function useCloudStorage(collection: string, { own }: { own: boolean }): void {
  storage = cloudStorage(collection)
  ownPlan = own
}

/** Whether the log in use is her own plan in the cloud, which this phone's changes join. */
export function inOwnPlan(): boolean {
  return storage !== deviceStorage && ownPlan
}
