// Reads and appends the household's change log through the storage module. Each change is
// its own entry (`changes:<id>`) and is never rewritten, so phones syncing later can't
// clobber each other: they only add entries. Backups are whole `AppData` files.
import { format, startOfWeek } from 'date-fns'
import type { Storage, Unwatch } from 'unstorage'

import { validate, type EntryChange } from '@/core'
import { getDeviceStorage, getStorage, inOwnPlan } from '@/storage'
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
  // A change can move off the phone between listing and reading it; it is elsewhere then.
  return (await storage.getItems(keys))
    .filter((entry) => entry.value != null)
    .map((entry) => migrateChange(entry.value))
}

/**
 * Every change saved so far, in the current format: where the log is kept now, plus, in her
 * own plan, any still on this phone waiting to move into it. The same change may come twice.
 */
export async function loadChanges(): Promise<EntryChange[]> {
  const here = await changesIn(getStorage())
  return inOwnPlan() ? [...here, ...(await changesIn(getDeviceStorage()))] : here
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
 * Moves the changes kept on this phone while signed out into `account` (her own plan in
 * the cloud). The log only grows, so nothing already there is lost. The phone's copy of a
 * change is removed only once the account has confirmed it, so if this is cut short
 * (offline, the app closed) the rest moves next time.
 */
export async function moveChangesFromPhone(account: Storage): Promise<void> {
  const phone = getDeviceStorage()
  if (account === phone) return
  const changes = await changesIn(phone)
  if (changes.length) await account.setItems(changes.map(stored))
  for (const change of changes) await phone.removeItem(`${CHANGES}:${change.id}`)
}

/** Copies every change in the log in use now into `target`, e.g. a newly shared plan. */
export async function copyChangesInto(target: Storage): Promise<void> {
  const changes = await loadChanges()
  if (changes.length) await target.setItems(changes.map(stored))
}

const MY_NAME = 'my-name'

/** The name this phone's person is greeted by, if they entered one here. */
export async function loadMyName(): Promise<string | null> {
  return getDeviceStorage().getItem<string>(MY_NAME)
}

export async function saveMyName(name: string): Promise<void> {
  await getDeviceStorage().setItem(MY_NAME, name)
}

const PLAN_CHOICE = 'plan'

/** Which plan this phone last showed for an account, if it has chosen one. */
export async function loadPlanChoice(uid: string): Promise<string | null> {
  return getDeviceStorage().getItem<string>(`${PLAN_CHOICE}:${uid}`)
}

export async function savePlanChoice(uid: string, planId: string): Promise<void> {
  await getDeviceStorage().setItem(`${PLAN_CHOICE}:${uid}`, planId)
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
