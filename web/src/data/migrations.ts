import { omit } from 'es-toolkit'

import type { EntryChange } from '@/core'
import {
  CHANGE_VERSION,
  DEFAULT_TOMORROW_FROM,
  SCHEMA_VERSION,
  type AppData,
  type StoredChange,
} from './schema'

/**
 * One step per version: migrations[n] upgrades data (a backup file, or what older versions of
 * the app saved on the phone) from version n to n + 1.
 */
const migrations: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  // v2: special-day answers moved from plan cells (per rotation day) to dated answers.
  1: (data) => {
    const plan = data.plan as { cells: Array<Record<string, unknown>> }
    return {
      ...data,
      plan: { ...plan, cells: plan.cells.map((cell) => omit(cell, ['specialActive'])) },
      specialAnswers: {},
    }
  },
  // v3: her own notes on each day's meals.
  2: (data) => ({ ...data, notes: {} }),
  // v4: the name the welcome greets her by.
  3: (data) => ({ ...data, userName: '' }),
  // v5: the evening time from which Today opens on tomorrow.
  4: (data) => ({ ...data, tomorrowFrom: DEFAULT_TOMORROW_FROM }),
}

export class UnsupportedDataError extends Error {}

/** Upgrades data (a backup, or what an older app saved) of any known version to the current schema. */
export function migrate(raw: unknown): AppData {
  if (
    typeof raw !== 'object' ||
    raw === null ||
    typeof (raw as { version?: unknown }).version !== 'number'
  ) {
    throw new UnsupportedDataError('Saved data has no version number')
  }
  let data = raw as Record<string, unknown> & { version: number }
  if (data.version > SCHEMA_VERSION) {
    throw new UnsupportedDataError(
      `Saved data is from a newer version of the app (v${data.version}); please update the app`,
    )
  }
  while (data.version < SCHEMA_VERSION) {
    const step = migrations[data.version]
    if (!step) throw new UnsupportedDataError(`No migration from v${data.version}`)
    data = { ...step(data), version: data.version + 1 }
  }
  return data as unknown as AppData
}

/** One step per version: changeMigrations[n] upgrades a stored change from version n to n + 1. */
const changeMigrations: Record<
  number,
  (change: Record<string, unknown>) => Record<string, unknown>
> = {
  // None yet: v1 is the first version.
}

/** Upgrades one stored change of any known version to the current format. */
export function migrateChange(raw: unknown): EntryChange {
  const stored = raw as Partial<StoredChange> | null
  if (typeof stored?.v !== 'number' || typeof stored.change !== 'object') {
    throw new UnsupportedDataError('A saved change has no version number')
  }
  if (stored.v > CHANGE_VERSION) {
    throw new UnsupportedDataError(
      `Some changes were saved by a newer version of the app (v${stored.v}); please update the app`,
    )
  }
  let change = stored.change as unknown as Record<string, unknown>
  for (let v = stored.v; v < CHANGE_VERSION; v++) {
    const step = changeMigrations[v]
    if (!step) throw new UnsupportedDataError(`No migration from v${v}`)
    change = step(change)
  }
  return change as unknown as EntryChange
}
