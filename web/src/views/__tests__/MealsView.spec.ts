import { beforeEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import { importJson } from '@/data/repository'
import starter from '@/data/templates/starter.json'
import { useDriver } from '@/storage'
import { useAppStore } from '@/stores/app'
import MealsView from '@/views/MealsView.vue'

// jsdom lacks what Vuetify's overlays measure with.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.visualViewport ??= Object.assign(new EventTarget(), {
  width: 400,
  height: 800,
  offsetLeft: 0,
  offsetTop: 0,
  pageLeft: 0,
  pageTop: 0,
  scale: 1,
  onresize: null,
  onscroll: null,
  onscrollend: null,
}) as VisualViewport

const vuetify = createVuetify({ components, directives })

async function setup() {
  useDriver()
  setActivePinia(createPinia())
  const app = useAppStore()
  await app.load()
  app.replaceAll(importJson(JSON.stringify(starter)))
  // The add button is a layout item, so it needs the app layout around it.
  const wrapper = mount(() => h(components.VApp, () => h(MealsView)), {
    global: { plugins: [vuetify] },
    attachTo: document.body,
  })
  await flushPromises()
  return { app, wrapper }
}

/** Dialogs are teleported out of the wrapper, so look in the whole document. */
function q(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) throw new Error(`nothing matches ${selector}`)
  return el
}

function byText(selector: string, text: string): HTMLElement {
  const el = [...document.querySelectorAll<HTMLElement>(selector)].find((e) =>
    e.textContent?.includes(text),
  )
  if (!el) throw new Error(`no ${selector} with "${text}"`)
  return el
}

async function type(el: HTMLElement, value: string) {
  const input = el.matches('input') ? (el as HTMLInputElement) : el.querySelector('input')!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

async function click(el: HTMLElement) {
  el.click()
  await flushPromises()
}

describe('MealsView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('groups meals by slot and narrows them by search and filter', async () => {
    const { app, wrapper } = await setup()
    const groups = wrapper.findAll('[data-test=group]')
    expect(groups[0]!.text()).toContain(app.household.slots[0]!.name)

    await type(q('[data-test=search] input'), 'hot dog')
    expect(wrapper.text()).toContain('Hot dogs')
    expect(wrapper.text()).not.toContain('Chicken soup')

    await type(q('[data-test=search] input'), '')
    await click(byText('.v-chip', 'Fun'))
    for (const g of wrapper.findAll('[data-test=group]')) expect(g.text()).toContain('Fun')
  })

  it('adds a meal, insisting on a name and a slot', async () => {
    const { app } = await setup()
    const before = app.household.meals.length

    await click(q('[data-test=add]'))
    await click(q('[data-test=save]'))
    expect(app.household.meals).toHaveLength(before)
    expect(document.body.textContent).toContain('Give the meal a name')
    expect(document.body.textContent).toContain('Pick at least one meal slot')

    await type(q('[data-test=name] input'), '  Mujadara ')
    await click(byText('.v-dialog .v-chip', 'Main meal'))
    await click(q('[data-test=save]'))

    const added = app.household.meals.find((m) => m.name === 'Mujadara')
    expect(added).toMatchObject({ slots: ['main'], kashrut: 'parve', prep: 'ahead' })
    expect(app.household.meals).toHaveLength(before + 1)
  })

  it('edits and deletes a meal, clearing it from the plan', async () => {
    const { app, wrapper } = await setup()
    app.regenerate()
    const meal = app.household.meals.find((m) => m.name === 'Hot dogs')!
    app.setCell(0, 'main', meal.id)

    const row = wrapper.findAll('.v-list-item').find((r) => r.text().includes('Hot dogs'))!
    await row.trigger('click')
    await flushPromises()
    await click(q('[data-test=delete]'))
    await click(q('[data-test=confirm]'))

    expect(app.meal(meal.id)).toBeUndefined()
    expect(app.plan.cells.some((c) => c.mealId === meal.id)).toBe(false)
  })
})
