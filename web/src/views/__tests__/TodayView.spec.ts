import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { getStorage } from '@/storage'
import { mountAt, setup } from './todayRescueSetup'

describe('TodayView', () => {
  beforeEach(() => {
    // Monday of week A in the starter template's rotation.
    vi.useFakeTimers({ now: new Date(2026, 9, 12, 9, 0), toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('offers the starter template on first run and loads it', async () => {
    const ctx = await setup({ empty: true })
    const wrapper = await mountAt('/', ctx)
    expect(wrapper.text()).toContain('placeholder names')

    const starterBtn = wrapper.findAll('button').find((b) => b.text().includes('starter template'))
    await starterBtn!.trigger('click')
    await vi.dynamicImportSettled()
    await flushPromises()

    expect(ctx.app.household.meals.length).toBeGreaterThan(0)
    expect(ctx.app.plan.cells.some((c) => c.mealId)).toBe(true)
    expect(ctx.app.today).toBe(1) // the rotation starts this week
    expect(wrapper.text()).toContain('Monday A')
  })

  it("shows today's meals by slot", async () => {
    const ctx = await setup()
    const wrapper = await mountAt('/', ctx)
    const main = ctx.app.meal(ctx.app.cell(1, 'main')?.mealId)!
    expect(wrapper.text()).toContain('Main meal')
    expect(wrapper.text()).toContain(main.name)
    expect(wrapper.text()).not.toContain('Friday lunch')
    expect(wrapper.find('a[href="/rescue"]').exists()).toBe(true)
  })

  it("answers this week's questions", async () => {
    const ctx = await setup()
    const wrapper = await mountAt('/', ctx)
    const card = wrapper
      .findAll('.v-card')
      .find((c) => c.text().includes('Any Shabbos leftovers for your Monday lunch?'))!
    // Until she says yes, the backup meal stays on the plan.
    expect(card.find('[data-test="answer"]').text()).toContain('backup')

    await card
      .findAll('button')
      .find((b) => b.text() === 'Yes')!
      .trigger('click')
    expect(ctx.app.cell(1, 'lunch')?.specialActive).toBe(true)
    expect(card.find('[data-test="answer"]').text()).toContain('Shabbos leftovers')

    await card
      .findAll('button')
      .find((b) => b.text() === 'No')!
      .trigger('click')
    expect(ctx.app.cell(1, 'lunch')?.specialActive).toBe(false)
    expect(card.find('[data-test="answer"]').text()).toContain('backup')
  })

  it("lists tonight's prep for tomorrow and remembers ticks", async () => {
    const ctx = await setup()
    const items = ctx.app.prepFor(2).items
    expect(items.length).toBeGreaterThan(0)
    const wrapper = await mountAt('/', ctx)
    expect(wrapper.text()).toContain(items[0]!.text)

    await wrapper.find('input[type="checkbox"]').setValue(true)
    await flushPromises()
    expect(await getStorage().getItem('prep-checked')).toEqual({
      list: '2026-10-13',
      done: [`${items[0]!.slotId}:${items[0]!.text}`],
    })
  })

  it('has nothing to prep on Friday night', async () => {
    vi.setSystemTime(new Date(2026, 9, 16, 21, 0))
    const ctx = await setup()
    const wrapper = await mountAt('/', ctx)
    expect(wrapper.text()).toContain('Nothing to prep tonight')
  })

  it('shows a message passed in navigation state, once', async () => {
    const ctx = await setup()
    const wrapper = await mountAt('/', ctx, { snackbar: 'Hot dogs is on the plan' })
    expect(document.body.textContent).toContain('Hot dogs is on the plan')
    expect(ctx.router.options.history.state.snackbar).toBeUndefined()
    wrapper.unmount()
  })
})
