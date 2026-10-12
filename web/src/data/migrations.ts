import { omit } from 'es-toolkit'

import { SCHEMA_VERSION, type AppData } from './schema'

/** One step per version: migrations[n] upgrades data from version n to n + 1. */
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
}

export class UnsupportedDataError extends Error {}

/** Upgrades stored data of any known version to the current schema. */
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
