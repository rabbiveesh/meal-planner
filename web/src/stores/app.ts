import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useIntervalFn, useNow, watchDebounced } from '@vueuse/core'
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
} from 'date-fns'

import * as core from '@/core'
import type { Cell, Household, Meal, Plan, SpecialDay } from '@/core'
import { emptyData, loadAppData, saveAppData } from '@/data/repository'
import type { AppData } from '@/data/schema'
import {
  removeEater as withoutEater,
  removeSlot as withoutSlot,
  planWithoutSlot,
} from '@/lib/household'
import { rotationDay } from '@/lib/rotation'

/**
 * Plain copies for the wasm boundary. Reading through the reactive proxy (rather than toRaw)
 * keeps every field tracked, so computeds built on core queries update on deep edits.
 */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export const useAppStore = defineStore('app', () => {
  const data = ref<AppData>(emptyData())
  const loaded = ref(false)
  const firstRun = ref(false)
  const loadError = ref<string | null>(null)

  const household = computed(() => data.value.household)

  // Ticks so an app left open past midnight moves on to the new day.
  const now = useNow({ scheduler: (cb) => useIntervalFn(cb, 60_000) })
  const today = computed(() => rotationDay(now.value, data.value.rotationStart))
  /**
   * The two weeks the app is currently planning for: from this week's Sunday, or from
   * tomorrow when today is Shabbos (the coming week is what matters then).
   */
  const windowStart = computed(() =>
    startOfWeek(addDays(startOfDay(now.value), 1), { weekStartsOn: 0 }),
  )

  /** The calendar date (yyyy-MM-dd) a rotation day falls on within the planning window. */
  function dateOf(day: number): string {
    const offset = (day - rotationDay(windowStart.value, data.value.rotationStart) + 14) % 14
    return format(addDays(windowStart.value, offset), 'yyyy-MM-dd')
  }

  const answerKey = (day: number, slotId: string) => `${dateOf(day)}|${slotId}`

  /**
   * The stored rotation (`data.plan`) with the planning window's dated special-day answers
   * applied as `specialActive`. Read-only: edits go through the actions below, never back
   * into `data.plan` from here.
   */
  const planWithAnswers = computed<Plan>(() => {
    const answers = data.value.specialAnswers
    const cells: Cell[] = data.value.plan.cells.map((c) => ({
      ...c,
      specialActive: answers[answerKey(c.day, c.slotId)] === true,
    }))
    for (const [key, yes] of Object.entries(answers)) {
      if (!yes) continue
      const [date, slotId] = key.split('|') as [string, string]
      const offset = differenceInCalendarDays(parseISO(date), windowStart.value)
      if (offset < 0 || offset >= 14) continue
      const day = rotationDay(parseISO(date), data.value.rotationStart)
      if (!cells.some((c) => c.day === day && c.slotId === slotId)) {
        cells.push({ day, slotId, specialActive: true })
      }
    }
    return { cells }
  })

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
    data.value = plain(next)
    firstRun.value = false
    loadError.value = null
  }

  // --- Plan -------------------------------------------------------------

  /** A cell as planned this cycle, i.e. from `planWithAnswers`. */
  function cell(day: number, slotId: string): Cell | undefined {
    return planWithAnswers.value.cells.find((c) => c.day === day && c.slotId === slotId)
  }

  function storedCell(day: number, slotId: string): Cell | undefined {
    return data.value.plan.cells.find((c) => c.day === day && c.slotId === slotId)
  }

  function regenerate() {
    const seed = Math.floor(Math.random() * 2 ** 32)
    data.value.plan = core.generatePlan(plain(household.value), plain(data.value.plan), seed)
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
    const c = storedCell(day, slotId)
    if (c) c.locked = locked
  }

  /** The special day (e.g. "Shabbos leftovers") that applies to a cell, if any. */
  function special(day: number, slotId: string): SpecialDay | undefined {
    return (household.value.rules?.specialDays ?? []).find(
      (s) => s.day === day % 7 && s.slotId === slotId,
    )
  }

  /** Her answer to a special-day question for this cycle: true, false, or undefined if not asked. */
  function specialAnswer(day: number, slotId: string): boolean | undefined {
    return data.value.specialAnswers[answerKey(day, slotId)]
  }

  function setSpecialActive(day: number, slotId: string, active: boolean) {
    const answers = data.value.specialAnswers
    // Answers older than the previous cycle can never apply again.
    const cutoff = format(subDays(windowStart.value, 14), 'yyyy-MM-dd')
    for (const key of Object.keys(answers)) if (key < cutoff) delete answers[key]
    answers[answerKey(day, slotId)] = active
  }

  // --- Notes ------------------------------------------------------------

  const noteKey = (date: string, slotId: string) => `${date}|${slotId}`

  /** Her note on a slot's meal on `date` (yyyy-MM-dd), or '' if none. */
  function note(date: string, slotId: string): string {
    return data.value.notes[noteKey(date, slotId)] ?? ''
  }

  /** Saves her note on a slot's meal on `date`; a blank note is removed. */
  function setNote(date: string, slotId: string, text: string) {
    if (text.trim()) data.value.notes[noteKey(date, slotId)] = text
    else delete data.value.notes[noteKey(date, slotId)]
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
    data.value.household = plain(h)
  }

  /** Removes a slot and every reference to it: meals, rules and plan cells. */
  function removeSlot(slotId: string) {
    data.value.household = withoutSlot(plain(household.value), slotId)
    data.value.plan = planWithoutSlot(data.value.plan, slotId)
  }

  function removeEater(eaterId: string) {
    data.value.household = withoutEater(plain(household.value), eaterId)
  }

  /** Sets the Sunday (yyyy-MM-dd) that starts week A. */
  function setRotationStart(sunday: string) {
    data.value.rotationStart = sunday
  }

  /** Sets the time of day (HH:mm) from which Today opens on tomorrow. */
  function setTomorrowFrom(time: string) {
    data.value.tomorrowFrom = time
  }

  // --- Core queries -------------------------------------------------------

  const mealOptions = (day: number, slotId: string) =>
    core.mealOptions(plain(household.value), plain(planWithAnswers.value), day, slotId).options
  const checkDay = (day: number) =>
    core.checkDay(plain(household.value), plain(planWithAnswers.value), day).conflicts
  const prepFor = (day: number) =>
    core.prepFor(plain(household.value), plain(planWithAnswers.value), day)
  const shoppingNeeds = () =>
    core.shoppingNeeds(plain(household.value), plain(planWithAnswers.value)).items
  const rescue = (query: core.RescueQuery) =>
    core.rescue(plain(household.value), plain(planWithAnswers.value), query)

  return {
    data,
    loaded,
    firstRun,
    loadError,
    household,
    planWithAnswers,
    today,
    dateOf,
    load,
    replaceAll,
    cell,
    regenerate,
    setCell,
    setLocked,
    special,
    specialAnswer,
    setSpecialActive,
    note,
    setNote,
    meal,
    saveMeal,
    deleteMeal,
    setHousehold,
    removeSlot,
    removeEater,
    setRotationStart,
    setTomorrowFrom,
    mealOptions,
    checkDay,
    prepFor,
    shoppingNeeds,
    rescue,
  }
})
