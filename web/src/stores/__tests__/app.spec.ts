import { describe, expect, it, vi } from 'vitest'

import { loadChanges } from '@/data/repository'
import { setupStore } from '@/test-store'

describe('app store', () => {
  it('starts empty on first run', async () => {
    const { app } = await setupStore({ starter: false })
    expect(app.firstRun).toBe(true)
    expect(app.household.meals).toHaveLength(0)
  })

  it('generates a plan from the starter template through the Rust core', async () => {
    const { app } = await setupStore()
    app.regenerate()
    const mains = app.data.plan.cells.filter((c) => c.slotId === 'main' && c.mealId)
    expect(mains.length).toBeGreaterThan(5)
    for (let day = 0; day < 14; day++) expect(app.checkDay(day)).toEqual([])
  })

  it('keeps hand-picked meals when regenerating', async () => {
    const { app } = await setupStore()
    const meal = app.household.meals.find((m) => m.slots.includes('main'))!
    app.setCell(3, 'main', meal.id)
    app.regenerate()
    expect(app.cell(3, 'main')?.mealId).toBe(meal.id)
  })

  it('saves what she enters, so it is there next time the app opens', async () => {
    const { app } = await setupStore()
    const meals = app.household.meals.map((m) => m.name)
    await app.load()
    expect(app.household.meals.map((m) => m.name)).toEqual(meals)
    expect((await loadChanges()).length).toBeGreaterThan(0)
  })

  it('saves an edit a moment after she makes it', async () => {
    const { app } = await setupStore()
    app.setUserName('Someone')
    await new Promise((r) => setTimeout(r, 400))
    await app.load()
    expect(app.data.userName).toBe('Someone')
  })

  it('keeps her answers, notes and pantry checks when the app opens again', async () => {
    const { app } = await setupStore({ regenerate: true })
    app.setSpecialActive(1, 'lunch', true)
    app.setNote('2026-10-13', 'main', 'plus vegetable soup for us')
    app.data.shopping.marks['milk'] = 'have'
    await app.save()
    const kept = () => ({
      answer: app.specialAnswer(1, 'lunch'),
      note: app.note('2026-10-13', 'main'),
      marks: { ...app.data.shopping.marks },
    })
    const expected = {
      answer: true,
      note: 'plus vegetable soup for us',
      marks: { milk: 'have' },
    }

    await app.load()
    expect(kept()).toEqual(expected)
    // Another edit after opening again doesn't record them as removed.
    app.setUserName('Someone')
    await app.save()
    await app.load()
    expect(kept()).toEqual(expected)
  })

  it('opening the app saves nothing until she changes something', async () => {
    const { app } = await setupStore({ starter: false })
    await new Promise((r) => setTimeout(r, 400))
    await app.save()
    expect(await loadChanges()).toEqual([])
  })
})

describe('notes', () => {
  it('are kept per calendar date and slot; a blank note is removed', async () => {
    const { app } = await setupStore()
    expect(app.note('2026-10-13', 'main')).toBe('')

    app.setNote('2026-10-13', 'main', 'plus vegetable soup for us')
    expect(app.note('2026-10-13', 'main')).toBe('plus vegetable soup for us')
    expect(app.note('2026-10-27', 'main')).toBe('')
    expect(app.data.notes).toEqual({ '2026-10-13|main': 'plus vegetable soup for us' })

    app.setNote('2026-10-13', 'main', '  ')
    expect(app.data.notes).toEqual({})
  })
})

describe('special-day answers', () => {
  it('are kept per calendar date, and start unanswered', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 12, 9)) // Monday, week A
    try {
      const { app } = await setupStore()
      app.setRotationStart('2026-10-11')
      app.regenerate()
      expect(app.specialAnswer(1, 'lunch')).toBeUndefined()

      app.setSpecialActive(1, 'lunch', true)
      expect(app.dateOf(1)).toBe('2026-10-12')
      expect(app.cell(1, 'lunch')?.specialActive).toBe(true)
      // The stored rotation itself is untouched, so it doesn't carry over to the next cycle.
      expect(
        app.data.plan.cells.find((c) => c.day === 1 && c.slotId === 'lunch')?.specialActive,
      ).toBeFalsy()
      expect(app.data.specialAnswers).toEqual({ '2026-10-12|lunch': true })
    } finally {
      vi.useRealTimers()
    }
  })

  it('give way to a meal she picks by hand, for that date only', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 12, 9)) // Monday, week A
    try {
      const { app } = await setupStore()
      app.setRotationStart('2026-10-11')
      app.regenerate()
      const meal = app.mealOptions(1, 'lunch')[0]!
      app.setSpecialActive(1, 'lunch', true)

      app.setCell(1, 'lunch', meal.mealId)
      expect(app.cell(1, 'lunch')).toMatchObject({ mealId: meal.mealId, specialActive: false })
      expect(app.prepFor(1).items.some((i) => i.mealId === meal.mealId)).toBe(true)
      // Answered, so the weekly question doesn't come back; she can still switch it on again.
      expect(app.specialAnswer(1, 'lunch')).toBe(false)
      app.setSpecialActive(1, 'lunch', true)
      expect(app.cell(1, 'lunch')?.specialActive).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stay on when she only clears the backup meal', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 12, 9))
    try {
      const { app } = await setupStore()
      app.setRotationStart('2026-10-11')
      app.regenerate()
      app.setSpecialActive(1, 'lunch', true)
      app.setCell(1, 'lunch', null)
      expect(app.cell(1, 'lunch')?.specialActive).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('on Shabbos, cover the coming week', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 24, 12)) // Shabbos B
    try {
      const { app } = await setupStore()
      app.setRotationStart('2026-10-11')
      expect(app.dateOf(0)).toBe('2026-10-25') // the next Sunday, week A again
    } finally {
      vi.useRealTimers()
    }
  })
})
