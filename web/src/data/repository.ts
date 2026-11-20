// Reads and appends the household's change log through the storage module. Each change is
// its own entry (`changes:<id>`) and is never rewritten, so phones syncing later can't
// clobber each other: they only add entries. Backups are whole `AppData` files.
import { format, startOfWeek } from 'date-fns'
import type { Storage, Unwatch } from 'unstorage'

import { validate, type EntryChange } from '@/core'
import { getDeviceStorage, getStorage } from '@/storage'
import { migrate, migrateChange } from './migrations'
import {
  CHANGE_VERSION,
  DEFAULT_TOMORROW_FROM,
  SCHEMA_VERSION,
  type AppData,
  type StoredChange,
} from './schema'

const CHANGES = 'changes'
const DEVICE_ID = 'device-id'
/** Where versions of the app before the change log kept everything, as one item. */
const OLD_APP_DATA = 'app-data'

/** What a new household starts with, before any change. */
export function emptyData(today = new Date()): AppData {
  return {
    version: SCHEMA_VERSION,
    household: {
      eaters: [],
      slots: [],
      meals: [],
      rules: { freshDays: [], mainSlotId: '', specialDays: [] },
    },
    plan: { cells: [] },
    rotationStart: format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
    shopping: { staples: [], marks: {}, bought: [] },
    specialAnswers: {},
    notes: {},
    userName: '',
    tomorrowFrom: DEFAULT_TOMORROW_FROM,
  }
}

async function changesIn(storage: Storage): Promise<EntryChange[]> {
  const keys = await storage.getKeys(CHANGES)
  return (await storage.getItems(keys)).map((entry) => migrateChange(entry.value))
}

/**
 * Every change saved so far, in the current format: where the log is kept now, plus any
 * still on this phone waiting to move into the account. The same change may come twice.
 */
export async function loadChanges(): Promise<EntryChange[]> {
  const storage = getStorage()
  const phone = getDeviceStorage()
  const here = await changesIn(storage)
  return storage === phone ? here : [...here, ...(await changesIn(phone))]
}

/**
 * Calls `onAdded` with each change saved from now on, from this phone or another one.
 * Returns a function that stops watching.
 */
export async function watchChanges(onAdded: (change: EntryChange) => void): Promise<Unwatch> {
  const storage = getStorage()
  return storage.watch(async (event, key) => {
    if (event !== 'update' || !key.startsWith(`${CHANGES}:`)) return
    const stored = await storage.getItem(key)
    if (stored != null) onAdded(migrateChange(stored))
  })
}

const stored = (change: EntryChange) => ({
  key: `${CHANGES}:${change.id}`,
  value: JSON.parse(JSON.stringify({ v: CHANGE_VERSION, change } satisfies StoredChange)),
})

export async function appendChanges(changes: EntryChange[]): Promise<void> {
  if (changes.length) await getStorage().setItems(changes.map(stored))
}

/**
 * Moves the changes kept on this phone while signed out into the change log in use now
 * (the account, once signed in). The log only grows, so nothing already there is lost.
 * The phone's copy of a change is removed only once the account has confirmed it, so if
 * this is cut short (offline, the app closed) the rest moves next time.
 */
export async function moveChangesFromPhone(): Promise<void> {
  const phone = getDeviceStorage()
  if (getStorage() === phone) return
  const changes = await changesIn(phone)
  await appendChanges(changes)
  for (const change of changes) await phone.removeItem(`${CHANGES}:${change.id}`)
}

/** What an older version of the app saved on this phone as one item, if anything. */
export async function loadOldAppData(): Promise<AppData | null> {
  const raw = await getDeviceStorage().getItem(OLD_APP_DATA)
  return raw == null ? null : migrate(raw)
}

/** Forgets the older version's item, once its data is in the change log. */
export async function forgetOldAppData(): Promise<void> {
  await getDeviceStorage().removeItem(OLD_APP_DATA)
}

/** This phone's own id, which marks the changes made here. Made on first use. */
export async function deviceId(): Promise<string> {
  const storage = getDeviceStorage()
  const saved = await storage.getItem<string>(DEVICE_ID)
  if (saved) return saved
  const id = crypto.randomUUID()
  await storage.setItem(DEVICE_ID, id)
  return id
}

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

/** Parses a backup file, upgrading it if it came from an older version. */
export function importJson(text: string): AppData {
  const data = migrate(JSON.parse(text))
  // The Rust core owns the shape of households and plans; let it check them.
  validate(data.household, data.plan)
  return data
}
