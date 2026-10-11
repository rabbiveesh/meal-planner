import { format, startOfWeek } from 'date-fns'

import { getStorage } from '@/storage'
import { migrate } from './migrations'
import { SCHEMA_VERSION, type AppData } from './schema'

const KEY = 'app-data'

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
  }
}

/** Loads saved data, or null on first run. */
export async function loadAppData(): Promise<AppData | null> {
  const raw = await getStorage().getItem(KEY)
  return raw == null ? null : migrate(raw)
}

export async function saveAppData(data: AppData): Promise<void> {
  await getStorage().setItem(KEY, JSON.parse(JSON.stringify(data)))
}

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

/** Parses a backup file, upgrading it if it came from an older version. */
export function importJson(text: string): AppData {
  return migrate(JSON.parse(text))
}
