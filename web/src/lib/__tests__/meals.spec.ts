import { describe, expect, it } from 'vitest'

import type { Meal, SlotDef } from '@/core'
import {
  cleanMeal,
  filterMeals,
  groupBySlot,
  knownIngredientValues,
  mealProblems,
  newMeal,
} from '../meals'

const slot = (id: string, name = id): SlotDef => ({ id, name, view: 'home', days: [0] })
const meal = (name: string, init: Partial<Meal> = {}): Meal => newMeal({ name, ...init })

describe('newMeal', () => {
  it('has defaults and a fresh id', () => {
    const a = newMeal()
    expect(a).toMatchObject({ name: '', slots: [], kashrut: 'parve', prep: 'ahead', days: [] })
    expect(a.id).not.toBe(newMeal().id)
  })

  it('keeps an existing meal and fills its missing lists', () => {
    const m = newMeal({ id: 'x', name: 'Soup', slots: ['main'], kashrut: 'meat' })
    const { ingredients: _, ...stored } = m
    expect(newMeal(stored)).toEqual({ ...m, ingredients: [] })
    expect(newMeal(stored).id).toBe('x')
  })
})

describe('cleanMeal', () => {
  it('trims text and drops blank rows and fields', () => {
    const m = cleanMeal({
      ...meal('  Pasta  ', { slots: ['main', 'main'], days: [3, 1, 3] }),
      kidsVersion: '  ',
      ingredients: [
        { item: ' Pasta ', perAdult: 1, perChild: null as unknown as undefined, unit: ' g ' },
        { item: '   ' },
      ],
      prepTasks: ['Boil water', '  '],
      rescueQuestions: ['Pasta in the pantry?'],
    })
    expect(m.name).toBe('Pasta')
    expect(m.slots).toEqual(['main'])
    expect(m.days).toEqual([1, 3])
    expect(m.kidsVersion).toBeUndefined()
    expect(m.ingredients).toEqual([{ item: 'Pasta', perAdult: 1, unit: 'g' }])
    expect(m.prepTasks).toEqual(['Boil water'])
    // Not a rescue meal, so its questions are dropped.
    expect(m.rescueQuestions).toEqual([])
  })

  it('keeps rescue questions on a rescue meal', () => {
    const m = cleanMeal(meal('Hot dogs', { rescue: true, rescueQuestions: [' Hot dogs? ', ''] }))
    expect(m.rescueQuestions).toEqual(['Hot dogs?'])
  })
})

describe('mealProblems', () => {
  it('needs a name and a slot', () => {
    expect(mealProblems(meal(' '))).toEqual({
      name: expect.any(String),
      slots: expect.any(String),
    })
    expect(mealProblems(meal('Soup', { slots: ['main'] }))).toEqual({})
  })
})

describe('filterMeals', () => {
  const meals = [
    meal('Chicken soup', { slots: ['main'] }),
    meal('Hot dogs', { slots: ['main', 'light'], rescue: true, kidsVersion: 'in buns' }),
    meal('Halloumi night', { slots: ['main'], fun: true }),
  ]
  const names = (ms: Meal[]) => ms.map((m) => m.name)

  it('searches names and versions, ignoring case', () => {
    expect(names(filterMeals(meals, 'SOUP', null))).toEqual(['Chicken soup'])
    expect(names(filterMeals(meals, 'buns', null))).toEqual(['Hot dogs'])
    expect(filterMeals(meals, '  ', null)).toHaveLength(3)
  })

  it('narrows by slot, rescue or fun', () => {
    expect(names(filterMeals(meals, '', { slotId: 'light' }))).toEqual(['Hot dogs'])
    expect(names(filterMeals(meals, '', 'rescue'))).toEqual(['Hot dogs'])
    expect(names(filterMeals(meals, '', 'fun'))).toEqual(['Halloumi night'])
  })
})

describe('groupBySlot', () => {
  const slots = [slot('main', 'Main meal'), slot('light', 'Light meal'), slot('empty')]
  const meals = [
    meal('Soup', { slots: ['main'] }),
    meal('Hot dogs', { slots: ['main', 'light'] }),
    meal('Orphan', { slots: ['gone'] }),
  ]

  it('lists meals under each slot in slot order, skipping empty slots', () => {
    const groups = groupBySlot(meals, slots)
    expect(groups.map((g) => [g.title, g.meals.map((m) => m.name)])).toEqual([
      ['Main meal', ['Hot dogs', 'Soup']],
      ['Light meal', ['Hot dogs']],
      ['No meal slot', ['Orphan']],
    ])
  })

  it('shows only one slot when asked', () => {
    expect(groupBySlot(meals, slots, 'light').map((g) => g.title)).toEqual(['Light meal'])
  })
})

describe('knownIngredientValues', () => {
  it('collects distinct, sorted values', () => {
    const meals = [
      meal('A', { ingredients: [{ item: 'Rice', unit: 'cups', category: 'Dry goods' }] }),
      meal('B', { ingredients: [{ item: 'Chicken', unit: 'cups' }, { item: 'Rice' }] }),
    ]
    expect(knownIngredientValues(meals, 'item')).toEqual(['Chicken', 'Rice'])
    expect(knownIngredientValues(meals, 'unit')).toEqual(['cups'])
    expect(knownIngredientValues(meals, 'category')).toEqual(['Dry goods'])
  })
})
