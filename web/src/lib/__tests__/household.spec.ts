import { describe, expect, it } from 'vitest'

import type { Household } from '@/core'
import {
  cleanSlot,
  plannedSlots,
  mealsUsingSlot,
  move,
  planWithoutSlot,
  cleanFixedMeal,
  removeEater,
  removeMeal,
  removeSlot,
  upsert,
  withRules,
} from '../household'

const household = (): Household => ({
  eaters: [
    { id: 'a', name: 'Mom', kind: 'adult', waitHours: 6 },
    { id: 'b', name: 'Kid', kind: 'child' },
  ],
  slots: [
    { id: 'main', name: 'Main', view: 'home', days: [0, 1] },
    { id: 'lunch', name: 'Lunch', view: 'takeAlong', days: [0] },
  ],
  meals: [
    { id: 'm1', name: 'Soup', slots: ['main', 'lunch'], kashrut: 'meat', prep: 'ahead' },
    {
      id: 'm2',
      name: 'Stew',
      slots: ['main'],
      kashrut: 'meat',
      prep: 'ahead',
      leftoversFor: ['lunch'],
    },
  ],
  rules: {
    freshDays: [2],
    mainSlotId: 'main',
    specialDays: [
      { day: 0, slotId: 'lunch', label: 'Leftovers', question: 'Any?', kashrut: 'meat' },
    ],
    fixedMeals: [
      { day: 0, slotId: 'main', mealIds: ['m1', 'm2'] },
      { day: 1, slotId: 'lunch', mealIds: ['m1'] },
    ],
  },
})

describe('household editing', () => {
  it('upserts by id', () => {
    const list = [{ id: 'a', n: 1 }]
    expect(upsert(list, { id: 'a', n: 2 })).toEqual([{ id: 'a', n: 2 }])
    expect(upsert(list, { id: 'b', n: 3 })).toEqual([...list, { id: 'b', n: 3 }])
  })

  it('moves within bounds', () => {
    expect(move([1, 2, 3], 0, 1)).toEqual([2, 1, 3])
    expect(move([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
    expect(move([1, 2, 3], 2, 5)).toEqual([1, 2, 3])
  })

  it('treats blank times as nobody eating', () => {
    const s = cleanSlot({
      id: 's',
      name: ' Snack ',
      view: 'home',
      adultTime: '',
      childTime: '16:00',
      days: [3, 1, 1],
    })
    expect(s).toMatchObject({ name: 'Snack', childTime: '16:00', days: [1, 3] })
    expect(s.adultTime).toBeUndefined()
  })

  it('keeps hand-written slots out of the planned ones', () => {
    const notes = cleanSlot({ id: 'n', name: 'Chedva', view: 'home', days: [0], handWritten: true })
    expect(notes.handWritten).toBe(true)
    const slots = [...household().slots, notes]
    expect(plannedSlots(slots).map((s) => s.id)).toEqual(household().slots.map((s) => s.id))
  })

  it('merges rules', () => {
    expect(withRules(household(), { freshDays: [1] }).rules).toMatchObject({
      freshDays: [1],
      mainSlotId: 'main',
    })
  })

  it('removes an eater', () => {
    expect(removeEater(household(), 'a').eaters.map((e) => e.id)).toEqual(['b'])
  })

  it('removes a slot and every reference to it', () => {
    const h = household()
    expect(mealsUsingSlot(h, 'lunch')).toBe(2)
    const next = removeSlot(h, 'lunch')
    expect(next.slots.map((s) => s.id)).toEqual(['main'])
    expect(next.meals.map((m) => m.slots)).toEqual([['main'], ['main']])
    expect(next.meals[1]!.leftoversFor).toEqual([])
    expect(next.rules?.specialDays).toEqual([])
    expect(next.rules?.fixedMeals?.map((f) => f.slotId)).toEqual(['main'])
    expect(next.rules?.mainSlotId).toBe('main')
    expect(removeSlot(h, 'main').rules?.mainSlotId).toBe('')
    // The input is untouched.
    expect(h.slots).toHaveLength(2)
  })

  it('removes a meal from the every-week rules, dropping rules left empty', () => {
    const next = removeMeal(household(), 'm1')
    expect(next.meals.map((m) => m.id)).toEqual(['m2'])
    expect(next.rules?.fixedMeals).toEqual([{ day: 0, slotId: 'main', mealIds: ['m2'] }])
    expect(next.rules?.specialDays).toHaveLength(1)
  })

  it('keeps a maybe-day whose meal is removed, as a plain maybe-day', () => {
    const h = household()
    h.rules!.specialDays![0]!.mealId = 'm1'
    const next = removeMeal(h, 'm1')
    expect(next.rules?.specialDays).toEqual([
      { day: 0, slotId: 'lunch', label: 'Leftovers', question: 'Any?', kashrut: 'meat' },
    ])
  })

  it('drops repeated meals from an every-week rule', () => {
    expect(cleanFixedMeal({ day: 1, slotId: 'main', mealIds: ['a', 'b', 'a'] }).mealIds).toEqual([
      'a',
      'b',
    ])
  })

  it('drops the removed slot from the plan', () => {
    const plan = {
      cells: [
        { day: 0, slotId: 'main', mealId: 'm1' },
        { day: 0, slotId: 'lunch', mealId: 'm1' },
      ],
    }
    expect(planWithoutSlot(plan, 'lunch').cells).toEqual([plan.cells[0]])
  })
})
