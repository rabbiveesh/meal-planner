import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { importJson, loadChanges, moveChangesFromPhone } from '@/data/repository'
import starter from '@/data/templates/starter.json'
import { getDeviceStorage, useDeviceDriver, useDriver, usePhoneStorage } from '@/storage'
import { useAppStore } from '@/stores/app'

/** A phone with its own device storage, sharing whatever change log is in use. */
async function phone() {
  useDeviceDriver()
  setActivePinia(createPinia())
  const app = useAppStore()
  await app.load()
  return app
}

const starterData = () => importJson(JSON.stringify(starter))

describe('sharing between phones', () => {
  it('what one phone saves, another sees when it opens', async () => {
    useDriver()
    const first = await phone()
    first.replaceAll(starterData())
    await first.save()

    const second = await phone()
    expect(second.household.meals.map((m) => m.name)).toEqual(
      first.household.meals.map((m) => m.name),
    )
  })

  it('the same meal changed on two phones at once asks which one is right', async () => {
    useDriver()
    const first = await phone()
    first.replaceAll(starterData())
    await first.save()
    const second = await phone()
    const id = first.household.meals[0]!.id

    first.saveMeal({ ...first.meal(id)!, name: 'From the first phone' })
    await first.save()
    second.saveMeal({ ...second.meal(id)!, name: 'From the second phone' })
    await second.save()

    await first.load()
    expect(first.conflicts).toHaveLength(1)
    const conflict = first.conflicts[0]!
    expect(conflict.kind).toBe('changed')
    if (conflict.kind !== 'changed') return
    const mine = conflict.options.find(
      (o) =>
        o.edit.op === 'set' &&
        o.edit.value.kind === 'meal' &&
        o.edit.value.value.name === 'From the first phone',
    )!
    first.settle([{ recordId: conflict.recordId, edit: mine.edit }])
    expect(first.conflicts).toEqual([])
    expect(first.meal(id)?.name).toBe('From the first phone')

    await second.load()
    expect(second.conflicts).toEqual([])
    expect(second.meal(id)?.name).toBe('From the first phone')
  })

  it('different things changed on two phones at once are both kept', async () => {
    useDriver()
    const first = await phone()
    first.replaceAll(starterData())
    await first.save()
    const second = await phone()

    first.setUserName('First')
    await first.save()
    second.setTomorrowFrom('19:00')
    await second.save()

    await first.load()
    expect(first.conflicts).toEqual([])
    expect(first.data.userName).toBe('First')
    expect(first.data.tomorrowFrom).toBe('19:00')
  })
})

describe('moving data', () => {
  it('what an older version of the app saved on this phone is still there', async () => {
    useDeviceDriver()
    usePhoneStorage()
    const old = { ...starterData(), userName: 'Saved before' }
    await getDeviceStorage().setItem('app-data', JSON.parse(JSON.stringify(old)))
    setActivePinia(createPinia())
    const app = useAppStore()
    await app.load()

    expect(app.data.userName).toBe('Saved before')
    expect(app.household.meals).toHaveLength(old.household.meals.length)
    expect(await getDeviceStorage().hasItem('app-data')).toBe(false)
    // And it keeps coming back from the change log.
    await app.load()
    expect(app.data.userName).toBe('Saved before')
  })

  it('signing in brings what she made on this phone into the account', async () => {
    useDeviceDriver()
    usePhoneStorage()
    setActivePinia(createPinia())
    const app = useAppStore()
    await app.load()
    app.replaceAll(starterData())
    await app.save()
    const meals = app.household.meals.map((m) => m.name)

    useDriver() // the account's (empty) data
    await moveChangesFromPhone()
    await app.load()
    expect(app.household.meals.map((m) => m.name)).toEqual(meals)
    expect(await getDeviceStorage().getKeys('changes')).toEqual([])
  })

  it('a backup restored on one phone replaces everything, for every phone', async () => {
    useDriver()
    const first = await phone()
    first.replaceAll(starterData())
    await first.save()
    first.replaceAll({ ...starterData(), household: { ...starterData().household, meals: [] } })
    await first.save()
    const second = await phone()
    expect(second.household.meals).toEqual([])
    expect((await loadChanges()).length).toBeGreaterThan(0)
  })
})
