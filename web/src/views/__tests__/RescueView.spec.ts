import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/dom'

import type { RescueAnswer } from '@/core'
import { mountRoute, setupStore } from '@/test-utils'

/** A choice chip, e.g. a meal of the day or "Either". */
const chip = (name: string) => screen.getByRole('button', { name })

/** The card asking the next question; the starter's rescue questions all start "Do you have". */
const question = () => screen.queryByRole('group', { name: /^Do you have/ })
/** The suggested meals, one card each. */
const options = () => within(screen.getByRole('list')).queryAllByRole('listitem')

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
    // What the core will ask, and what is left after "no" to the first question and "yes" to
    // the second.
    const ask = (answers: RescueAnswer[]) => app.rescue({ day: app.today, slotId: 'main', answers })
    const first = ask([]).nextQuestion!
    const second = ask([{ question: first, yes: false }]).nextQuestion!
    const kept = ask([
      { question: first, yes: false },
      { question: second, yes: true },
    ]).options[0]!.name

    expect(chip('Main meal')).toBePressed()
    expect(question()).toBeNull()
    expect(options()).toHaveLength(2)

    await user.click(chip('Either'))
    expect(chip('Either')).toBePressed()
    expect(question()).toHaveAccessibleName(first)

    await user.click(within(question()!).getByRole('button', { name: 'No' }))
    expect(options()).toHaveLength(1)
    expect(question()).toHaveAccessibleName(second)
    await user.click(within(question()!).getByRole('button', { name: 'Yes' }))
    expect(question()).toBeNull()
    const option = within(screen.getByRole('list', { name: '1 ready to go' })).getByRole(
      'listitem',
      { name: kept },
    )

    await user.click(within(option).getByRole('button', { name: 'Use this' }))
    await vi.dynamicImportSettled()

    expect(app.meal(app.cell(1, 'main')?.mealId)?.name).toBe(kept)
    expect(app.cell(1, 'main')?.locked).toBe(true)
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('today'))
  })

  it('narrows by meat or dairy, with parve fitting either', async () => {
    const { user } = await setup()
    await user.click(chip('Meat'))
    expect(screen.getByRole('listitem', { name: 'Hot dogs' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'French fries' })).toBeInTheDocument()
    await user.click(chip('Dairy'))
    expect(options()).toHaveLength(1)
    expect(options()[0]).toHaveAccessibleName('French fries')
  })

  it('explains rescue meals when a slot has none', async () => {
    const { user } = await setup()
    await user.click(chip("Kids' take-along"))
    expect(
      screen.getByText(/You don't have any rescue meals for Kids' take-along/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Meals' })).toHaveAttribute('href', '/meals')
  })

  it('starts over', async () => {
    const { user } = await setup()
    await user.click(chip("Kids' light meal"))
    await user.click(chip('Either'))
    await user.click(within(question()!).getByRole('button', { name: 'No' }))

    await user.click(screen.getByRole('button', { name: 'Start over' }))
    expect(chip('Main meal')).toBePressed()
    expect(chip("Kids' light meal")).not.toBePressed()
    expect(chip('Either')).not.toBePressed()
    expect(question()).toBeNull()
    expect(options()).toHaveLength(2)
  })
})
