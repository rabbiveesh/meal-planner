// Shared helpers for component and view tests. jsdom stubs, the jest-dom matchers and
// cleanup between tests live in test-setup.ts.
import { screen, waitFor } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { flushPromises, mount } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { h, type Component, type Plugin } from 'vue'
import { RouterView, createMemoryHistory, createRouter, type RouteLocationRaw } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import { routes } from '@/router'

import { setupStore } from './test-store'

export { setupStore, type StoreOptions } from './test-store'

/**
 * Mounts `component` inside VApp (layout items such as v-fab need it) with Vuetify, attached to
 * the document so Testing Library's `screen` also finds dialogs teleported out of the component.
 */
async function mountInApp(component: Component, plugins: Plugin[]) {
  const user = userEvent.setup()
  mount(
    { render: () => h(components.VApp, () => h(component)) },
    {
      global: { plugins: [...plugins, createVuetify({ components, directives })] },
      attachTo: document.body,
    },
  )
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
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(location)
  await router.isReady()
  return { ...(await mountInApp(RouterView, [pinia, router])), router }
}

/**
 * The open dialog showing `text`. Vuetify dialogs have role="dialog" but no accessible name
 * (their card titles are not wired to aria-labelledby), so they are found by their content.
 */
export function findDialog(text: string) {
  return waitFor(() => {
    // The last one is on top, e.g. a confirmation opened from an edit dialog.
    const matches = screen.getAllByRole('dialog').filter((d) => d.textContent?.includes(text))
    const dialog = matches[matches.length - 1]
    if (!dialog) throw new Error(`No open dialog shows "${text}"`)
    return dialog
  })
}
