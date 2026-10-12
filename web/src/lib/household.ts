// Pure helpers for editing household settings (eaters, slots, weekly rules) on the Setup
// screen. Each returns new data; the screen hands it to the store.
import type { Eater, Household, Plan, Rules, SlotDef, SpecialDay } from '@/core'
import { newId } from './ids'

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const
/** Sunday to Friday: what the household plans by default (Shabbos is not planned). */
export const WORK_WEEK = [0, 1, 2, 3, 4, 5] as const

export function newEater(): Eater {
  return { id: newId(), name: '', kind: 'child', waitHours: 0, softFood: false }
}

export function newSlot(): SlotDef {
  return { id: newId(), name: '', view: 'home', days: [...WORK_WEEK], minRepeatDays: 7 }
}

export function newSpecialDay(slotId: string): SpecialDay {
  return { day: 0, slotId, label: '', question: '', kashrut: 'meat' }
}

function text(value: string | undefined | null): string | undefined {
  const t = value?.trim()
  return t ? t : undefined
}

export function cleanEater(e: Eater): Eater {
  return {
    id: e.id,
    name: e.name.trim(),
    kind: e.kind,
    waitHours: e.waitHours ?? 0,
    softFood: !!e.softFood,
    notes: text(e.notes),
  }
}

/** Trims a slot; a blank time means that group doesn't eat it. */
export function cleanSlot(s: SlotDef): SlotDef {
  return {
    id: s.id,
    name: s.name.trim(),
    view: s.view,
    adultTime: text(s.adultTime),
    childTime: text(s.childTime),
    days: [...new Set(s.days)].sort((a, b) => a - b),
    minRepeatDays: s.minRepeatDays ?? 0,
    prepNightBefore: !!s.prepNightBefore,
  }
}

export function cleanSpecialDay(s: SpecialDay): SpecialDay {
  return { ...s, label: s.label.trim(), question: s.question.trim() }
}

/** Puts `item` in place of the entry with the same id, or appends it. */
export function upsert<T extends { id: string }>(list: readonly T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  return i >= 0 ? list.map((x, j) => (j === i ? item : x)) : [...list, item]
}

/** Moves the entry at `from` by `delta` places, staying in bounds. */
export function move<T>(list: readonly T[], from: number, delta: number): T[] {
  const to = Math.min(Math.max(from + delta, 0), list.length - 1)
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

export function withRules(h: Household, rules: Partial<Rules>): Household {
  return { ...h, rules: { ...h.rules, ...rules } }
}

export function removeEater(h: Household, eaterId: string): Household {
  return { ...h, eaters: h.eaters.filter((e) => e.id !== eaterId) }
}

/** How many meals can fill (or eat leftovers in) a slot, to warn before removing it. */
export function mealsUsingSlot(h: Household, slotId: string): number {
  return h.meals.filter((m) => m.slots.includes(slotId) || m.leftoversFor?.includes(slotId)).length
}

/**
 * Removes a slot and every reference to it, so no screen is left pointing at a slot that
 * no longer exists: meals' slots and leftovers, the main slot rule and special days.
 */
export function removeSlot(h: Household, slotId: string): Household {
  const rules = h.rules ?? {}
  return {
    ...h,
    slots: h.slots.filter((s) => s.id !== slotId),
    meals: h.meals.map((m) => ({
      ...m,
      slots: m.slots.filter((id) => id !== slotId),
      leftoversFor: m.leftoversFor?.filter((id) => id !== slotId),
    })),
    rules: {
      ...rules,
      mainSlotId: rules.mainSlotId === slotId ? '' : rules.mainSlotId,
      specialDays: rules.specialDays?.filter((s) => s.slotId !== slotId),
    },
  }
}

/** The plan without the removed slot's cells. */
export function planWithoutSlot(plan: Plan, slotId: string): Plan {
  return { cells: plan.cells.filter((c) => c.slotId !== slotId) }
}
