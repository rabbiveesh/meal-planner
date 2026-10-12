import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/dom'
import { flushPromises } from '@vue/test-utils'

import { mountRoute, setupStore } from '@/test-utils'

/** The card for one day of the plan, e.g. "Monday A". */
const dayCard = (label: string) => screen.getByRole('group', { name: label })

/** One meal on a day card; its accessible name is "<slot>: <meal>. Tap to change." */
function slotRow(card: HTMLElement, slot: string): HTMLElement {
  return within(card).getByRole('listitem', { name: new RegExp(`^${slot}:`) })
}

describe('PlanView', () => {
  beforeEach(() => {
    // Monday of week A in the starter template's rotation.
    vi.useFakeTimers({ now: new Date(2026, 9, 12, 9, 0), toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('points to Meals and Setup when there are no meals', async () => {
    await mountRoute('/plan', await setupStore({ starter: false }))
    expect(screen.getByText('No meals yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add meals' })).toHaveAttribute('href', '/meals')
    expect(screen.getByRole('link', { name: 'Setup' })).toHaveAttribute('href', '/setup')
  })

  it('shows one uncrowded chart at a time, week by week', async () => {
    const store = await setupStore({ regenerate: true })
    const { app } = store
    const { router, user } = await mountRoute('/plan', store)
    expect(dayCard('Sunday A')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Sunday B' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Main meal').length).toBeGreaterThan(0)
    expect(screen.queryByText("Kids' take-along")).not.toBeInTheDocument()
    expect(dayCard('Monday A')).toHaveTextContent(app.meal(app.cell(1, 'main')?.mealId)!.name)
    // Friday has no main meal, only Friday lunch.
    expect(within(dayCard('Friday A')).queryByText('Main meal')).not.toBeInTheDocument()
    expect(within(dayCard('Friday A')).getByText('Friday lunch')).toBeInTheDocument()
    expect(within(dayCard('Monday A')).getByText('Today')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Take-along' }))
    await vi.waitFor(() => expect(router.currentRoute.value.query.view).toBe('takeAlong'))
    expect((await screen.findAllByText("Kids' take-along")).length).toBeGreaterThan(0)
    expect(screen.queryByText('Main meal')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Week B' }))
    await vi.waitFor(() => expect(router.currentRoute.value.query.week).toBe('B'))
    expect(await screen.findByRole('group', { name: 'Sunday B' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Sunday A' })).not.toBeInTheDocument()
  })

  it('swaps a meal by hand and marks it hand-picked', async () => {
    const store = await setupStore({ regenerate: true })
    const { app } = store
    const { user } = await mountRoute('/plan', store)
    const before = app.cell(2, 'main')?.mealId
    const tuesday = dayCard('Tuesday A')
    await user.click(slotRow(tuesday, 'Main meal'))
    const dialog = await screen.findByRole('dialog', { name: 'Main meal Tuesday A' })

    const choice = app.household.meals.find(
      (m) => m.slots.includes('main') && m.id !== before && m.kashrut === 'parve',
    )!
    await user.click(within(dialog).getByText(choice.name))

    expect(app.cell(2, 'main')).toMatchObject({ mealId: choice.id, locked: true })
    const card = within(tuesday)
    expect(card.getByText(choice.name)).toBeInTheDocument()
    expect(card.getByText('Hand-picked')).toBeInTheDocument()
  })

  it('searches the swap list', async () => {
    const { user } = await mountRoute('/plan')
    await user.click(slotRow(dayCard('Sunday A'), 'Main meal'))
    const dialog = await screen.findByRole('dialog', { name: 'Main meal Sunday A' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Search meals' }), 'mujadara')
    const items = within(dialog)
      .getAllByRole('listitem')
      .map((i) => i.textContent)
    expect(items.every((t) => t?.toLowerCase().includes('mujadara'))).toBe(true)
    expect(items.length).toBeGreaterThan(0)
  })

  it('turns on a special day, keeping the backup meal visible', async () => {
    const store = await setupStore({ regenerate: true })
    const { app } = store
    const { user } = await mountRoute('/plan?view=takeAlong', store)
    const backup = app.meal(app.cell(0, 'lunch')?.mealId)!
    const sunday = dayCard('Sunday A')
    await user.click(slotRow(sunday, 'Our lunch'))
    const dialog = await screen.findByRole('dialog', { name: 'Our lunch Sunday A' })
    await user.click(within(dialog).getByRole('checkbox', { name: 'Shabbos leftovers' }))
    expect(app.cell(0, 'lunch')?.specialActive).toBe(true)

    const card = within(sunday)
    expect(card.getByRole('deletion')).toHaveTextContent(backup.name)
    expect(card.getByText('Shabbos leftovers')).toBeInTheDocument()
  })

  it('shows kashrut problems on the cell they affect', async () => {
    const store = await setupStore({ regenerate: true })
    const { app } = store
    await mountRoute('/plan?view=takeAlong', store)
    // Meat at breakfast, dairy at lunch: the adults wait longer than that.
    app.setCell(0, 'ourBreakfast', 'chicken-salad')
    app.setCell(0, 'lunch', 'protein-shake-with-berries')
    await flushPromises()
    const [alert] = within(slotRow(dayCard('Sunday A'), 'Our lunch')).getAllByRole('alert')
    expect(alert).toHaveTextContent('after meat')
  })

  it('makes a new plan after confirming, keeping hand-picked meals', async () => {
    const store = await setupStore({ regenerate: true })
    const { app } = store
    const { user } = await mountRoute('/plan', store)
    app.setCell(3, 'main', 'risotto')
    const spy = vi.spyOn(app, 'regenerate')
    await user.click(screen.getByRole('button', { name: 'Make a new plan' }))
    expect(spy).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog', { name: 'Make a new plan?' })
    await user.click(within(dialog).getByRole('button', { name: 'Make a new plan' }))
    expect(spy).toHaveBeenCalledOnce()
    expect(app.cell(3, 'main')?.mealId).toBe('risotto')
  })

  it('opens the printable chart for the current tab', async () => {
    const { router, user } = await mountRoute('/plan?view=breakfast')
    await user.click(screen.getByRole('link', { name: 'Print' }))
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/print/breakfast'))
  })
})

describe('PrintView', () => {
  it('prints one table per week with the view’s slots as columns', async () => {
    const store = await setupStore({ regenerate: true })
    const { app } = store
    await mountRoute('/print/takeAlong', store)
    expect(screen.getByRole('heading', { name: 'Take-along · Week A' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Take-along · Week B' })).toBeInTheDocument()
    expect(screen.getAllByText('Rotation started Sunday 11 October 2026')).toHaveLength(2)
    const tables = screen.getAllByRole('table')
    expect(tables).toHaveLength(2)
    expect(
      within(tables[0]!)
        .getAllByRole('columnheader')
        .map((t) => t.textContent?.trim()),
    ).toEqual(['', "Kids' take-along", 'Our lunch'])
    const body = within(tables[1]!).getAllByRole('rowgroup')[1]!
    expect(within(body).getAllByRole('row')).toHaveLength(6)
    expect(tables[1]).toHaveTextContent(app.meal(app.cell(9, 'lunch')?.mealId)!.name)
  })

  it('prints with the browser and goes back to the plan', async () => {
    const { router, user } = await mountRoute('/print/home')
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const printButton = screen.getByRole('button', { name: 'Print' })
    await user.click(printButton)
    expect(print).toHaveBeenCalledOnce()
    // The buttons themselves stay off the paper.
    expect(printButton.closest('.no-print')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('plan'))
    expect(router.currentRoute.value.query.view).toBe('home')
  })

  it('says so for an unknown chart', async () => {
    await mountRoute('/print/lunchbox')
    expect(screen.getByText('There is no chart with that name.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
