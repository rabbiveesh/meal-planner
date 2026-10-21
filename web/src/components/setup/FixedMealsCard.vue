<script setup lang="ts">
// Every-week meals: the same meal (or one of a few, taking turns) on the same day each week,
// e.g. soup every Sunday night. The planner puts these in first.
import { computed, ref, toRaw } from 'vue'

import type { FixedMeal } from '@/core'
import EditDialog from './EditDialog.vue'
import { shortWeekday } from '@/lib/labels'
import { WEEKDAYS } from '@/lib/rotation'
import { cleanFixedMeal, newFixedMeal, plannedSlots, withRules } from '@/lib/household'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
// Hand-written slots are never planned, so rules can't name them.
const slots = computed(() => plannedSlots(app.household.slots))

const fixedMeals = computed(() => app.household.rules?.fixedMeals ?? [])
const slotName = (id: string) => app.household.slots.find((s) => s.id === id)?.name ?? '(removed)'
const mealNames = (ids: readonly string[]) =>
  ids.map((id) => app.meal(id)?.name ?? '(removed)').join(' or ')

const mealItems = computed(() =>
  [...app.household.meals].sort((a, b) => a.name.localeCompare(b.name)),
)

function setFixedMeals(list: FixedMeal[]) {
  app.setHousehold(withRules(toRaw(app.household), { fixedMeals: list }))
}

/** Index being edited; -1 for a new one. */
const editingIndex = ref(-1)
const draft = ref<FixedMeal | null>(null)

function add() {
  draft.value = newFixedMeal(app.household.rules?.mainSlotId || slots.value[0]?.id || '')
  editingIndex.value = -1
}

function edit(i: number) {
  draft.value = structuredClone(toRaw(fixedMeals.value[i]!))
  editingIndex.value = i
}

function save() {
  if (!draft.value) return
  const item = cleanFixedMeal(draft.value)
  const list = toRaw(fixedMeals.value)
  const i = editingIndex.value
  setFixedMeals(i < 0 ? [...list, item] : list.map((f, j) => (j === i ? item : f)))
  draft.value = null
}

function remove() {
  const i = editingIndex.value
  setFixedMeals(toRaw(fixedMeals.value).filter((_, j) => j !== i))
  draft.value = null
}

const weekdayItems = WEEKDAYS.map((title, value) => ({ title, value }))
const slotRequired = (v: string | null) => !!v || 'Pick a meal of the day'
const mealsRequired = (v: string[] | null) => (v?.length ?? 0) > 0 || 'Pick at least one meal'
</script>

<template>
  <v-card title="Every week" class="mb-4">
    <v-card-subtitle class="text-wrap">
      The same meal on the same day each week. Pick a few and the plan takes turns between them.
    </v-card-subtitle>
    <v-list class="py-0">
      <v-list-item
        v-for="(f, i) in fixedMeals"
        :key="i"
        :title="`${shortWeekday(f.day)}: ${mealNames(f.mealIds)}`"
        :subtitle="slotName(f.slotId)"
        lines="two"
        append-icon="mdi-pencil"
        data-test="fixed-meal"
        @click="edit(i)"
      />
    </v-list>
    <v-card-actions>
      <v-btn
        prepend-icon="mdi-plus"
        variant="tonal"
        :disabled="slots.length === 0 || app.household.meals.length === 0"
        @click="add"
      >
        Add every-week meal
      </v-btn>
    </v-card-actions>

    <EditDialog
      :open="!!draft"
      :title="editingIndex < 0 ? 'Add every-week meal' : 'Edit every-week meal'"
      :remove-title="editingIndex < 0 ? undefined : 'Remove this every-week meal?'"
      @close="draft = null"
      @save="save"
      @remove="remove"
    >
      <template v-if="draft">
        <v-row dense>
          <v-col cols="6">
            <v-select v-model="draft.day" :items="weekdayItems" label="Day" />
          </v-col>
          <v-col cols="6">
            <v-select
              v-model="draft.slotId"
              :items="slots"
              item-title="name"
              item-value="id"
              label="Meal of the day"
              :rules="[slotRequired]"
            />
          </v-col>
        </v-row>
        <v-autocomplete
          v-model="draft.mealIds"
          :items="mealItems"
          item-title="name"
          item-value="id"
          label="Meals"
          hint="Pick one, or a few to take turns."
          persistent-hint
          :rules="[mealsRequired]"
          multiple
          chips
          closable-chips
        />
      </template>
    </EditDialog>
  </v-card>
</template>
