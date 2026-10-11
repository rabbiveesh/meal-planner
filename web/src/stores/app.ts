import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { watchDebounced } from '@vueuse/core'

import * as core from '@/core'
import type { Cell, Household, Meal, Plan } from '@/core'
import { emptyData, loadAppData, saveAppData } from '@/data/repository'
import type { AppData } from '@/data/schema'
import { rotationDay } from '@/lib/rotation'

/** Plain copies for the wasm boundary (Vue proxies are not needed there). */
function plain<T>(value: T): T {
  return structuredClone(toRaw(value))
}

export const useAppStore = defineStore('app', () => {
  const data = ref<AppData>(emptyData())
  const loaded = ref(false)
  const firstRun = ref(false)
  const loadError = ref<string | null>(null)

  const household = computed(() => data.value.household)
  const plan = computed(() => data.value.plan)
  const today = computed(() => rotationDay(new Date(), data.value.rotationStart))

  async function load() {
    try {
      const saved = await loadAppData()
      firstRun.value = saved == null
      if (saved) data.value = saved
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e)
    }
    loaded.value = true
  }

  watchDebounced(
    data,
    (value) => {
      if (loaded.value && !loadError.value) void saveAppData(plain(value))
    },
    { deep: true, debounce: 300 },
  )

  function replaceAll(next: AppData) {
    data.value = next
    firstRun.value = false
    loadError.value = null
  }

  // --- Plan -------------------------------------------------------------

  function cell(day: number, slotId: string): Cell | undefined {
    return data.value.plan.cells.find((c) => c.day === day && c.slotId === slotId)
  }

  function regenerate() {
    const seed = Math.floor(Math.random() * 2 ** 32)
    data.value.plan = core.generatePlan(plain(household.value), plain(plan.value), seed)
  }

  /** Puts a meal in a cell by hand. Hand-picked cells are locked so regeneration keeps them. */
  function setCell(day: number, slotId: string, mealId: string | null) {
    const cells = data.value.plan.cells.filter((c) => !(c.day === day && c.slotId === slotId))
    cells.push({
      day,
      slotId,
      mealId: mealId ?? undefined,
      locked: mealId != null,
      leftover: false,
    })
    data.value.plan.cells = cells
  }

  function setLocked(day: number, slotId: string, locked: boolean) {
    const c = cell(day, slotId)
    if (c) c.locked = locked
  }

  function setSpecialActive(day: number, slotId: string, active: boolean) {
    const c = cell(day, slotId)
    if (c) c.specialActive = active
    else data.value.plan.cells.push({ day, slotId, specialActive: active })
  }

  // --- Household ----------------------------------------------------------

  function meal(id: string | undefined | null): Meal | undefined {
    return id ? household.value.meals.find((m) => m.id === id) : undefined
  }

  function saveMeal(m: Meal) {
    const meals = household.value.meals
    const i = meals.findIndex((x) => x.id === m.id)
    if (i >= 0) meals.splice(i, 1, m)
    else meals.push(m)
  }

  /** Deletes a meal and clears it from the plan. */
  function deleteMeal(id: string) {
    household.value.meals = household.value.meals.filter((m) => m.id !== id)
    data.value.plan.cells = data.value.plan.cells.filter((c) => c.mealId !== id)
  }

  function setHousehold(h: Household) {
    data.value.household = h
  }

  function setPlan(p: Plan) {
    data.value.plan = p
  }

  // --- Core queries -------------------------------------------------------

  const mealOptions = (day: number, slotId: string) =>
    core.mealOptions(plain(household.value), plain(plan.value), day, slotId).options
  const checkDay = (day: number) =>
    core.checkDay(plain(household.value), plain(plan.value), day).conflicts
  const prepFor = (day: number) => core.prepFor(plain(household.value), plain(plan.value), day)
  const shoppingNeeds = () => core.shoppingNeeds(plain(household.value), plain(plan.value)).items
  const rescue = (query: core.RescueQuery) =>
    core.rescue(plain(household.value), plain(plan.value), query)

  return {
    data,
    loaded,
    firstRun,
    loadError,
    household,
    plan,
    today,
    load,
    replaceAll,
    cell,
    regenerate,
    setCell,
    setLocked,
    setSpecialActive,
    meal,
    saveMeal,
    deleteMeal,
    setHousehold,
    setPlan,
    mealOptions,
    checkDay,
    prepFor,
    shoppingNeeds,
    rescue,
  }
})
