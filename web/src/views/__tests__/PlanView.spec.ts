import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { RouterView, createMemoryHistory, createRouter } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { h } from 'vue'

import { importJson } from '@/data/repository'
import starter from '@/data/templates/starter.json'
import { useDriver } from '@/storage'
import { useAppStore } from '@/stores/app'

// Vuetify overlays (dialogs) position against the visual viewport; jsdom has none.
// TODO: move to src/test-setup.ts alongside the ResizeObserver stub.
globalThis.visualViewport ??= Object.assign(new EventTarget(), {
  width: 1024,
  height: 768,
  offsetLeft: 0,
  offsetTop: 0,
  pageLeft: 0,
  pageTop: 0,
  scale: 1,
  onresize: null,
  onscroll: null,
  onscrollend: null,
}) as VisualViewport

const Stub = { template: '<div />' }

let mounted: { unmount(): void } | undefined
function cleanUp() {
  mounted?.unmount()
  mounted = undefined
  document.body.innerHTML = ''
}

async function mountAt(path: string, options: { empty?: boolean } = {}) {
  useDriver()
  const pinia = createPinia()
  setActivePinia(pinia)
  const app = useAppStore()
  await app.load()
  if (!options.empty) {
    app.replaceAll(importJson(JSON.stringify(starter)))
    app.regenerate()
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/plan', name: 'plan', component: () => import('@/views/PlanView.vue') },
      { path: '/print/:view', name: 'print', component: () => import('@/views/PrintView.vue') },
      { path: '/meals', name: 'meals', component: Stub },
      { path: '/setup', name: 'setup', component: Stub },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(
    { render: () => h(components.VApp, () => h(RouterView)) },
    {
      global: { plugins: [pinia, router, createVuetify({ components, directives })] },
      attachTo: document.body,
    },
  )
  mounted = wrapper
  await flushPromises()
  return { app, router, wrapper }
}

/** Clicks the first element under `root` matching `selector` whose text contains `text`. */
async function clickText(selector: string, text: string, root: ParentNode = document.body) {
  const el = [...root.querySelectorAll<HTMLElement>(selector)].find((e) =>
    e.textContent?.includes(text),
  )
  if (!el) throw new Error(`No ${selector} containing "${text}"`)
  el.click()
  await settle()
}

/** Lets router navigation and Vue updates finish. */
async function settle() {
  await new Promise((r) => setTimeout(r))
  await flushPromises()
}

function dayCard(label: string): HTMLElement {
  const card = [...document.querySelectorAll<HTMLElement>('.v-card')].find((c) =>
    c.querySelector('.v-card-title')?.textContent?.includes(label),
  )
  if (!card) throw new Error(`No card for ${label}`)
  return card
}

const dialog = () => document.querySelector<HTMLElement>('.v-overlay--active .v-card')!

describe('PlanView', () => {
  beforeEach(() => {
    // Monday of week A in the starter template's rotation.
    vi.useFakeTimers({ now: new Date(2026, 9, 12, 9, 0), toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanUp()
  })

  it('points to Meals and Setup when there are no meals', async () => {
    const { wrapper } = await mountAt('/plan', { empty: true })
    expect(wrapper.text()).toContain('No meals yet')
    expect(wrapper.find('a[href="/meals"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/setup"]').exists()).toBe(true)
  })

  it('shows one uncrowded chart at a time, week by week', async () => {
    const { app, router, wrapper } = await mountAt('/plan')
    const text = wrapper.text()
    expect(text).toContain('Sunday A')
    expect(text).not.toContain('Sunday B')
    expect(text).toContain('Main meal')
    expect(text).not.toContain("Kids' take-along")
    expect(text).toContain(app.meal(app.cell(1, 'main')?.mealId)!.name)
    // Friday has no main meal, only Friday lunch.
    expect(dayCard('Friday A').textContent).not.toContain('Main meal')
    expect(dayCard('Friday A').textContent).toContain('Friday lunch')
    expect(dayCard('Monday A').textContent).toContain('Today')

    await clickText('.v-tab', 'Take-along')
    await vi.waitFor(() => expect(router.currentRoute.value.query.view).toBe('takeAlong'))
    await settle()
    expect(wrapper.text()).toContain("Kids' take-along")
    expect(wrapper.text()).not.toContain('Main meal')

    await clickText('.v-btn', 'Week B')
    await vi.waitFor(() => expect(router.currentRoute.value.query.week).toBe('B'))
    await settle()
    expect(wrapper.text()).toContain('Sunday B')
    expect(wrapper.text()).not.toContain('Sunday A')
  })

  it('swaps a meal by hand and marks it hand-picked', async () => {
    const { app, wrapper } = await mountAt('/plan')
    const before = app.cell(2, 'main')?.mealId
    await clickText('.v-list-item', 'Main meal', dayCard('Tuesday A'))
    expect(dialog().textContent).toContain('Good fits')

    const choice = app.household.meals.find(
      (m) => m.slots.includes('main') && m.id !== before && m.kashrut === 'parve',
    )!
    await clickText('.v-list-item', choice.name, dialog())

    expect(app.cell(2, 'main')).toMatchObject({ mealId: choice.id, locked: true })
    const card = dayCard('Tuesday A').textContent
    expect(card).toContain(choice.name)
    expect(card).toContain('Hand-picked')
    expect(wrapper.text()).toContain(choice.name)
  })

  it('searches the swap list', async () => {
    await mountAt('/plan')
    await clickText('.v-list-item', 'Main meal', dayCard('Sunday A'))
    const input = dialog().querySelector<HTMLInputElement>('input[type="text"]')!
    input.value = 'mujadara'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    const items = [...dialog().querySelectorAll('.v-list-item')].map((i) => i.textContent)
    expect(items.every((t) => t?.toLowerCase().includes('mujadara'))).toBe(true)
    expect(items.length).toBeGreaterThan(0)
  })

  it('turns on a special day, keeping the backup meal visible', async () => {
    const { app } = await mountAt('/plan?view=takeAlong')
    const backup = app.meal(app.cell(0, 'lunch')?.mealId)!
    await clickText('.v-list-item', 'Our lunch', dayCard('Sunday A'))
    const toggle = [...dialog().querySelectorAll('.v-switch')].find((e) =>
      e.textContent?.includes('Shabbos leftovers'),
    )!
    await clickText('input', '', toggle)
    expect(app.cell(0, 'lunch')?.specialActive).toBe(true)

    const struck = dayCard('Sunday A').querySelector('.text-decoration-line-through')
    expect(struck?.textContent).toContain(backup.name)
    expect(dayCard('Sunday A').textContent).toContain('Shabbos leftovers')
  })

  it('shows kashrut problems on the cell they affect', async () => {
    const { app } = await mountAt('/plan?view=takeAlong')
    // Meat at breakfast, dairy at lunch: the adults wait longer than that.
    app.setCell(0, 'ourBreakfast', 'chicken-salad')
    app.setCell(0, 'lunch', 'protein-shake-with-berries')
    await flushPromises()
    const lunch = [...dayCard('Sunday A').querySelectorAll('.v-list-item')].find((i) =>
      i.textContent?.includes('Our lunch'),
    )!
    expect(lunch.querySelector('.v-alert')?.textContent).toContain('after meat')
  })

  it('makes a new plan after confirming, keeping hand-picked meals', async () => {
    const { app } = await mountAt('/plan')
    app.setCell(3, 'main', 'risotto')
    const spy = vi.spyOn(app, 'regenerate')
    await clickText('.v-btn', 'Make a new plan')
    expect(spy).not.toHaveBeenCalled()
    expect(dialog().textContent).toContain('stay where they are')
    await clickText('.v-btn', 'Make a new plan', dialog())
    expect(spy).toHaveBeenCalledOnce()
    expect(app.cell(3, 'main')?.mealId).toBe('risotto')
  })

  it('opens the printable chart for the current tab', async () => {
    const { router } = await mountAt('/plan?view=breakfast')
    await clickText('.v-btn', 'Print')
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/print/breakfast'))
  })
})

describe('PrintView', () => {
  afterEach(cleanUp)

  it('prints one table per week with the view’s slots as columns', async () => {
    const { app, wrapper } = await mountAt('/print/takeAlong')
    expect(wrapper.text()).toContain('Take-along · Week A')
    expect(wrapper.text()).toContain('Take-along · Week B')
    expect(wrapper.text()).toContain('Rotation started Sunday 11 October 2026')
    const tables = wrapper.findAll('table')
    expect(tables).toHaveLength(2)
    expect(tables[0]!.findAll('thead th').map((t) => t.text())).toEqual([
      '',
      "Kids' take-along",
      'Our lunch',
    ])
    expect(tables[1]!.findAll('tbody tr')).toHaveLength(6)
    expect(tables[1]!.text()).toContain(app.meal(app.cell(9, 'lunch')?.mealId)!.name)
  })

  it('prints with the browser and goes back to the plan', async () => {
    const { router, wrapper } = await mountAt('/print/home')
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    await clickText('.v-btn', 'Print')
    expect(print).toHaveBeenCalledOnce()
    expect(wrapper.find('.no-print').exists()).toBe(true)

    await clickText('.v-btn', 'Back')
    expect(router.currentRoute.value.name).toBe('plan')
    expect(router.currentRoute.value.query.view).toBe('home')
  })

  it('says so for an unknown chart', async () => {
    const { wrapper } = await mountAt('/print/lunchbox')
    expect(wrapper.text()).toContain('There is no chart with that name')
    expect(wrapper.find('table').exists()).toBe(false)
  })
})
