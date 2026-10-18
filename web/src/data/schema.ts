import type { Household, Plan } from '@/core'

/** Bump this and add a step in migrations.ts whenever the stored shape changes. */
export const SCHEMA_VERSION = 4

/** When Today starts opening on tomorrow, unless she picks another time. */
export const DEFAULT_TOMORROW_FROM = '20:00'

/** An item on the user's own store master list (e.g. her Osher Ad list). */
export interface StapleItem {
  id: string
  name: string
  category: string
}

/** Pantry-check answer for one shopping item. */
export type PantryMark = 'have' | 'need'

export interface ShoppingState {
  staples: StapleItem[]
  /** Pantry-check answers, keyed by shopping item key (see lib/shopping.ts). */
  marks: Record<string, PantryMark>
  /** Keys ticked off in the store. */
  bought: string[]
}

export interface AppData {
  version: number
  household: Household
  plan: Plan
  /** yyyy-MM-dd of the Sunday that starts week A of the rotation. */
  rotationStart: string
  shopping: ShoppingState
  /**
   * Answers to the weekly special-day questions ("Any Shabbos leftovers?"), keyed by
   * `yyyy-MM-dd|slotId`. Kept by calendar date, not rotation day, so an answer applies to
   * that one date only. Missing means not asked yet.
   */
  specialAnswers: Record<string, boolean>
  /**
   * Her own notes on a meal ("plus vegetable soup for us"), keyed by `yyyy-MM-dd|slotId`.
   * Kept by calendar date, like special-day answers, so a note is about that one day.
   */
  notes: Record<string, string>
  /**
   * From this time of day (HH:mm), the Today screen opens on tomorrow: by evening, tomorrow's
   * meals are the ones she's preparing for.
   */
  tomorrowFrom: string
}
