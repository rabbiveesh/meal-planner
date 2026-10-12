import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/dom'

import { mountComponent, setupStore } from '@/test-utils'
import MealsView from '@/views/MealsView.vue'

async function setup() {
  const store = await setupStore()
  return { ...store, ...(await mountComponent(MealsView, store)) }
}

describe('MealsView', () => {
  it('groups meals by slot and narrows them by search and filter', async () => {
    const { app, user } = await setup()
    const firstSlot = app.household.slots[0]!.name
    expect(screen.getByRole('group', { name: firstSlot })).toBeInTheDocument()

    const search = screen.getByRole('textbox', { name: 'Search meals' })
    await user.type(search, 'hot dog')
    // A meal that fits several slots shows up in each group.
    expect(screen.getAllByText('Hot dogs').length).toBeGreaterThan(0)
    expect(screen.queryByText('Chicken soup')).not.toBeInTheDocument()

    await user.clear(search)
    const filters = within(screen.getByRole('group', { name: 'Filter meals' }))
    await user.click(filters.getByRole('button', { name: 'Fun' }))
    expect(filters.getByRole('button', { name: 'Fun' })).toBePressed()
    expect(screen.queryByRole('group', { name: firstSlot })).not.toBeInTheDocument()
    const rows = within(screen.getByRole('group', { name: 'Fun meals' })).getAllByRole('listitem')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(row).toHaveTextContent('Fun')
  })

  it('adds a meal, insisting on a name and a slot', async () => {
    const { app, user } = await setup()
    const before = app.household.meals.length

    await user.click(screen.getByRole('button', { name: 'Add meal' }))
    const editor = await screen.findByRole('dialog', { name: 'New meal' })
    await user.click(within(editor).getByRole('button', { name: 'Save' }))
    expect(app.household.meals).toHaveLength(before)
    expect(await within(editor).findByText('Give the meal a name')).toBeInTheDocument()
    expect(within(editor).getByText('Pick at least one meal slot')).toBeInTheDocument()

    await user.type(within(editor).getByRole('textbox', { name: 'Meal name' }), '  Mujadara ')
    const slots = within(within(editor).getByRole('group', { name: 'Meal slots it can fill' }))
    await user.click(slots.getByRole('button', { name: 'Main meal' }))
    expect(slots.getByRole('button', { name: 'Main meal' })).toBePressed()
    await user.click(within(editor).getByRole('button', { name: 'Save' }))

    const added = app.household.meals.find((m) => m.name === 'Mujadara')
    expect(added).toMatchObject({ slots: ['main'], kashrut: 'parve', prep: 'ahead' })
    expect(app.household.meals).toHaveLength(before + 1)
  })

  it('edits and deletes a meal, clearing it from the plan', async () => {
    const { app, user } = await setup()
    app.regenerate()
    const meal = app.household.meals.find((m) => m.name === 'Hot dogs')!
    app.setCell(0, 'main', meal.id)

    // A meal that fits several slots has a row in each group; any of them opens it.
    await user.click(screen.getAllByRole('listitem', { name: 'Hot dogs' })[0]!)
    const editor = await screen.findByRole('dialog', { name: 'Edit meal' })
    await user.click(within(editor).getByRole('button', { name: 'Delete meal' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete Hot dogs?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))

    expect(app.meal(meal.id)).toBeUndefined()
    expect(app.data.plan.cells.some((c) => c.mealId === meal.id)).toBe(false)
  })
})
