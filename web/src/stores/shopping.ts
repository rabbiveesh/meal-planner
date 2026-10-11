import { defineStore } from 'pinia'
import { computed } from 'vue'

import type { NeedItem } from '@/core'
import type { PantryMark, StapleItem } from '@/data/schema'
import { newId } from '@/lib/ids'
import {
  groupByCategory,
  isNeeded,
  itemKey,
  mergeItems,
  parseStapleList,
  type ShoppingItem,
} from '@/lib/shopping'
import { useAppStore } from './app'

/**
 * The two-week shop: her master list (staples), the pantry check and the store list.
 * State lives in `app.data.shopping`, so it is saved with everything else.
 */
export const useShoppingStore = defineStore('shopping', () => {
  const app = useAppStore()
  const state = computed(() => app.data.shopping)

  const needs = computed<NeedItem[]>(() => app.shoppingNeeds())

  const staples = computed(() => state.value.staples)
  const marks = computed(() => state.value.marks)

  /** Staples plus what the rotation needs, merged by name. */
  const items = computed(() => mergeItems(state.value.staples, needs.value))
  const groups = computed(() => groupByCategory(items.value))
  const categories = computed(() => [...new Set(items.value.map((i) => i.category))])

  const checkedCount = computed(() => items.value.filter((i) => marks.value[i.key]).length)

  /** Everything not marked "have enough". */
  const toBuy = computed(() => items.value.filter((i) => isNeeded(i, marks.value)))
  const toBuyGroups = computed(() => groupByCategory(toBuy.value))
  const boughtCount = computed(
    () => toBuy.value.filter((i) => state.value.bought.includes(i.key)).length,
  )

  // --- Master list ----------------------------------------------------------

  function findStaple(name: string, exceptId?: string): StapleItem | undefined {
    const key = itemKey(name)
    return state.value.staples.find((s) => s.id !== exceptId && itemKey(s.name) === key)
  }

  /** Adds an item to the master list. Returns false if it is already there. */
  function addStaple(name: string, category: string): boolean {
    if (!itemKey(name) || findStaple(name)) return false
    state.value.staples.push({ id: newId(), name: name.trim(), category: category.trim() })
    return true
  }

  /** Returns false if another staple already has that name. */
  function updateStaple(id: string, name: string, category: string): boolean {
    const staple = state.value.staples.find((s) => s.id === id)
    if (!staple || !itemKey(name) || findStaple(name, id)) return false
    staple.name = name.trim()
    staple.category = category.trim()
    return true
  }

  function removeStaple(id: string) {
    state.value.staples = state.value.staples.filter((s) => s.id !== id)
  }

  /** Adds every new item in a pasted list; names already on the list are skipped. */
  function importStaples(text: string, defaultCategory?: string) {
    const parsed = parseStapleList(text, defaultCategory)
    let added = 0
    for (const p of parsed) if (addStaple(p.name, p.category)) added++
    return { added, skipped: parsed.length - added }
  }

  // --- Pantry check and store list ------------------------------------------

  function mark(item: ShoppingItem, value: PantryMark | null) {
    if (value) state.value.marks[item.key] = value
    else delete state.value.marks[item.key]
  }

  function isBought(item: ShoppingItem) {
    return state.value.bought.includes(item.key)
  }

  function setBought(item: ShoppingItem, bought: boolean) {
    const rest = state.value.bought.filter((k) => k !== item.key)
    state.value.bought = bought ? [...rest, item.key] : rest
  }

  /** Clears the pantry check and the store ticks; the master list stays. */
  function newTrip() {
    state.value.marks = {}
    state.value.bought = []
  }

  return {
    staples,
    marks,
    items,
    groups,
    categories,
    checkedCount,
    toBuy,
    toBuyGroups,
    boughtCount,
    addStaple,
    updateStaple,
    removeStaple,
    importStaples,
    mark,
    isBought,
    setBought,
    newTrip,
  }
})
