// Pure helpers for the shopping screens: merging the master list with what the
// rotation needs, grouping, formatting amounts, and parsing a pasted master list.
// Quantities themselves are computed by the Rust core (`shoppingNeeds`).
import { groupBy } from 'es-toolkit'

import type { NeedItem } from '@/core'
import type { PantryMark, StapleItem } from '@/data/schema'

/** Category used when neither the master list nor the meal gives one. */
export const DEFAULT_CATEGORY = 'Other'

/** Units the core uses for "count by servings" ingredients, shown as adult/child servings. */
const SERVING_UNITS = new Set(['', 'serving', 'servings'])

/** One amount of an item in one unit, summed over the rotation. */
export interface Amount {
  unit: string
  quantity: number
  adultServings: number
  childServings: number
}

/** One line of the pantry check / shopping list. */
export interface ShoppingItem {
  /** Stable key (see `itemKey`); marks and bought ticks are stored under it. */
  key: string
  name: string
  category: string
  /** On her store master list. */
  staple: boolean
  /** What the rotation needs, one entry per unit. Empty for a staple no meal uses. */
  amounts: Amount[]
  /** Names of the meals that need it. */
  meals: string[]
}

export interface CategoryGroup<T> {
  category: string
  items: T[]
}

/**
 * Stable key for an item: the same name in any case or spacing is the same item.
 * Pantry marks and bought ticks are stored under this key.
 */
export function itemKey(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function cleanCategory(category: string | undefined): string {
  const c = cleanName(category ?? '')
  return c || DEFAULT_CATEGORY
}

/**
 * One list of staples plus rotation needs, items with the same name merged.
 * Staples come first in her list order (her store's order) and keep her name and
 * category; items only the meals need follow, sorted by name.
 */
export function mergeItems(staples: StapleItem[], needs: NeedItem[]): ShoppingItem[] {
  const byKey = new Map<string, ShoppingItem>()

  for (const s of staples) {
    const key = itemKey(s.name)
    if (!key || byKey.has(key)) continue
    byKey.set(key, {
      key,
      name: cleanName(s.name),
      category: cleanCategory(s.category),
      staple: true,
      amounts: [],
      meals: [],
    })
  }

  const needOnly: ShoppingItem[] = []
  for (const n of needs) {
    const key = itemKey(n.item)
    if (!key) continue
    let item = byKey.get(key)
    if (!item) {
      item = {
        key,
        name: cleanName(n.item),
        category: cleanCategory(n.category),
        staple: false,
        amounts: [],
        meals: [],
      }
      byKey.set(key, item)
      needOnly.push(item)
    }
    addAmount(item.amounts, n)
    for (const m of n.meals) if (!item.meals.includes(m)) item.meals.push(m)
  }

  needOnly.sort((a, b) => a.name.localeCompare(b.name))
  return [...[...byKey.values()].filter((i) => i.staple), ...needOnly]
}

function addAmount(amounts: Amount[], n: NeedItem) {
  const unit = n.unit.trim()
  const servings = SERVING_UNITS.has(unit.toLowerCase())
  const existing = amounts.find((a) =>
    servings ? SERVING_UNITS.has(a.unit.toLowerCase()) : a.unit === unit,
  )
  if (existing) {
    existing.quantity += n.quantity
    existing.adultServings += n.adultServings
    existing.childServings += n.childServings
  } else {
    amounts.push({
      unit,
      quantity: n.quantity,
      adultServings: n.adultServings,
      childServings: n.childServings,
    })
  }
}

/** Groups items by category, categories in order of first appearance. */
export function groupByCategory<T extends { category: string }>(items: T[]): CategoryGroup<T>[] {
  // groupBy keeps first-seen key order, so categories follow her list's order.
  return Object.entries(groupBy(items, (i) => i.category)).map(([category, list]) => ({
    category,
    items: list,
  }))
}

const quantityFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

/**
 * How much the rotation needs, in practical words, e.g. "2 adult + 4 child servings"
 * or "1.2 kg". Null when no meal needs it (a plain staple).
 */
export function formatNeed(item: Pick<ShoppingItem, 'amounts'>): string | null {
  const parts = item.amounts.map(formatAmount).filter((p): p is string => p != null)
  return parts.length ? parts.join(' + ') : null
}

function formatAmount(a: Amount): string | null {
  if (!SERVING_UNITS.has(a.unit.toLowerCase())) {
    return a.quantity > 0 ? `${quantityFormat.format(a.quantity)} ${a.unit}` : null
  }
  const parts: string[] = []
  if (a.adultServings > 0) parts.push(`${a.adultServings} adult`)
  if (a.childServings > 0) parts.push(`${a.childServings} child`)
  if (!parts.length) return null
  const noun = a.adultServings + a.childServings === 1 ? 'serving' : 'servings'
  return `${parts.join(' + ')} ${noun}`
}

/** Unmarked counts as needed: anything not marked "have enough" goes on the list. */
export function isNeeded(item: Pick<ShoppingItem, 'key'>, marks: Record<string, PantryMark>) {
  return marks[item.key] !== 'have'
}

export interface ParsedStaple {
  name: string
  category: string
}

const BULLET = /^(?:[-*•·]|\d+[.)]|\[[ xX]?\])\s*/

/**
 * Parses a pasted master list, one item per line.
 * - A line ending with ":" starts a category for the lines below it.
 * - "Category: item" puts that one item in that category.
 * - Bullets ("-", "*", "1.", "[ ]") and blank lines are ignored.
 * Repeated names (any case) are kept once.
 */
export function parseStapleList(text: string, defaultCategory = DEFAULT_CATEGORY): ParsedStaple[] {
  const result: ParsedStaple[] = []
  const seen = new Set<string>()
  let current = cleanCategory(defaultCategory)

  for (const raw of text.split(/\r?\n/)) {
    const line = cleanName(raw.trim().replace(BULLET, ''))
    if (!line) continue
    if (line.endsWith(':')) {
      current = cleanCategory(line.slice(0, -1))
      continue
    }
    const colon = line.indexOf(':')
    const category = colon > 0 ? cleanCategory(line.slice(0, colon)) : current
    const name = cleanName(colon > 0 ? line.slice(colon + 1) : line)
    const key = itemKey(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push({ name, category })
  }
  return result
}

/**
 * Index of the next item without a pantry mark after `from`, wrapping around;
 * -1 when every item is marked. Drives the one-at-a-time pantry check.
 */
export function nextUnmarked(
  items: Pick<ShoppingItem, 'key'>[],
  marks: Record<string, PantryMark>,
  from = -1,
): number {
  for (let step = 1; step <= items.length; step++) {
    const i = (from + step + items.length) % items.length
    if (!marks[items[i]!.key]) return i
  }
  return -1
}
