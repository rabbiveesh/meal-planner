// A fresh app store for tests: Pinia over in-memory storage, optionally with the starter
// template. Kept apart from test-utils.ts so store tests don't load Vuetify or the router.
import { createPinia, setActivePinia } from 'pinia'

import { importJson } from '@/data/repository'
import starter from '@/data/templates/starter.json'
import { useDriver } from '@/storage'
import { useAppStore } from '@/stores/app'

export interface StoreOptions {
  /** Load the starter template. Default true. */
  starter?: boolean
  /** Generate a plan after loading the template. Default false. */
  regenerate?: boolean
}

/** A fresh Pinia over in-memory storage, with the app store loaded. */
export async function setupStore({
  starter: withStarter = true,
  regenerate = false,
}: StoreOptions = {}) {
  useDriver()
  const pinia = createPinia()
  setActivePinia(pinia)
  const app = useAppStore()
  await app.load()
  if (withStarter) {
    app.replaceAll(importJson(JSON.stringify(starter)))
    if (regenerate) app.regenerate()
  }
  return { app, pinia }
}
