import { describe, expect, it, vi } from 'vitest'

import { getStorage } from '@/storage'
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

  it('saves to storage', async () => {
    await setupStore()
    await new Promise((r) => setTimeout(r, 400))
    expect(await getStorage().hasItem('app-data')).toBe(true)
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
