import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useDriver, getStorage } from '@/storage'
import { useAppStore } from '../app'
import starter from '@/data/templates/starter.json'
import { importJson } from '@/data/repository'

describe('app store', () => {
  beforeEach(() => {
    useDriver() // in-memory storage
    setActivePinia(createPinia())
  })

  it('starts empty on first run', async () => {
    const app = useAppStore()
    await app.load()
    expect(app.firstRun).toBe(true)
    expect(app.household.meals).toHaveLength(0)
  })

  it('generates a plan from the starter template through the Rust core', async () => {
    const app = useAppStore()
    await app.load()
    app.replaceAll(importJson(JSON.stringify(starter)))
    app.regenerate()
    const mains = app.plan.cells.filter((c) => c.slotId === 'main' && c.mealId)
    expect(mains.length).toBeGreaterThan(5)
    for (let day = 0; day < 14; day++) expect(app.checkDay(day)).toEqual([])
  })

  it('keeps hand-picked meals when regenerating', async () => {
    const app = useAppStore()
    await app.load()
    app.replaceAll(importJson(JSON.stringify(starter)))
    const meal = app.household.meals.find((m) => m.slots.includes('main'))!
    app.setCell(3, 'main', meal.id)
    app.regenerate()
    expect(app.cell(3, 'main')?.mealId).toBe(meal.id)
  })

  it('saves to storage', async () => {
    const app = useAppStore()
    await app.load()
    app.replaceAll(importJson(JSON.stringify(starter)))
    await new Promise((r) => setTimeout(r, 400))
    expect(await getStorage().hasItem('app-data')).toBe(true)
  })
})
