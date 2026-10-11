import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/dom'

import { mountComponent, setupStore } from '@/test-utils'
import MealsView from '@/views/MealsView.vue'

async function setup() {
  const store = await setupStore()
  return { ...store, ...(await mountComponent(MealsView, store)) }
}

/** The meal groups (one card per slot). They have no accessible name, so they carry data-test. */
const groups = () => [...document.querySelectorAll<HTMLElement>('[data-test=group]')]

describe('MealsView', () => {
  it('groups meals by slot and narrows them by search and filter', async () => {
    const { app, user } = await setup()
    expect(groups()[0]).toHaveTextContent(app.household.slots[0]!.name)

    const search = screen.getByRole('textbox', { name: 'Search meals' })
    await user.type(search, 'hot dog')
    // A meal that fits several slots shows up in each group.
    expect(screen.getAllByText('Hot dogs').length).toBeGreaterThan(0)
    expect(screen.queryByText('Chicken soup')).not.toBeInTheDocument()

    await user.clear(search)
    // The filter chips have no labelled group to search within; they come before the meal rows.
    await user.click(screen.getAllByText('Fun')[0]!)
    for (const g of groups()) expect(within(g).getAllByText('Fun').length).toBeGreaterThan(0)
  })

  it('adds a meal, insisting on a name and a slot', async () => {
    const { app, user } = await setup()
    const before = app.household.meals.length

    await user.click(screen.getByRole('button', { name: 'Add meal' }))
    const editor = await screen.findByRole('dialog')
    await user.click(within(editor).getByRole('button', { name: 'Save' }))
    expect(app.household.meals).toHaveLength(before)
    expect(await within(editor).findByText('Give the meal a name')).toBeInTheDocument()
    expect(within(editor).getByText('Pick at least one meal slot')).toBeInTheDocument()

    await user.type(within(editor).getByRole('textbox', { name: 'Meal name' }), '  Mujadara ')
    // The first "Main meal" chip is "Meal slots it can fill"; the second is leftovers.
    await user.click(within(editor).getAllByText('Main meal')[0]!)
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

    await user.click(screen.getAllByText('Hot dogs')[0]!)
    await user.click(await screen.findByRole('button', { name: 'Delete meal' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(app.meal(meal.id)).toBeUndefined()
    expect(app.data.plan.cells.some((c) => c.mealId === meal.id)).toBe(false)
  })
})
