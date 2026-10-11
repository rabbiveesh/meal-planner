import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/dom'

import { getStorage } from '@/storage'
import { mountRoute, setupStore } from '@/test-utils'

describe('TodayView', () => {
  beforeEach(() => {
    // Monday of week A in the starter template's rotation.
    vi.useFakeTimers({ now: new Date(2026, 9, 12, 9, 0), toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('offers the starter template on first run and loads it', async () => {
    const store = await setupStore({ starter: false })
    const { user } = await mountRoute('/', store)
    expect(screen.getByText(/placeholder names/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start from the starter template' }))
    await vi.dynamicImportSettled()

    expect((await screen.findAllByText('Monday A')).length).toBeGreaterThan(0)
    expect(store.app.household.meals.length).toBeGreaterThan(0)
    expect(store.app.data.plan.cells.some((c) => c.mealId)).toBe(true)
    expect(store.app.today).toBe(1) // the rotation starts this week
  })

  it("shows today's meals by slot", async () => {
    const store = await setupStore({ regenerate: true })
    const { app } = store
    await mountRoute('/', store)
    const main = app.meal(app.cell(1, 'main')?.mealId)!
    expect(screen.getByText('Main meal')).toBeInTheDocument()
    expect(screen.getAllByText(main.name).length).toBeGreaterThan(0)
    expect(screen.queryByText('Friday lunch')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rescue me' })).toHaveAttribute('href', '/rescue')
  })

  it("answers this week's questions", async () => {
    const store = await setupStore({ regenerate: true })
    const { app } = store
    const { user } = await mountRoute('/', store)
    // Each question is a card without an accessible name; find it by its question.
    const card = within(
      screen
        .getByText('Any Shabbos leftovers for your Monday lunch?')
        .closest<HTMLElement>('.v-card')!,
    )
    // Until she says yes, the backup meal stays on the plan.
    expect(card.getByText(/^Planned:/)).toHaveTextContent('backup')

    await user.click(card.getByRole('button', { name: 'Yes' }))
    expect(app.cell(1, 'lunch')?.specialActive).toBe(true)
    expect(card.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true')
    expect(card.getByText(/^Planned:/)).toHaveTextContent('Shabbos leftovers')

    await user.click(card.getByRole('button', { name: 'No' }))
    expect(app.cell(1, 'lunch')?.specialActive).toBe(false)
    expect(card.getByText(/^Planned:/)).toHaveTextContent('backup')
  })

  it("lists tonight's prep for tomorrow and remembers ticks", async () => {
    const store = await setupStore({ regenerate: true })
    const items = store.app.prepFor(2).items
    expect(items.length).toBeGreaterThan(0)
    const { user } = await mountRoute('/', store)
    const first = screen.getByRole('checkbox', { name: items[0]!.text })

    await user.click(first)
    expect(first).toBeChecked()
    await vi.waitFor(async () =>
      expect(await getStorage().getItem('prep-checked')).toEqual({
        list: '2026-10-13',
        done: [`${items[0]!.slotId}:${items[0]!.text}`],
      }),
    )
  })

  it('has nothing to prep on Friday night', async () => {
    vi.setSystemTime(new Date(2026, 9, 16, 21, 0))
    await mountRoute('/')
    expect(screen.getByText('Nothing to prep tonight.')).toBeInTheDocument()
  })

  it('shows a message passed in navigation state, once', async () => {
    const { router } = await mountRoute({
      path: '/',
      state: { snackbar: 'Hot dogs is on the plan' },
    })
    expect(await screen.findByText('Hot dogs is on the plan')).toBeInTheDocument()
    expect(router.options.history.state.snackbar).toBeUndefined()
  })
})
