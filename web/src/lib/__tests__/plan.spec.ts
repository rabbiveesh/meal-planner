import { describe, expect, it } from 'vitest'
import type { MealOption, SlotDef } from '@/core'
import {
  cellDisplay,
  conflictsFor,
  groupOptions,
  isView,
  slotsFor,
  viewLabel,
  weekOf,
} from '../plan'

const slot = (id: string, view: SlotDef['view'], days: number[]): SlotDef => ({
  id,
  name: id,
  view,
  days,
})

describe('plan helpers', () => {
  it('knows the three views', () => {
    expect(isView('home')).toBe(true)
    expect(isView('takeAlong')).toBe(true)
    expect(isView('nope')).toBe(false)
    expect(viewLabel('breakfast')).toBe('Breakfast')
  })

  it('splits the rotation into weeks A and B', () => {
    expect(weekOf(0)).toBe(0)
    expect(weekOf(6)).toBe(0)
    expect(weekOf(7)).toBe(1)
    expect(weekOf(13)).toBe(1)
  })

  it('picks the slots of one chart, and of one weekday in week B', () => {
    const slots = [
      slot('main', 'home', [0, 1, 2, 3, 4]),
      slot('lunch', 'takeAlong', [0, 1, 2, 3, 4, 5]),
      slot('friday', 'home', [5]),
    ]
    expect(slotsFor(slots, 'home').map((s) => s.id)).toEqual(['main', 'friday'])
    expect(slotsFor(slots, 'home', 12).map((s) => s.id)).toEqual(['friday'])
    expect(slotsFor(slots, 'home', 8).map((s) => s.id)).toEqual(['main'])
  })

  it('keeps only a cell’s own conflicts', () => {
    const c = { day: 0, eater: 'A', message: 'm' }
    expect(
      conflictsFor(
        [
          { ...c, slotId: 'a' },
          { ...c, slotId: 'b' },
        ],
        'b',
      ),
    ).toHaveLength(1)
  })

  it('searches options and puts good fits first', () => {
    const options: MealOption[] = [
      { mealId: '1', name: 'Shawarma', warnings: [] },
      { mealId: '2', name: 'Pasta', warnings: ['Already planned 2 days away'] },
      { mealId: '3', name: 'Pasta bake', warnings: [] },
    ]
    const all = groupOptions(options, '')
    expect(all.fits.map((o) => o.mealId)).toEqual(['1', '3'])
    expect(all.warned.map((o) => o.mealId)).toEqual(['2'])
    const pasta = groupOptions(options, '  PASTA ')
    expect(pasta.fits.map((o) => o.mealId)).toEqual(['3'])
    expect(pasta.warned.map((o) => o.mealId)).toEqual(['2'])
  })

  it('shows the meal with its versions, or the special over a struck backup', () => {
    const meal = { name: 'Shawarma', kidsVersion: 'with pitas', adultsVersion: 'with rice' }
    expect(cellDisplay({}, meal, undefined)).toEqual({
      title: 'Shawarma',
      backup: null,
      versions: [
        { label: 'Kids', text: 'with pitas' },
        { label: 'Adults', text: 'with rice' },
      ],
    })
    expect(cellDisplay({ specialActive: true }, meal, { label: 'Shabbos leftovers' })).toEqual({
      title: 'Shabbos leftovers',
      backup: 'Shawarma',
      versions: [],
    })
    // A stale flag with no matching special day falls back to the meal.
    expect(cellDisplay({ specialActive: true }, meal, undefined).title).toBe('Shawarma')
    expect(cellDisplay(undefined, undefined, undefined).title).toBeNull()
  })
})
