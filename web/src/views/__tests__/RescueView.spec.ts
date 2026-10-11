import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/dom'

import { mountRoute, setupStore } from '@/test-utils'

/**
 * A choice chip. Vuetify chips have no role or aria-pressed, so they are found by their text
 * and their selected state is read from the chip group's `selected-class`.
 */
const chip = (text: string) => screen.getByText(text).closest<HTMLElement>('.v-chip')!

/** The question card and the option cards have no accessible name; the view marks them. */
const question = () => document.querySelector<HTMLElement>('[data-test="question"]')
const options = () => [...document.querySelectorAll<HTMLElement>('[data-test="option"]')]

async function setup() {
  const store = await setupStore({ regenerate: true })
  return { ...store, ...(await mountRoute('/rescue', store)) }
}

describe('RescueView', () => {
  beforeEach(() => {
    // Monday A, 2pm: the main meal is next.
    vi.useFakeTimers({ now: new Date(2026, 9, 12, 14, 0), toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('asks questions and puts the chosen rescue meal on the plan', async () => {
    const { app, router, user } = await setup()
    expect(chip('Main meal')).toHaveClass('bg-primary')
    expect(question()).toBeNull()
    expect(options()).toHaveLength(2)

    await user.click(screen.getByText('Either'))
    expect(question()).toHaveTextContent(/\?/)

    // Answer no to the first question, yes to the next one.
    await user.click(within(question()!).getByRole('button', { name: 'No' }))
    expect(options()).toHaveLength(1)
    await user.click(within(question()!).getByRole('button', { name: 'Yes' }))
    expect(question()).toBeNull()
    expect(screen.getByText(/1 ready to go/)).toBeInTheDocument()

    const [option] = options()
    const optionText = option!.textContent
    await user.click(within(option!).getByRole('button', { name: 'Use this' }))
    await vi.dynamicImportSettled()

    const planned = app.meal(app.cell(1, 'main')?.mealId)
    expect(optionText).toContain(planned?.name)
    expect(app.cell(1, 'main')?.locked).toBe(true)
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('today'))
  })

  it('narrows by meat or dairy, with parve fitting either', async () => {
    const { user } = await setup()
    const optionTexts = () => options().map((o) => o.textContent)
    await user.click(screen.getByText('Meat'))
    expect(optionTexts()).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Hot dogs'),
        expect.stringContaining('French fries'),
      ]),
    )
    await user.click(screen.getByText('Dairy'))
    expect(optionTexts()).toEqual([expect.stringContaining('French fries')])
  })

  it('explains rescue meals when a slot has none', async () => {
    const { user } = await setup()
    await user.click(screen.getByText("Kids' take-along"))
    expect(
      screen.getByText(/You don't have any rescue meals for Kids' take-along/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Meals' })).toHaveAttribute('href', '/meals')
  })

  it('starts over', async () => {
    const { user } = await setup()
    await user.click(screen.getByText("Kids' light meal"))
    await user.click(screen.getByText('Either'))
    await user.click(within(question()!).getByRole('button', { name: 'No' }))

    await user.click(screen.getByRole('button', { name: 'Start over' }))
    expect(chip('Main meal')).toHaveClass('bg-primary')
    expect(question()).toBeNull()
    expect(options()).toHaveLength(2)
  })
})
