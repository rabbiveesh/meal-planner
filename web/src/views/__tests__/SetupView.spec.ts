import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/dom'
import { flushPromises } from '@vue/test-utils'

import { emptyData, exportJson } from '@/data/repository'
import { shortWeekday } from '@/lib/labels'
import { mountComponent, setupStore } from '@/test-utils'
import SetupView from '@/views/SetupView.vue'

async function setup() {
  const store = await setupStore()
  return { ...store, ...(await mountComponent(SetupView, store)) }
}

describe('SetupView', () => {
  it('adds a person', async () => {
    const { app, user } = await setup()
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add person' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Enter a name')).toBeInTheDocument()
    const kind = within(within(dialog).getByRole('group', { name: 'Adult or child' }))
    expect(kind.getByRole('button', { name: 'Child' })).toBePressed()

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Shoshi')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(app.household.eaters[app.household.eaters.length - 1]).toMatchObject({
      name: 'Shoshi',
      kind: 'child',
    })
  })

  it('removes a meal of the day and everything that pointed at it', async () => {
    const { app, user } = await setup()
    app.regenerate()
    expect(app.data.plan.cells.some((c) => c.slotId === 'lunch')).toBe(true)

    await user.click(screen.getByRole('listitem', { name: 'Our lunch' }))
    const editor = await screen.findByRole('dialog', { name: 'Edit meal of the day' })
    await user.click(within(editor).getByRole('button', { name: 'Remove' }))
    const confirm = await screen.findByRole('dialog', { name: 'Remove Our lunch?' })
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }))

    const h = app.household
    expect(h.slots.some((s) => s.id === 'lunch')).toBe(false)
    expect(h.meals.some((m) => m.slots.includes('lunch'))).toBe(false)
    expect(h.rules?.specialDays?.some((s) => s.slotId === 'lunch')).toBe(false)
    expect(app.data.plan.cells.some((c) => c.slotId === 'lunch')).toBe(false)
    // The core still works on the edited data (it must cross the wasm boundary cleanly).
    app.regenerate()
    expect(app.checkDay(0)).toEqual([])
  })

  it('reorders meals of the day', async () => {
    const { app, user } = await setup()
    const [first, second] = app.household.slots
    await user.click(screen.getByRole('button', { name: `Move ${first!.name} down` }))
    expect(app.household.slots.slice(0, 2).map((s) => s.id)).toEqual([second!.id, first!.id])
  })

  it('sets cook-fresh days', async () => {
    const { app, user } = await setup()
    const days = within(screen.getByRole('group', { name: 'Days you can cook fresh' }))
    const sunday = days.getByRole('button', { name: shortWeekday(0) })
    expect(sunday).not.toBePressed()
    await user.click(sunday)
    expect(sunday).toBePressed()
    expect(app.household.rules?.freshDays).toEqual([0, 2])
  })

  it('only accepts a Sunday for the rotation start', async () => {
    const { app, user } = await setup()
    const input = screen.getByRole('textbox', { name: 'Week A starts on Sunday' })
    await user.clear(input)
    await user.type(input, '10/13/2026{Enter}')
    expect(await screen.findByText('Pick a Sunday')).toBeInTheDocument()
    expect(app.data.rotationStart).toBe('2026-10-11')

    await user.clear(input)
    await user.type(input, '10/18/2026{Enter}')
    expect(app.data.rotationStart).toBe('2026-10-18')
  })

  it('restores a backup after asking, and explains a bad file', async () => {
    const { app, user } = await setup()
    const fileInput = screen.getByLabelText('Restore from backup')

    await user.upload(fileInput, new File(['nope'], 'x.json', { type: 'application/json' }))
    await flushPromises()
    expect(await screen.findByText(/isn't a meal planner backup/)).toBeInTheDocument()
    expect(app.household.meals.length).toBeGreaterThan(0)

    const backup = exportJson(emptyData(new Date(2026, 9, 11)))
    await user.upload(fileInput, new File([backup], 'backup.json', { type: 'application/json' }))
    await flushPromises()
    const confirm = await screen.findByRole('dialog', { name: 'Restore this backup?' })
    await user.click(within(confirm).getByRole('button', { name: 'Restore' }))
    expect(app.household.meals).toHaveLength(0)
  })

  it('loads the starter template after asking', async () => {
    const { app, user } = await setup()
    app.replaceAll(emptyData(new Date(2026, 9, 18)))
    await flushPromises()
    await user.click(screen.getByRole('button', { name: 'Load starter template' }))
    const confirm = await screen.findByRole('dialog', { name: 'Load the starter template?' })
    await user.click(within(confirm).getByRole('button', { name: 'Replace everything' }))
    expect(app.household.meals.length).toBeGreaterThan(0)
    expect(app.data.rotationStart).toBe('2026-10-18')
  })
})
