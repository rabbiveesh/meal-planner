<script setup lang="ts">
// The master list: every meal she has entered, grouped by slot, with add / edit.
import { computed, ref, useId } from 'vue'

import type { Meal } from '@/core'
import ChoiceChips, { type Choice } from '@/components/ChoiceChips.vue'
import MealEditor from '@/components/meals/MealEditor.vue'
import MealRow from '@/components/meals/MealRow.vue'
import { filterMeals, groupBySlot, newMeal, type MealFilter } from '@/lib/meals'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
// Each meal group (card) is named by its title, at `${groupId}-<index>`.
const groupId = useId()

const query = ref('')
/** Chip value: `slot:<id>`, `rescue`, `fun`, or undefined for all meals. */
const chip = ref<string | undefined>()

const filterChoices = computed<Choice<string>[]>(() => [
  ...app.household.slots.map((s) => ({ value: `slot:${s.id}`, title: s.name })),
  { value: 'rescue', title: 'Rescue', icon: 'mdi-lifebuoy' },
  { value: 'fun', title: 'Fun', icon: 'mdi-party-popper' },
])

const filter = computed<MealFilter>(() => {
  const c = chip.value
  if (!c) return null
  if (c === 'rescue' || c === 'fun') return c
  return { slotId: c.slice('slot:'.length) }
})

const groups = computed(() => {
  const f = filter.value
  const meals = filterMeals(app.household.meals, query.value, f)
  if (f === 'rescue' || f === 'fun') {
    return [
      { key: f, title: f === 'rescue' ? 'Rescue meals' : 'Fun meals', meals: sortByName(meals) },
    ].filter((g) => g.meals.length)
  }
  return groupBySlot(meals, app.household.slots, f?.slotId).map((g) => ({
    key: g.slot?.id ?? 'none',
    title: g.title,
    meals: g.meals,
  }))
})

function sortByName(meals: Meal[]): Meal[] {
  return [...meals].sort((a, b) => a.name.localeCompare(b.name))
}

const editing = ref<Meal | null>(null)
const isNew = ref(false)
const saved = ref('')

function add() {
  const f = filter.value
  editing.value = newMeal({
    slots: f && typeof f === 'object' ? [f.slotId] : [],
    rescue: f === 'rescue',
    fun: f === 'fun',
    prep: f === 'rescue' ? 'instant' : 'ahead',
  })
  isNew.value = true
}

function edit(meal: Meal) {
  editing.value = meal
  isNew.value = false
}

function save(meal: Meal) {
  app.saveMeal(meal)
  saved.value = `Saved ${meal.name}`
  editing.value = null
}

function remove(id: string) {
  const name = app.meal(id)?.name ?? 'meal'
  app.deleteMeal(id)
  saved.value = `Deleted ${name}`
  editing.value = null
}
</script>

<template>
  <div class="pb-16">
    <div class="d-flex align-center mb-2">
      <h1 class="text-h5">Meals</h1>
      <v-spacer />
      <span class="text-medium-emphasis">{{ app.household.meals.length }} meals</span>
    </div>

    <v-text-field
      v-model="query"
      prepend-inner-icon="mdi-magnify"
      label="Search meals"
      clearable
      hide-details
      class="mb-2"
      data-test="search"
    />

    <ChoiceChips
      v-model="chip"
      :items="filterChoices"
      label="Filter meals"
      variant="outlined"
      column
      selected-class="text-primary"
      class="mb-2"
    />

    <v-empty-state
      v-if="app.household.meals.length === 0"
      icon="mdi-silverware-fork-knife"
      title="No meals yet"
      text="Enter each meal your family eats once, and the app plans with them from then on. You can also load the starter template in Setup."
    />
    <div v-else-if="groups.length === 0" class="text-center text-medium-emphasis pa-8">
      No meals match.
    </div>

    <v-card
      v-for="(g, gi) in groups"
      :key="g.key"
      role="group"
      :aria-labelledby="`${groupId}-${gi}`"
      class="mb-3"
    >
      <v-card-title class="d-flex align-center">
        <span :id="`${groupId}-${gi}`">{{ g.title }}</span>
        <v-spacer />
        <span class="text-body-2 text-medium-emphasis">{{ g.meals.length }}</span>
      </v-card-title>
      <v-list class="py-0">
        <template v-for="(m, i) in g.meals" :key="m.id">
          <v-divider v-if="i > 0" />
          <MealRow :meal="m" @edit="edit(m)" />
        </template>
      </v-list>
    </v-card>

    <v-fab
      prepend-icon="mdi-plus"
      text="Add meal"
      extended
      color="secondary"
      size="large"
      app
      location="bottom end"
      data-test="add"
      @click="add"
    />

    <MealEditor
      :meal="editing"
      :is-new="isNew"
      @close="editing = null"
      @save="save"
      @delete="remove"
    />

    <v-snackbar :model-value="!!saved" :timeout="2500" @update:model-value="saved = ''">
      {{ saved }}
    </v-snackbar>
  </div>
</template>
