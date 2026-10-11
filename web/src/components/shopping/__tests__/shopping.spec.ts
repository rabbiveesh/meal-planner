import { beforeEach, describe, expect, it } from 'vitest'
import type { Component } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import { importJson } from '@/data/repository'
import starter from '@/data/templates/starter.json'
import { useDriver } from '@/storage'
import { useAppStore } from '@/stores/app'
import { useShoppingStore } from '@/stores/shopping'
import ShoppingView from '@/views/ShoppingView.vue'
import PantryCheck from '../PantryCheck.vue'
import ShoppingList from '../ShoppingList.vue'

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
const mountIt = (component: Component) =>
  mount(component, { global: { plugins: [vuetify] }, attachTo: document.body })

async function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const app = useAppStore()
  await app.load()
  app.replaceAll(importJson(JSON.stringify(starter)))
  // Staples only, so the test does not depend on the starter template's meals.
  app.data.plan = { cells: [] }
  const shopping = useShoppingStore()
  shopping.importStaples('Dairy:\nMilk\nYogurt\nBakery:\nPitas')
  return { app, shopping }
}

function button(wrapper: ReturnType<typeof mount>, text: string) {
  const b = wrapper.findAll('button').find((x) => x.text().includes(text))
  if (!b) throw new Error(`no button "${text}"`)
  return b
}

describe('shopping screens', () => {
  beforeEach(() => {
    useDriver()
    document.body.innerHTML = ''
  })

  it('pantry check goes one item at a time and counts progress', async () => {
    const { app } = await setup()
    const wrapper = mountIt(PantryCheck)
    expect(wrapper.text()).toContain('0 of 3 checked')
    expect(wrapper.find('.text-h4').text()).toBe('Milk')

    await button(wrapper, 'Have enough').trigger('click')
    expect(wrapper.find('.text-h4').text()).toBe('Yogurt')
    await button(wrapper, 'Need').trigger('click')
    expect(wrapper.text()).toContain('2 of 3 checked')
    expect(app.data.shopping.marks).toEqual({ milk: 'have', yogurt: 'need' })
    wrapper.unmount()
  })

  it('shopping list shows everything not marked "have" and ticks items off', async () => {
    const { app, shopping } = await setup()
    shopping.mark(shopping.items[0]!, 'have')
    const wrapper = mountIt(ShoppingList)
    expect(wrapper.text()).not.toContain('Milk')
    expect(wrapper.text()).toContain('Yogurt')
    expect(wrapper.text()).toContain('0 of 2 in the cart')

    const pitas = wrapper.findAll('.v-list-item').find((x) => x.text().includes('Pitas'))!
    await pitas.trigger('click')
    expect(app.data.shopping.bought).toEqual(['pitas'])
    expect(wrapper.text()).toContain('1 of 2 in the cart')
    wrapper.unmount()
  })

  it('a new trip asks first, then clears the check', async () => {
    const { app, shopping } = await setup()
    shopping.mark(shopping.items[0]!, 'have')
    const wrapper = mountIt(ShoppingView)
    await button(wrapper, 'New trip').trigger('click')
    await flushPromises()
    expect(app.data.shopping.marks).toEqual({ milk: 'have' })

    const confirm = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Start new trip'),
    )!
    confirm.click()
    await flushPromises()
    expect(app.data.shopping.marks).toEqual({})
    expect(app.data.shopping.staples).toHaveLength(3)
    wrapper.unmount()
  })
})
