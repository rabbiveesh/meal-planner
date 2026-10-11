import type { Household, Plan } from '@/core'

/** Bump this and add a step in migrations.ts whenever the stored shape changes. */
export const SCHEMA_VERSION = 1

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
}
