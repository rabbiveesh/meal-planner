import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/dom'

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

  it("answers this week's questions, and each one leaves once answered", async () => {
    const store = await setupStore({ regenerate: true })
    const { app } = store
    const { user } = await mountRoute('/', store)
    const questions = within(screen.getByRole('region', { name: 'Questions this week' }))
    const monday = 'Monday A Any Shabbos leftovers for your Monday lunch?'
    const card = within(questions.getByRole('group', { name: monday }))
    // Until she says yes, the backup meal stays on the plan.
    expect(card.getByText(/^Planned:/)).toHaveTextContent('backup')

    await user.click(card.getByRole('button', { name: 'Yes' }))
    expect(app.cell(1, 'lunch')?.specialActive).toBe(true)
    await vi.waitFor(() =>
      expect(questions.queryByRole('group', { name: monday })).not.toBeInTheDocument(),
    )
    expect(questions.getAllByRole('group')).toHaveLength(2)

    // A "no" counts as an answer too; once they're all answered the list is gone.
    for (const group of questions.getAllByRole('group')) {
      await user.click(within(group).getByRole('button', { name: 'No' }))
    }
    expect(app.cell(3, 'light')?.specialActive).toBe(false)
    await vi.waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Questions this week' })).not.toBeInTheDocument(),
    )
  })

  it("asks the coming week's questions once Shabbos is over", async () => {
    vi.setSystemTime(new Date(2026, 9, 17, 21, 0)) // Saturday night
    const store = await setupStore({ regenerate: true })
    // Last week's questions were all answered.
    store.app.data.specialAnswers = {
      '2026-10-11|lunch': false,
      '2026-10-12|lunch': true,
      '2026-10-14|light': false,
    }
    await mountRoute('/', store)
    const questions = within(screen.getByRole('region', { name: 'Questions this week' }))
    expect(
      questions.getByRole('group', {
        name: 'Sunday B Any Shabbos leftovers for your Sunday lunch?',
      }),
    ).toBeInTheDocument()
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

  it('turns to the next and previous day with the arrows', async () => {
    const store = await setupStore({ regenerate: true })
    const { app } = store
    const { user, router } = await mountRoute('/', store)

    await user.click(screen.getByRole('button', { name: 'Next day' }))
    await vi.waitFor(() => expect(router.currentRoute.value.query.date).toBe('2026-10-13'))
    expect(screen.getByRole('heading', { name: 'Tuesday, 13 October' })).toBeInTheDocument()
    expect(screen.getByText('Tomorrow · Tuesday A')).toBeInTheDocument()
    const main = app.meal(app.cell(2, 'main')?.mealId)!
    expect(
      screen.getByRole('listitem', { name: `Main meal: ${main.name}. Tap to change.` }),
    ).toBeInTheDocument()
    // Today's extras stay on today.
    expect(screen.queryByRole('link', { name: 'Rescue me' })).not.toBeInTheDocument()
    expect(screen.queryByText("Tonight's prep for tomorrow")).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    await vi.waitFor(() => expect(router.currentRoute.value.query.date).toBe('2026-10-11'))
    expect(screen.getByRole('heading', { name: 'Sunday, 11 October' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to today' }))
    await vi.waitFor(() => expect(router.currentRoute.value.query.date).toBeUndefined())
    expect(screen.getByRole('heading', { name: 'Monday, 12 October' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rescue me' })).toBeInTheDocument()
  })

  it("opens on tomorrow from 8pm, with tonight's prep", async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 20, 30))
    const store = await setupStore({ regenerate: true })
    const { app } = store
    const { user, router } = await mountRoute('/', store)
    expect(screen.getByRole('heading', { name: 'Tuesday, 13 October' })).toBeInTheDocument()
    expect(screen.getByText('Tomorrow · Tuesday A')).toBeInTheDocument()
    const main = app.meal(app.cell(2, 'main')?.mealId)!
    expect(
      screen.getByRole('listitem', { name: `Main meal: ${main.name}. Tap to change.` }),
    ).toBeInTheDocument()
    expect(screen.getByText("Tonight's prep for tomorrow")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument()

    // Today is still a swipe back, with the rescue button.
    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    await vi.waitFor(() => expect(router.currentRoute.value.query.date).toBe('2026-10-12'))
    expect(screen.getByText('Today · Monday A')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rescue me' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to tomorrow' }))
    await vi.waitFor(() => expect(router.currentRoute.value.query.date).toBeUndefined())
    expect(screen.getByRole('heading', { name: 'Tuesday, 13 October' })).toBeInTheDocument()
  })

  it('opens on today before her chosen evening time', async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 20, 30))
    const store = await setupStore()
    store.app.setTomorrowFrom('21:00')
    await mountRoute('/', store)
    expect(screen.getByRole('heading', { name: 'Monday, 12 October' })).toBeInTheDocument()
  })

  it('turns the page with a swipe: left goes forward, right goes back', async () => {
    const { router } = await mountRoute('/')
    const page = screen.getByRole('heading', { name: 'Monday, 12 October' }).closest('.today')!
    const swipe = (from: number, to: number) => {
      fireEvent.touchStart(page, { changedTouches: [{ clientX: from, clientY: 100 }] })
      fireEvent.touchEnd(page, { changedTouches: [{ clientX: to, clientY: 105 }] })
    }

    swipe(300, 100)
    await vi.waitFor(() => expect(router.currentRoute.value.query.date).toBe('2026-10-13'))
    swipe(300, 100)
    await vi.waitFor(() => expect(router.currentRoute.value.query.date).toBe('2026-10-14'))
    swipe(100, 300)
    await vi.waitFor(() => expect(router.currentRoute.value.query.date).toBe('2026-10-13'))
  })

  it('opens on the date in the address', async () => {
    await mountRoute({ path: '/', query: { date: '2026-10-21' } })
    expect(screen.getByRole('heading', { name: 'Wednesday, 21 October' })).toBeInTheDocument()
    expect(screen.getByText('Wednesday B')).toBeInTheDocument()
  })

  it("changes another day's meal by tapping it", async () => {
    const store = await setupStore({ regenerate: true })
    const { app } = store
    const { user } = await mountRoute({ path: '/', query: { date: '2026-10-13' } }, store)
    const before = app.cell(2, 'main')?.mealId
    await user.click(screen.getByRole('listitem', { name: /^Main meal: / }))
    const dialog = await screen.findByRole('dialog', { name: 'Main meal Tuesday A' })

    const choice = app.household.meals.find(
      (m) => m.slots.includes('main') && m.id !== before && m.kashrut === 'parve',
    )!
    await user.click(within(dialog).getByText(choice.name))

    expect(app.cell(2, 'main')).toMatchObject({ mealId: choice.id, locked: true })
    expect(
      screen.getByRole('listitem', { name: `Main meal: ${choice.name}. Tap to change.` }),
    ).toBeInTheDocument()
  })

  it('keeps her own notes under each meal, for that day only', async () => {
    const store = await setupStore({ regenerate: true })
    const { user } = await mountRoute({ path: '/', query: { date: '2026-10-13' } }, store)

    await user.type(
      screen.getByRole('textbox', { name: 'Notes for Main meal' }),
      'plus vegetable soup for us',
    )
    expect(store.app.note('2026-10-13', 'main')).toBe('plus vegetable soup for us')

    await user.click(screen.getByRole('button', { name: 'Next day' }))
    await vi.waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Wednesday, 14 October' })).toBeInTheDocument(),
    )
    expect(screen.getByRole('textbox', { name: 'Notes for Main meal' })).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    await vi.waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Notes for Main meal' })).toHaveValue(
        'plus vegetable soup for us',
      ),
    )
  })

  it('shows a hand-written slot as a box to write in, never a planned meal', async () => {
    const store = await setupStore()
    store.app.saveSlot({
      id: 'chedva',
      name: "Chedva's food",
      view: 'home',
      days: [0, 1, 2, 3, 4, 5],
      handWritten: true,
    })
    store.app.regenerate()
    expect(store.app.data.plan.cells.some((c) => c.slotId === 'chedva')).toBe(false)
    const { user } = await mountRoute({ path: '/', query: { date: '2026-10-13' } }, store)

    expect(screen.queryByRole('button', { name: /^Chedva's food:/ })).not.toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: "Chedva's food" }), 'mashed potatoes')
    expect(store.app.note('2026-10-13', 'chedva')).toBe('mashed potatoes')
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
