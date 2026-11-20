import { screen } from '@testing-library/dom'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import ConflictsCard from '@/components/app/ConflictsCard.vue'
import { importJson } from '@/data/repository'
import starter from '@/data/templates/starter.json'
import { useDeviceDriver, useDriver } from '@/storage'
import { useAppStore } from '@/stores/app'
import { mountComponent } from '@/test-utils'

async function phone() {
  useDeviceDriver()
  const pinia = createPinia()
  setActivePinia(pinia)
  const app = useAppStore()
  await app.load()
  return { app, pinia }
}

/** Two phones that renamed the same meal at once; returns the first, which has seen both. */
async function renamedOnTwoPhones() {
  useDriver()
  const first = await phone()
  first.app.replaceAll(importJson(JSON.stringify(starter)))
  await first.app.save()
  const second = await phone()
  const meal = first.app.household.meals[0]!
  first.app.saveMeal({ ...meal, name: 'Soup on Sunday' })
  await first.app.save()
  second.app.saveMeal({ ...meal, name: 'Soup on Monday' })
  await second.app.save()
  setActivePinia(first.pinia)
  await first.app.load()
  return first
}

describe('changed on two phones at once', () => {
  it('asks which version is right, and keeps the one she picks', async () => {
    const first = await renamedOnTwoPhones()
    const { user } = await mountComponent(ConflictsCard, first)

    expect(screen.getByText(/was changed on two phones/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Soup on Sunday/ }))

    expect(screen.queryByText(/was changed on two phones/)).not.toBeInTheDocument()
    expect(first.app.household.meals.some((m) => m.name === 'Soup on Sunday')).toBe(true)
    expect(first.app.household.meals.some((m) => m.name === 'Soup on Monday')).toBe(false)
  })

  it('shows nothing when the phones agree', async () => {
    const { app, pinia } = await phone()
    app.replaceAll(importJson(JSON.stringify(starter)))
    await mountComponent(ConflictsCard, { pinia })
    expect(screen.queryByText(/two phones/)).not.toBeInTheDocument()
  })
})
