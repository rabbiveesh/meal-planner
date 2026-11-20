import { createPinia, setActivePinia } from 'pinia'
import { defineDriver } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Account } from '@/account'
import { importJson } from '@/data/repository'
import starter from '@/data/templates/starter.json'
import { getDeviceStorage, useDeviceDriver, useDriver, usePhoneStorage } from '@/storage'
import { useAccountStore } from '@/stores/account'
import { useAppStore } from '@/stores/app'

/** Who sign-in says is signed in; the test calls it to sign in or out. */
let announce: (account: Account | null) => Promise<void> = async () => {}
vi.mock('@/account', () => ({
  watchAccount: (onChange: (account: Account | null) => Promise<void>) => {
    announce = onChange
    void onChange(null)
    return () => {}
  },
  signInWithGoogle: vi.fn<() => Promise<void>>(),
  signOutOfAccount: vi.fn<() => Promise<void>>(),
}))

/** The account's data in the cloud, standing in for Firestore. */
let cloud = memoryDriver()
vi.mock('@/storage', async (actual) => {
  const storage = await actual<typeof import('@/storage')>()
  return { ...storage, useAccountStorage: () => storage.useDriver(cloud) }
})

/** A cloud that never confirms a write, like Firestore while the phone is offline. */
const offline = defineDriver(() => ({
  ...memoryDriver(),
  name: 'offline',
  setItem: () => new Promise<void>(() => {}),
}))

const someone: Account = { uid: 'u1', name: 'Someone', email: null }
const meals = () => useAppStore().household.meals.map((m) => m.name)
const phoneChanges = () => getDeviceStorage().getKeys('changes')

/** A phone with the starter meals, signed out. */
async function phoneWithMeals() {
  useDeviceDriver()
  usePhoneStorage()
  setActivePinia(createPinia())
  const account = useAccountStore()
  account.follow()
  const app = useAppStore()
  await vi.waitFor(() => expect(app.loaded).toBe(true))
  app.replaceAll(importJson(JSON.stringify(starter)))
  await app.save()
  return { app, account }
}

describe('signing in', () => {
  beforeEach(() => {
    cloud = memoryDriver()
    useDriver()
  })

  it('brings what she made on this phone into the account', async () => {
    const { app } = await phoneWithMeals()
    const before = meals()
    await announce(someone)
    await vi.waitFor(async () => expect(await phoneChanges()).toEqual([]))
    expect(await cloud.getKeys!('', {})).not.toEqual([])
    await app.load()
    expect(meals()).toEqual(before)
  })

  it('keeps showing what is on this phone while the account is offline', async () => {
    const { app } = await phoneWithMeals()
    const before = meals()
    cloud = offline()
    await announce(someone)
    expect(app.loaded).toBe(true)
    expect(meals()).toEqual(before)
    // Nothing was confirmed, so the phone still has everything.
    expect((await phoneChanges()).length).toBeGreaterThan(0)
  })

  it('an edit made just before signing in ends up in the account', async () => {
    const { app } = await phoneWithMeals()
    app.setUserName('Typed just now')
    await announce(someone)
    await vi.waitFor(async () => expect(await phoneChanges()).toEqual([]))
    await app.load()
    expect(app.data.userName).toBe('Typed just now')
  })

  it('signing out and in again still shows everything', async () => {
    const { app } = await phoneWithMeals()
    const before = meals()
    await announce(someone)
    await vi.waitFor(async () => expect(await phoneChanges()).toEqual([]))
    await announce(null)
    expect(meals()).toEqual([])
    await announce(someone)
    expect(app.loaded).toBe(true)
    expect(meals()).toEqual(before)
  })
})
