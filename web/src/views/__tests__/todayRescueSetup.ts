import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { RouterView, createRouter, createMemoryHistory } from 'vue-router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { h } from 'vue'
import { VApp } from 'vuetify/components'

import { importJson } from '@/data/repository'
import starter from '@/data/templates/starter.json'
import { useDriver } from '@/storage'
import { useAppStore } from '@/stores/app'

// VSnackbar positions itself with visualViewport, which jsdom lacks.
// TODO: move next to the ResizeObserver stub in src/test-setup.ts.
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

/** A fresh store (in-memory storage, starter template loaded unless `empty`) and router. */
export async function setup(options: { empty?: boolean } = {}) {
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
      { path: '/', name: 'today', component: () => import('@/views/TodayView.vue') },
      { path: '/rescue', name: 'rescue', component: () => import('@/views/RescueView.vue') },
      { path: '/meals', name: 'meals', component: Stub },
      { path: '/setup', name: 'setup', component: Stub },
    ],
  })
  return { app, pinia, router }
}

/** Mounts the app shell's router view, after navigating to `path`. */
export async function mountAt(
  path: string,
  ctx: Awaited<ReturnType<typeof setup>>,
  state?: Record<string, string>,
) {
  await ctx.router.push({ path, state })
  await ctx.router.isReady()
  const wrapper = mount(
    { render: () => h(VApp, () => h(RouterView)) },
    {
      global: {
        plugins: [ctx.pinia, ctx.router, createVuetify({ components, directives })],
      },
      attachTo: document.body,
    },
  )
  await flushPromises()
  return wrapper
}
