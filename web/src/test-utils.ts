// Shared helpers for component and view tests. jsdom stubs, the jest-dom matchers and
// cleanup between tests live in test-setup.ts.
import userEvent from '@testing-library/user-event'
import { flushPromises, mount } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { h, type Component, type Plugin } from 'vue'
import { RouterView, createMemoryHistory, createRouter, type RouteLocationRaw } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import App from '@/App.vue'
import { routes } from '@/router'

import { setupStore } from './test-store'

export { setupStore, type StoreOptions } from './test-store'

/**
 * Mounts `component` inside VApp (layout items such as v-fab need it) with Vuetify, attached to
 * the document so Testing Library's `screen` also finds dialogs teleported out of the component.
 */
async function mountInApp(component: Component, plugins: Plugin[]) {
  return mountRoot({ render: () => h(components.VApp, () => h(component)) }, plugins)
}

/** Mounts `root` (which brings its own VApp) with Vuetify, attached to the document. */
async function mountRoot(root: Component, plugins: Plugin[]) {
  const user = userEvent.setup()
  mount(root, {
    global: { plugins: [...plugins, createVuetify({ components, directives })] },
    attachTo: document.body,
  })
  await flushPromises()
  return { user }
}

/** Mounts one component over the given store (default: a fresh one with the starter template). */
export async function mountComponent(component: Component, store?: { pinia: Pinia }) {
  const { pinia } = store ?? (await setupStore())
  return mountInApp(component, [pinia])
}

/**
 * Navigates the app's real routes (in memory) to `location` and mounts the router view over the
 * given store (default: a fresh one with the starter template and a generated plan).
 */
export async function mountRoute(location: RouteLocationRaw, store?: { pinia: Pinia }) {
  const { pinia } = store ?? (await setupStore({ regenerate: true }))
  const router = await memoryRouter(location)
  return { ...(await mountInApp(RouterView, [pinia, router])), router }
}

/**
 * Like mountRoute, but inside the real app shell (App.vue: app bar, bottom navigation), for
 * tests about how a view sits among the shell's layout items.
 */
export async function mountAppAt(location: RouteLocationRaw, store?: { pinia: Pinia }) {
  const { pinia } = store ?? (await setupStore({ regenerate: true }))
  const router = await memoryRouter(location)
  return { ...(await mountRoot(App, [pinia, router])), router }
}

async function memoryRouter(location: RouteLocationRaw) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(location)
  await router.isReady()
  return router
}
