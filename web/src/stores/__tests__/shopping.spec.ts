import { describe, expect, it } from 'vitest'

import { setupStore } from '@/test-store'
import { useShoppingStore } from '../shopping'

async function setup() {
  const { app } = await setupStore({ regenerate: true })
  return { app, shopping: useShoppingStore() }
}

describe('shopping store', () => {
  it('merges master-list staples with what the rotation needs', async () => {
    const { shopping } = await setup()
    expect(shopping.items.some((i) => i.key === 'chicken' && i.meals.length > 0)).toBe(true)

    shopping.addStaple('CHICKEN', 'Butcher')
    shopping.addStaple('Milk', 'Dairy')
    const chicken = shopping.items.filter((i) => i.key === 'chicken')
    expect(chicken).toHaveLength(1)
    expect(chicken[0]).toMatchObject({ staple: true, category: 'Butcher' })
    expect(shopping.items[0]!.name).toBe('CHICKEN')
  })

  it('refuses duplicate staples and imports a pasted list', async () => {
    const { app, shopping } = await setup()
    expect(shopping.addStaple('Milk', 'Dairy')).toBe(true)
    expect(shopping.addStaple(' milk ', 'Dairy')).toBe(false)
    expect(shopping.importStaples('Dairy:\nMilk\nYogurt\nBakery: Pitas')).toEqual({
      added: 2,
      skipped: 1,
    })
    expect(app.data.shopping.staples.map((s) => s.name)).toEqual(['Milk', 'Yogurt', 'Pitas'])

    const yogurt = app.data.shopping.staples[1]!
    expect(shopping.updateStaple(yogurt.id, 'Milk', 'Dairy')).toBe(false)
    expect(shopping.updateStaple(yogurt.id, 'Greek yogurt', 'Dairy')).toBe(true)
    shopping.removeStaple(yogurt.id)
    expect(app.data.shopping.staples.map((s) => s.name)).toEqual(['Milk', 'Pitas'])
  })

  it('puts everything not marked "have" on the list, and a new trip clears it', async () => {
    const { app, shopping } = await setup()
    shopping.importStaples('Milk\nPitas\nRice')
    const [milk, pitas] = shopping.items
    shopping.mark(milk!, 'have')
    shopping.mark(pitas!, 'need')
    expect(shopping.checkedCount).toBe(2)
    expect(shopping.toBuy.map((i) => i.name)).not.toContain('Milk')
    expect(shopping.toBuy.map((i) => i.name)).toEqual(expect.arrayContaining(['Pitas', 'Rice']))

    shopping.setBought(pitas!, true)
    expect(shopping.boughtCount).toBe(1)
    shopping.setBought(pitas!, false)
    expect(shopping.boughtCount).toBe(0)
    shopping.setBought(pitas!, true)

    shopping.newTrip()
    expect(app.data.shopping.marks).toEqual({})
    expect(app.data.shopping.bought).toEqual([])
    expect(app.data.shopping.staples).toHaveLength(3)
  })

  it('updates the needs when the plan changes', async () => {
    const { app, shopping } = await setup()
    expect(shopping.items.some((i) => i.meals.length)).toBe(true)
    app.data.plan = { cells: [] }
    await Promise.resolve()
    expect(shopping.items.filter((i) => i.meals.length)).toEqual([])
  })
})
