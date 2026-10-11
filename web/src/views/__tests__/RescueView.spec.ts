import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DOMWrapper, VueWrapper } from '@vue/test-utils'

import { mountAt, setup } from './todayRescueSetup'

const button = (w: VueWrapper | DOMWrapper<Element>, text: string) =>
  w.findAll('button').find((b) => b.text() === text)!
const chip = (w: VueWrapper, text: string) => w.findAll('.v-chip').find((c) => c.text() === text)!

describe('RescueView', () => {
  beforeEach(() => {
    // Monday A, 2pm: the main meal is next.
    vi.useFakeTimers({ now: new Date(2026, 9, 12, 14, 0), toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('asks questions and puts the chosen rescue meal on the plan', async () => {
    const ctx = await setup()
    const wrapper = await mountAt('/rescue', ctx)
    expect(chip(wrapper, 'Main meal').classes()).toContain('bg-primary')
    expect(wrapper.find('[data-test="question"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-test="option"]')).toHaveLength(2)

    await chip(wrapper, 'Either').trigger('click')
    const question = wrapper.find('[data-test="question"]')
    expect(question.text()).toMatch(/\?/)

    // Answer no to the first question, yes to the next one.
    await button(question, 'No').trigger('click')
    expect(wrapper.findAll('[data-test="option"]')).toHaveLength(1)
    await button(wrapper.find('[data-test="question"]'), 'Yes').trigger('click')
    expect(wrapper.find('[data-test="question"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('1 ready to go')

    const option = wrapper.find('[data-test="option"]')
    const name = option.find('.v-card-title').text().replace('Ready', '').trim()
    await button(option, 'Use this').trigger('click')
    await vi.dynamicImportSettled()

    expect(ctx.app.meal(ctx.app.cell(1, 'main')?.mealId)?.name).toBe(name)
    expect(ctx.app.cell(1, 'main')?.locked).toBe(true)
    expect(ctx.router.currentRoute.value.name).toBe('today')
  })

  it('narrows by meat or dairy, with parve fitting either', async () => {
    const ctx = await setup()
    const wrapper = await mountAt('/rescue', ctx)
    const options = () => wrapper.findAll('[data-test="option"]').map((o) => o.text())
    await chip(wrapper, 'Meat').trigger('click')
    expect(options()).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Hot dogs'),
        expect.stringContaining('French fries'),
      ]),
    )
    await chip(wrapper, 'Dairy').trigger('click')
    expect(options()).toEqual([expect.stringContaining('French fries')])
  })

  it('explains rescue meals when a slot has none', async () => {
    const ctx = await setup()
    const wrapper = await mountAt('/rescue', ctx)
    await chip(wrapper, "Kids' take-along").trigger('click')
    expect(wrapper.text()).toContain("You don't have any rescue meals for Kids' take-along")
    expect(wrapper.find('a[href="/meals"]').exists()).toBe(true)
  })

  it('starts over', async () => {
    const ctx = await setup()
    const wrapper = await mountAt('/rescue', ctx)
    await chip(wrapper, "Kids' light meal").trigger('click')
    await chip(wrapper, 'Either').trigger('click')
    await button(wrapper.find('[data-test="question"]'), 'No').trigger('click')

    await button(wrapper, 'Start over').trigger('click')
    expect(chip(wrapper, 'Main meal').classes()).toContain('bg-primary')
    expect(wrapper.find('[data-test="question"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-test="option"]')).toHaveLength(2)
  })
})
