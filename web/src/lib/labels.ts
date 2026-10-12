// Display names and colours for the core's enums, so every screen words them the same way.
import type { EaterKind, Kashrut, Prep } from '@/core'
import { WEEKDAYS } from './rotation'

export interface EnumLabel<T extends string> {
  value: T
  title: string
  color: string
  icon: string
}

export const KASHRUT_LABELS: readonly EnumLabel<Kashrut>[] = [
  { value: 'meat', title: 'Meat', color: 'red-darken-2', icon: 'mdi-food-drumstick' },
  { value: 'dairy', title: 'Dairy', color: 'blue-darken-2', icon: 'mdi-cup' },
  { value: 'parve', title: 'Parve', color: 'green-darken-2', icon: 'mdi-leaf' },
]

export const PREP_LABELS: readonly EnumLabel<Prep>[] = [
  { value: 'ahead', title: 'Made ahead', color: 'deep-purple', icon: 'mdi-pot-steam' },
  { value: 'fresh', title: 'Cook fresh', color: 'orange-darken-3', icon: 'mdi-chef-hat' },
  { value: 'instant', title: 'No prep', color: 'teal-darken-2', icon: 'mdi-lightning-bolt' },
]

export const EATER_KIND_LABELS: readonly EnumLabel<EaterKind>[] = [
  { value: 'adult', title: 'Adult', color: 'primary', icon: 'mdi-account' },
  { value: 'child', title: 'Child', color: 'secondary', icon: 'mdi-human-child' },
]

function find<T extends string>(labels: readonly EnumLabel<T>[], value: T): EnumLabel<T> {
  return labels.find((l) => l.value === value) ?? { value, title: value, color: 'grey', icon: '' }
}

export const kashrutLabel = (k: Kashrut) => find(KASHRUT_LABELS, k)
export const prepLabel = (p: Prep) => find(PREP_LABELS, p)
export const eaterKindLabel = (k: EaterKind) => find(EATER_KIND_LABELS, k)

/** "Sun", "Mon", ... and "Shabbos" for the weekday (0 = Sunday), for chips. */
export function shortWeekday(day: number): string {
  const name = WEEKDAYS[day % 7] ?? String(day)
  return day % 7 === 6 ? name : name.slice(0, 3)
}

/** "Sun, Tue" for a list of weekdays, or `none` when empty. */
export function weekdayList(days: readonly number[] | undefined, none: string): string {
  if (!days?.length) return none
  return [...days]
    .sort((a, b) => a - b)
    .map(shortWeekday)
    .join(', ')
}
