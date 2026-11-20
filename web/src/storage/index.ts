// All persistence goes through this module. Facts about this phone alone (its device id,
// tonight's prep ticks) are kept in `getDeviceStorage()`, which is this phone's
// localStorage and never syncs. The household's data is an append-only change log kept in
// `getStorage()`: in the device storage while signed out, and in the signed-in user's own
// Firestore collection once signed in, so every phone sees it. Tests swap in unstorage's
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

/** Swap where the change log is kept, e.g. the memory driver in tests (no driver). */
export function useDriver(driver?: Driver): void {
  storage = createStorage(driver ? { driver } : {})
}

/** Swap where this phone's own facts are kept, e.g. the memory driver in tests. */
export function useDeviceDriver(driver?: Driver): void {
  deviceStorage = createStorage(driver ? { driver } : {})
}

/** Keep the change log in the device storage: the signed-out place. */
export function usePhoneStorage(): void {
  storage = deviceStorage
}

/**
 * Keep the change log in one signed-in user's own collection in the cloud. Entries are
 * only ever added, so each phone fetches an entry once and afterwards only what is new.
 */
export function useAccountStorage(uid: string): void {
  useDriver(
    firestoreDriver({
      firestore: getFirebase().db,
      collection: `users/${uid}/entries`,
      incremental: true,
    }),
  )
}
