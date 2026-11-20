import { defineStore } from 'pinia'
import type { Unwatch } from 'unstorage'
import { computed, ref, shallowRef } from 'vue'
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
import type {
  Cell,
  EditConflict,
  EntryChange,
  EntryEdit,
  Household,
  Meal,
  Plan,
  SlotDef,
  SpecialDay,
} from '@/core'
import {
  appendChanges,
  deviceId,
  emptyData,
  forgetOldAppData,
  loadChanges,
  loadOldAppData,
  watchChanges,
} from '@/data/repository'
import type { AppData } from '@/data/schema'
import {
  removeEater as withoutEater,
  removeMeal as withoutMeal,
  removeSlot as withoutSlot,
  planWithoutSlot,
  upsert,
} from '@/lib/household'
import { rotationDay } from '@/lib/rotation'

/**
 * Plain copies for the wasm boundary. Reading through the reactive proxy (rather than toRaw)
 * keeps every field tracked, so computeds built on core queries update on deep edits.
 */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Data where nothing is set, not even the settings a new household starts with. */
function blank(): AppData {
  return { ...emptyData(), rotationStart: '', userName: '', tomorrowFrom: '' }
}

export const useAppStore = defineStore('app', () => {
  /**
   * What the app shows and edits. Screens change it freely; a moment later the difference
   * from `saved` is recorded in the change log and saved.
   */
  const data = ref<AppData>(emptyData())
  const loaded = ref(false)
  const firstRun = ref(false)
  const loadError = ref<string | null>(null)
  const saveError = ref<string | null>(null)

  /** The change log; `data` is worked out from it. */
  const changes = shallowRef<EntryChange[]>([])
  const changeIds = new Set<string>()
  /** Things two phones changed at once, waiting for her to pick. */
  const conflicts = shallowRef<EditConflict[]>([])
  /** What the log says, as `data` was last set from it; null while the log is empty. */
  let saved: AppData | null = null
  let device = ''
  let lastAt = 0
  let unwatch: Unwatch | undefined
  /** Changes from other phones that arrived since the log was last read. */
  let arrived: EntryChange[] = []
  /** Saves in flight, in order. */
  let saving: Promise<void> = Promise.resolve()

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

  function addChanges(added: EntryChange[]) {
    const fresh = added.filter((c) => !changeIds.has(c.id))
    for (const c of fresh) changeIds.add(c.id)
    if (fresh.length) changes.value = [...changes.value, ...fresh]
  }

  /** Works out the data from the log, and shows it. */
  function fold() {
    if (changes.value.length === 0) {
      saved = null
      conflicts.value = []
      data.value = emptyData(now.value)
      return
    }
    const ledger = core.foldAppData(changes.value, blank())
    saved = ledger.data
    conflicts.value = ledger.conflicts
    data.value = plain(ledger.data)
  }

  /** Stamps for new changes: strictly increasing, so ids made here never repeat. */
  function stamp() {
    lastAt = Math.max(Date.now(), lastAt + 1)
    return { at: lastAt, device }
  }

  /**
   * Adds changes to the log and starts saving them where the log is kept right now. In the
   * cloud a save only finishes once the phone is online, so nothing waits for it.
   */
  function append(added: EntryChange[]) {
    addChanges(added)
    const write = appendChanges(added).then(
      () => (saveError.value = null),
      (e: unknown) => (saveError.value = e instanceof Error ? e.message : String(e)),
    )
    saving = Promise.all([saving, write]).then(() => undefined)
  }

  /**
   * Records whatever changed in `data` since it was last saved, and starts saving it. Safe
   * to call any time; the app calls it a moment after each edit. The promise settles once
   * every save started so far has finished.
   */
  function save(): Promise<void> {
    if (!loaded.value || loadError.value) return saving
    const after = plain(data.value)
    // Opening the app is not a change: nothing is saved until she changes something. Then
    // the first save also records the settings a new household starts with.
    if (!saved && core.appDataChanges([], emptyData(now.value), after, stamp()).length === 0) {
      return saving
    }
    const added = core.appDataChanges(changes.value, saved ?? blank(), after, stamp())
    if (added.length) {
      append(added)
      saved = core.foldAppData(changes.value, blank()).data
    }
    return saving
  }

  function receive(change: EntryChange) {
    if (changeIds.has(change.id)) return
    arrived.push(change)
    // Several usually arrive together; show them all at once.
    if (loaded.value && arrived.length === 1) queueMicrotask(showArrived)
  }

  function showArrived() {
    // Her own unsaved edits are recorded first, so they are kept alongside the new ones.
    void save()
    addChanges(arrived)
    arrived = []
    fold()
  }

  /** Reads the change log from where it is kept now, and follows changes from other phones. */
  async function load() {
    void save()
    loaded.value = false
    loadError.value = null
    await unwatch?.()
    unwatch = undefined
    changes.value = []
    changeIds.clear()
    arrived = []
    try {
      device = await deviceId()
      // Watch first, so a change saved elsewhere during the load is not missed.
      unwatch = await watchChanges(receive)
      addChanges(await loadChanges())
      addChanges(arrived)
      arrived = []
      fold()
      loaded.value = true
      if (changes.value.length === 0) {
        // Data an older version of the app saved on this phone goes into the log once.
        const old = await loadOldAppData()
        if (old) {
          data.value = old
          await save()
          if (!saveError.value) await forgetOldAppData()
        }
      }
      firstRun.value = changes.value.length === 0
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e)
      loaded.value = true
    }
  }

  watchDebounced(data, () => void save(), { deep: true, debounce: 300 })

  /** Replaces everything, e.g. from a backup, and saves it right away. */
  function replaceAll(next: AppData) {
    data.value = plain(next)
    firstRun.value = false
    void save()
  }

  /** Settles conflicts with her picks, recorded as the newest edits. */
  function settle(edits: EntryEdit[]) {
    void save()
    append(core.recordEdits(changes.value, edits, stamp()))
    fold()
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

  /**
   * Puts a meal in a cell by hand. Hand-picked cells are locked so regeneration keeps them.
   * Picking a meal always wins: if the cell's special day (e.g. Shabbos leftovers) is on for
   * this cycle, it is turned off, so the meal she picked is what gets served.
   */
  function setCell(day: number, slotId: string, mealId: string | null) {
    if (mealId != null && specialAnswer(day, slotId) === true) {
      setSpecialActive(day, slotId, false)
    }
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

  /** Deletes a meal and clears it from the every-week rules and the plan. */
  function deleteMeal(id: string) {
    data.value.household = withoutMeal(plain(household.value), id)
    data.value.plan.cells = data.value.plan.cells.filter((c) => c.mealId !== id)
  }

  function setHousehold(h: Household) {
    data.value.household = plain(h)
  }

  /**
   * Adds or updates a slot. A hand-written slot loses its planned meals, so they don't
   * linger in tonight's prep or the shopping list.
   */
  function saveSlot(slot: SlotDef) {
    const h = plain(household.value)
    data.value.household = { ...h, slots: upsert(h.slots, plain(slot)) }
    if (slot.handWritten) data.value.plan = planWithoutSlot(data.value.plan, slot.id)
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

  /** Sets the name the welcome greets her by. */
  function setUserName(name: string) {
    data.value.userName = name
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
    saveError,
    conflicts,
    household,
    planWithAnswers,
    today,
    dateOf,
    load,
    save,
    replaceAll,
    settle,
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
    saveSlot,
    removeSlot,
    removeEater,
    setRotationStart,
    setUserName,
    setTomorrowFrom,
    mealOptions,
    checkDay,
    prepFor,
    shoppingNeeds,
    rescue,
  }
})
