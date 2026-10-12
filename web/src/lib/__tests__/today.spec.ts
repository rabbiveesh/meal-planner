import { beforeEach, describe, expect, it } from 'vitest'

import type { Household, SlotDef } from '@/core'
import { importJson } from '@/data/repository'
import starter from '@/data/templates/starter.json'
import { useDriver } from '@/storage'
import {
  dateParam,
  loadPrepChecks,
  nextDay,
  savePrepChecks,
  shownDate,
  slotsOn,
  specialsThisWeek,
  upcomingSlot,
} from '../today'

const household: Household = importJson(JSON.stringify(starter)).household

const slot = (id: string, childTime?: string, adultTime?: string): SlotDef => ({
  id,
  name: id,
  view: 'home',
  days: [0],
  childTime,
  adultTime,
})

describe('today helpers', () => {
  it('reads the shown date from the address, falling back to today', () => {
    const today = new Date(2026, 9, 12, 9, 30)
    expect(shownDate('2026-10-21', today)).toEqual(new Date(2026, 9, 21))
    expect(dateParam(shownDate('2026-10-21', today))).toBe('2026-10-21')
    for (const bad of [undefined, '', 'tomorrow', '2026-13-45', ['2026-10-21']]) {
      expect(shownDate(bad, today)).toEqual(new Date(2026, 9, 12))
    }
  })

  it('wraps to the start of the rotation after the last day', () => {
    expect(nextDay(3)).toBe(4)
    expect(nextDay(13)).toBe(0)
  })

  it('lists only the slots planned on a weekday', () => {
    const friday = slotsOn(household, 12).map((s) => s.id)
    expect(friday).toContain('fridayLunch')
    expect(friday).not.toContain('main')
    expect(slotsOn(household, 6)).toEqual([])
  })

  it("maps this week's special days onto rotation days", () => {
    // Tuesday of week B (day 9): Sunday is day 7.
    expect(specialsThisWeek(household, 9).map((s) => [s.day, s.special.slotId])).toEqual([
      [7, 'lunch'],
      [8, 'lunch'],
      [10, 'light'],
    ])
  })

  it('asks about the coming week on Shabbos', () => {
    expect(specialsThisWeek(household, 13).map((s) => s.day)).toEqual([0, 1, 3])
    expect(specialsThisWeek(household, 6).map((s) => s.day)).toEqual([7, 8, 10])
  })

  it('skips special days whose slot no longer exists', () => {
    const h = { ...household, slots: household.slots.filter((s) => s.id !== 'light') }
    expect(specialsThisWeek(h, 0).map((s) => s.special.slotId)).toEqual(['lunch', 'lunch'])
  })

  it('picks the next slot someone still has to eat', () => {
    const slots = [
      slot('main', '15:00', '19:30'),
      slot('breakfast', '07:00'),
      slot('light', '18:00'),
    ]
    const at = (h: number, m = 0) => new Date(2026, 9, 12, h, m)
    expect(upcomingSlot(slots, at(6))?.id).toBe('breakfast')
    expect(upcomingSlot(slots, at(9))?.id).toBe('main')
    // The kids have eaten the main meal but the adults haven't.
    expect(upcomingSlot(slots, at(18, 30))?.id).toBe('main')
    expect(upcomingSlot(slots, at(21))?.id).toBe('main')
    expect(upcomingSlot([], at(9))).toBeUndefined()
  })

  describe('prep checks', () => {
    beforeEach(() => useDriver())

    it('remembers ticks for the same list only', async () => {
      expect(await loadPrepChecks('2026-10-12')).toEqual([])
      await savePrepChecks('2026-10-12', ['main:Take the chicken out'])
      expect(await loadPrepChecks('2026-10-12')).toEqual(['main:Take the chicken out'])
      expect(await loadPrepChecks('2026-10-13')).toEqual([])
    })
  })
})
