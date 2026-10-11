import { addDays, differenceInCalendarDays, parseISO } from 'date-fns'

export const CYCLE_DAYS = 14
export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Shabbos',
]

/** Which rotation day (0..13) a calendar date falls on. */
export function rotationDay(date: Date, rotationStart: string): number {
  const diff = differenceInCalendarDays(date, parseISO(rotationStart))
  return ((diff % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS
}

/** The next calendar date (today or later) that falls on rotation day `day`. */
export function nextDateFor(day: number, rotationStart: string, from = new Date()): Date {
  const ahead = (day - rotationDay(from, rotationStart) + CYCLE_DAYS) % CYCLE_DAYS
  return addDays(from, ahead)
}

export function dayLabel(day: number): string {
  return `${WEEKDAYS[day % 7]} ${day < 7 ? 'A' : 'B'}`
}

/** Rotation days Sunday through Friday of one week (0 = week A, 1 = week B). */
export function weekDays(week: 0 | 1): number[] {
  return [0, 1, 2, 3, 4, 5].map((d) => d + week * 7)
}
