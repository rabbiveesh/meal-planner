// The shape of what the app keeps. The household's data (`AppData`, generated from the Rust
// core) is never stored as such: it is the change log, which the core folds back into it.
// A backup file is `AppData` as it is.
import type { EntryChange } from '@/core'

export type { AppData, PantryMark, ShoppingState, StapleItem } from '@/core'

/** Bump this and add a step in migrations.ts whenever the backup file's shape changes. */
export const SCHEMA_VERSION = 5

/** Bump this and add a step in migrations.ts whenever the stored change format changes. */
export const CHANGE_VERSION = 1

/** When Today starts opening on tomorrow, unless she picks another time. */
export const DEFAULT_TOMORROW_FROM = '20:00'

/** One change as stored: its format version, so any version of the app can read it. */
export type StoredChange = { v: number; change: EntryChange }
