import { beforeEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import { emptyData, exportJson, importJson } from '@/data/repository'
import starter from '@/data/templates/starter.json'
import { useDriver } from '@/storage'
import { useAppStore } from '@/stores/app'
import SetupView from '@/views/SetupView.vue'

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
  const wrapper = mount(() => h(components.VApp, () => h(SetupView)), {
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

describe('SetupView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('adds a person', async () => {
    const { app } = await setup()
    await click(q('[data-test=add-eater]'))
    await click(q('[data-test=save]'))
    expect(document.body.textContent).toContain('Enter a name')

    await type(q('.v-dialog [data-test=name] input'), 'Shoshi')
    await click(q('.v-dialog [data-test=save]'))
    expect(app.household.eaters[app.household.eaters.length - 1]).toMatchObject({
      name: 'Shoshi',
      kind: 'child',
    })
  })

  it('removes a meal of the day and everything that pointed at it', async () => {
    const { app } = await setup()
    app.regenerate()
    expect(app.plan.cells.some((c) => c.slotId === 'lunch')).toBe(true)

    await click(byText('[data-test=slot]', 'Our lunch'))
    await click(q('[data-test=remove]'))
    await click(q('[data-test=confirm]'))

    const h = app.household
    expect(h.slots.some((s) => s.id === 'lunch')).toBe(false)
    expect(h.meals.some((m) => m.slots.includes('lunch'))).toBe(false)
    expect(h.rules?.specialDays?.some((s) => s.slotId === 'lunch')).toBe(false)
    expect(app.plan.cells.some((c) => c.slotId === 'lunch')).toBe(false)
    // The core still works on the edited data (it must cross the wasm boundary cleanly).
    app.regenerate()
    expect(app.checkDay(0)).toEqual([])
  })

  it('reorders meals of the day', async () => {
    const { app } = await setup()
    const [first, second] = app.household.slots
    await click(q(`[aria-label="Move ${first!.name} down"]`))
    expect(app.household.slots.slice(0, 2).map((s) => s.id)).toEqual([second!.id, first!.id])
  })

  it('sets cook-fresh days', async () => {
    const { app } = await setup()
    await click(byText('.v-card', 'Weekly rules').querySelectorAll<HTMLElement>('.v-chip')[0]!)
    expect(app.household.rules?.freshDays).toEqual([0, 2])
  })

  it('only accepts a Sunday for the rotation start', async () => {
    const { app, wrapper } = await setup()
    const input = wrapper.findComponent(components.VDateInput)
    await input.vm.$emit('update:modelValue', new Date(2026, 9, 13))
    expect(wrapper.text()).toContain('Pick a Sunday')
    expect(app.data.rotationStart).toBe('2026-10-11')

    await input.vm.$emit('update:modelValue', new Date(2026, 9, 18))
    expect(app.data.rotationStart).toBe('2026-10-18')
  })

  it('restores a backup after asking, and explains a bad file', async () => {
    const { app, wrapper } = await setup()
    const fileInput = wrapper.findComponent(components.VFileInput)

    await fileInput.vm.$emit('update:modelValue', new File(['nope'], 'x.json'))
    await flushPromises()
    expect(q('[data-test=error]').textContent).toContain("isn't a meal planner backup")
    expect(app.household.meals.length).toBeGreaterThan(0)

    const backup = exportJson(emptyData(new Date(2026, 9, 11)))
    await fileInput.vm.$emit('update:modelValue', new File([backup], 'backup.json'))
    await flushPromises()
    await click(q('[data-test=confirm-restore]'))
    expect(app.household.meals).toHaveLength(0)
  })

  it('loads the starter template after asking', async () => {
    const { app } = await setup()
    app.replaceAll(emptyData(new Date(2026, 9, 18)))
    await flushPromises()
    await click(q('[data-test=starter]'))
    await click(q('[data-test=confirm]'))
    expect(app.household.meals.length).toBeGreaterThan(0)
    expect(app.data.rotationStart).toBe('2026-10-18')
  })
})
