// Pure helpers for the meal master list and editor. No planner rules here: which meal fits
// which cell is decided by the Rust core.
import type { Ingredient, Meal, SlotDef } from '@/core'
import { newId } from './ids'

/** A meal with every list present, so the editor can bind to them directly. */
export type MealDraft = Meal &
  Required<Pick<Meal, 'days' | 'ingredients' | 'prepTasks' | 'rescueQuestions' | 'leftoversFor'>>

/**
 * A new meal with sensible defaults, or an existing one (`init`) with any missing lists
 * filled in. `init` can also pre-fill a new meal, e.g. with the slot being browsed.
 */
export function newMeal(init: Partial<Meal> = {}): MealDraft {
  return {
    name: '',
    slots: [],
    kashrut: 'parve',
    prep: 'ahead',
    rescue: false,
    fun: false,
    ...init,
    id: init.id ?? newId(),
    days: init.days ?? [],
    ingredients: init.ingredients ?? [],
    prepTasks: init.prepTasks ?? [],
    rescueQuestions: init.rescueQuestions ?? [],
    leftoversFor: init.leftoversFor ?? [],
  }
}

export function newIngredient(): Ingredient {
  return { item: '' }
}

function text(value: string | undefined | null): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

function texts(values: readonly string[] | undefined): string[] {
  return (values ?? []).map((v) => v.trim()).filter(Boolean)
}

function amount(value: number | undefined | null): number | undefined {
  return value == null || Number.isNaN(value) ? undefined : value
}

/**
 * Tidies an edited meal before saving: trims text, drops blank rows and empty optional
 * fields, and forgets rescue questions on a meal that is no longer a rescue meal.
 */
export function cleanMeal(meal: Meal): Meal {
  const ingredients = (meal.ingredients ?? [])
    .map((i): Ingredient => ({
      item: i.item.trim(),
      perAdult: amount(i.perAdult),
      perChild: amount(i.perChild),
      unit: text(i.unit),
      category: text(i.category),
    }))
    .filter((i) => i.item)
  const rescue = !!meal.rescue
  return {
    id: meal.id,
    name: meal.name.trim(),
    slots: [...new Set(meal.slots)],
    kashrut: meal.kashrut,
    prep: meal.prep,
    days: [...new Set(meal.days ?? [])].sort((a, b) => a - b),
    kidsVersion: text(meal.kidsVersion),
    adultsVersion: text(meal.adultsVersion),
    softVersion: text(meal.softVersion),
    ingredients,
    prepTasks: texts(meal.prepTasks),
    rescue,
    rescueQuestions: rescue ? texts(meal.rescueQuestions) : [],
    fun: !!meal.fun,
    leftoversFor: [...new Set(meal.leftoversFor ?? [])],
    notes: text(meal.notes),
  }
}

/** Why a meal can't be saved yet, by field. Empty when it's fine. */
export function mealProblems(meal: Meal): { name?: string; slots?: string } {
  const problems: { name?: string; slots?: string } = {}
  if (!meal.name.trim()) problems.name = 'Give the meal a name'
  if (meal.slots.length === 0) problems.slots = 'Pick at least one meal slot'
  return problems
}

/** Master-list filter: one slot, rescue meals, fun meals, or everything (null). */
export type MealFilter = { slotId: string } | 'rescue' | 'fun' | null

/** Meals whose name, versions or notes contain `query`, narrowed by `filter`. */
export function filterMeals(meals: readonly Meal[], query: string, filter: MealFilter): Meal[] {
  const q = query.trim().toLocaleLowerCase()
  return meals.filter((m) => {
    if (filter === 'rescue' && !m.rescue) return false
    if (filter === 'fun' && !m.fun) return false
    if (filter && typeof filter === 'object' && !m.slots.includes(filter.slotId)) return false
    if (!q) return true
    return [m.name, m.kidsVersion, m.adultsVersion, m.softVersion, m.notes].some((t) =>
      t?.toLocaleLowerCase().includes(q),
    )
  })
}

export interface MealGroup {
  /** Null for meals whose slots no longer exist. */
  slot: SlotDef | null
  title: string
  meals: Meal[]
}

/**
 * Groups meals under each slot they can fill, in household slot order, sorted by name.
 * A meal that fills two slots appears in both. Meals with no known slot go in a last group
 * so they can still be found and fixed. With `onlySlotId`, only that slot's group is shown.
 */
export function groupBySlot(
  meals: readonly Meal[],
  slots: readonly SlotDef[],
  onlySlotId?: string,
): MealGroup[] {
  const byName = (a: Meal, b: Meal) => a.name.localeCompare(b.name)
  const known = new Set(slots.map((s) => s.id))
  const groups: MealGroup[] = slots
    .filter((s) => !onlySlotId || s.id === onlySlotId)
    .map((slot) => ({
      slot,
      title: slot.name,
      meals: meals.filter((m) => m.slots.includes(slot.id)).sort(byName),
    }))
  if (!onlySlotId) {
    groups.push({
      slot: null,
      title: 'No meal slot',
      meals: meals.filter((m) => !m.slots.some((id) => known.has(id))).sort(byName),
    })
  }
  return groups.filter((g) => g.meals.length > 0)
}

/** Distinct values already used for an ingredient field, for suggestions while typing. */
export function knownIngredientValues(
  meals: readonly Meal[],
  field: 'item' | 'unit' | 'category',
): string[] {
  const values = new Set<string>()
  for (const m of meals) {
    for (const i of m.ingredients ?? []) {
      const v = i[field]?.trim()
      if (v) values.add(v)
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b))
}
