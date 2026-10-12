// Pure UI helpers for showing the rotation. No planner rules here: what fits where,
// and why, comes from the Rust core (mealOptions, checkDay).
import type { Cell, Conflict, Meal, MealOption, SlotDef, SpecialDay, View } from '@/core'

/** The separate charts she asked for instead of one crowded grid, in tab order. */
export const PLAN_VIEWS: readonly { id: View; label: string }[] = [
  { id: 'home', label: 'At home' },
  { id: 'takeAlong', label: 'Take-along' },
  { id: 'breakfast', label: 'Breakfast' },
]

export function isView(value: unknown): value is View {
  return PLAN_VIEWS.some((v) => v.id === value)
}

export function viewLabel(view: View): string {
  return PLAN_VIEWS.find((v) => v.id === view)?.label ?? view
}

/** Week of the rotation a day falls in: 0 = week A, 1 = week B. */
export function weekOf(day: number): 0 | 1 {
  return day % 14 < 7 ? 0 : 1
}

/** Slots shown on a chart, in household order; with `day`, only those planned that weekday. */
export function slotsFor(slots: readonly SlotDef[], view: View, day?: number): SlotDef[] {
  return slots.filter((s) => s.view === view && (day == null || s.days.includes(day % 7)))
}

/** Kashrut problems that belong to one cell. */
export function conflictsFor(conflicts: readonly Conflict[], slotId: string): Conflict[] {
  return conflicts.filter((c) => c.slotId === slotId)
}

/**
 * Narrows the core's meal options by a typed search and splits them into good fits and
 * ones with warnings, keeping the core's order within each group.
 */
export function groupOptions(
  options: readonly MealOption[],
  query: string,
): { fits: MealOption[]; warned: MealOption[] } {
  const q = query.trim().toLocaleLowerCase()
  const matching = q ? options.filter((o) => o.name.toLocaleLowerCase().includes(q)) : options
  return {
    fits: matching.filter((o) => o.warnings.length === 0),
    warned: matching.filter((o) => o.warnings.length > 0),
  }
}

export interface CellVersion {
  label: string
  text: string
}

export interface CellDisplay {
  /** What's on the plate: the meal, or the special (e.g. "Shabbos leftovers") when it's on. */
  title: string | null
  /** The planned meal that the special replaces, shown struck through. */
  backup: string | null
  versions: CellVersion[]
}

/** How one cell reads on a chart. `meal` is the cell's meal, `special` the matching special day. */
export function cellDisplay(
  cell: Pick<Cell, 'specialActive'> | undefined,
  meal: Pick<Meal, 'name' | 'kidsVersion' | 'adultsVersion' | 'softVersion'> | undefined,
  special: Pick<SpecialDay, 'label'> | undefined,
): CellDisplay {
  if (cell?.specialActive && special) {
    return { title: special.label, backup: meal?.name ?? null, versions: [] }
  }
  if (!meal) return { title: null, backup: null, versions: [] }
  const versions: CellVersion[] = []
  if (meal.kidsVersion) versions.push({ label: 'Kids', text: meal.kidsVersion })
  if (meal.adultsVersion) versions.push({ label: 'Adults', text: meal.adultsVersion })
  if (meal.softVersion) versions.push({ label: 'Soft', text: meal.softVersion })
  return { title: meal.name, backup: null, versions }
}
