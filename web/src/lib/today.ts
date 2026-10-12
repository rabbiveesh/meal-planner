// UI helpers for the Today and Rescue screens: which slots and questions to show, and the
// remembered ticks on tonight's prep checklist. Planner rules stay in the Rust core.
import { format, isValid, parse, startOfDay } from 'date-fns'

import type { Household, SlotDef, SpecialDay } from '@/core'
import { getStorage } from '@/storage'
import { CYCLE_DAYS } from './rotation'

const SHABBOS = 6

/** The rotation day after `day`. */
export function nextDay(day: number): number {
  return (day + 1) % CYCLE_DAYS
}

/** How a shown date is written in the address, e.g. `2026-10-13`. */
const DATE_PARAM = 'yyyy-MM-dd'

/** The date named by `param` (as written by `dateParam`), or `today` when it names none. */
export function shownDate(param: unknown, today: Date): Date {
  const date = typeof param === 'string' ? parse(param, DATE_PARAM, today) : undefined
  return date && isValid(date) ? date : startOfDay(today)
}

export function dateParam(date: Date): string {
  return format(date, DATE_PARAM)
}

/** Slots planned on rotation day `day`, in the household's order. */
export function slotsOn(household: Household, day: number): SlotDef[] {
  return household.slots.filter((s) => s.days.includes(day % 7))
}

export interface WeekSpecial {
  /** Rotation day the question is about. */
  day: number
  special: SpecialDay
}

/**
 * The household's special days (Shabbos leftovers, Mom's supper...) in the current week,
 * Sunday to Friday. On Shabbos the questions are about the coming week.
 */
export function specialsThisWeek(household: Household, today: number): WeekSpecial[] {
  const weekday = today % 7
  const sunday = weekday === SHABBOS ? nextDay(today) : today - weekday
  return (household.rules?.specialDays ?? [])
    .filter((s) => s.day !== SHABBOS && household.slots.some((slot) => slot.id === s.slotId))
    .map((special) => ({ day: (sunday + special.day) % CYCLE_DAYS, special }))
    .sort((a, b) => a.special.day - b.special.day)
}

function minutes(time: string | undefined, ref: Date): number | undefined {
  if (!time) return undefined
  const t = parse(time, 'HH:mm', ref)
  return isValid(t) ? t.getHours() * 60 + t.getMinutes() : undefined
}

/**
 * The slot most likely to need rescuing at `now`: the first one (by time) that someone
 * still has to eat, or the one eaten last once they've all passed.
 */
export function upcomingSlot(slots: SlotDef[], now: Date): SlotDef | undefined {
  const timed = slots.map((slot) => {
    const times = [slot.childTime, slot.adultTime]
      .map((t) => minutes(t, now))
      .filter((m): m is number => m != null)
    return { slot, first: Math.min(...times), last: Math.max(...times) }
  })
  timed.sort((a, b) => a.first - b.first)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const latest = timed.reduce<(typeof timed)[number] | undefined>(
    (best, t) => (best && best.last >= t.last ? best : t),
    undefined,
  )
  return (timed.find((t) => t.last >= nowMinutes) ?? latest)?.slot
}

// --- Prep checklist ticks ---------------------------------------------------

const PREP_KEY = 'prep-checked'

interface PrepChecks {
  /** The list these ticks belong to, e.g. the date being prepped for. */
  list: string
  done: string[]
}

/** Ticked prep items for `list`; ticks from an older list are dropped. */
export async function loadPrepChecks(list: string): Promise<string[]> {
  const saved = await getStorage().getItem<PrepChecks>(PREP_KEY)
  return saved?.list === list ? saved.done : []
}

export async function savePrepChecks(list: string, done: string[]): Promise<void> {
  await getStorage().setItem<PrepChecks>(PREP_KEY, { list, done: [...done] })
}
