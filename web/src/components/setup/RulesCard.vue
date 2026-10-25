<script setup lang="ts">
// Weekly rules: cook-fresh days, the main meal that must be made ahead on other days,
// and recurring "maybe" days (Shabbos leftovers, Mom bringing supper), which may serve one
// of her meals (chummus and toppings from Shabbos) that is then only planned on a yes.
import { computed, ref, toRaw, useId } from 'vue'

import type { Rules, SpecialDay } from '@/core'
import ChoiceChips from '@/components/ChoiceChips.vue'
import WeekdayChips from '@/components/WeekdayChips.vue'
import EditDialog from './EditDialog.vue'
import { KASHRUT_LABELS, kashrutLabel, shortWeekday } from '@/lib/labels'
import { WEEKDAYS } from '@/lib/rotation'
import { cleanSpecialDay, newSpecialDay, plannedSlots, withRules } from '@/lib/household'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
// Hand-written slots are never planned, so rules can't name them.
const slots = computed(() => plannedSlots(app.household.slots))
const kashrutLabelId = useId()

function setRules(rules: Partial<Rules>) {
  app.setHousehold(withRules(toRaw(app.household), rules))
}

const freshDays = computed({
  get: () => app.household.rules?.freshDays ?? [],
  set: (days) => setRules({ freshDays: [...days].sort((a, b) => a - b) }),
})

const mainSlotId = computed({
  get: () => app.household.rules?.mainSlotId || null,
  set: (id) => setRules({ mainSlotId: id ?? '' }),
})

const specialDays = computed(() => app.household.rules?.specialDays ?? [])
const slotName = (id: string) => app.household.slots.find((s) => s.id === id)?.name ?? '(removed)'
const mealItems = computed(() =>
  [...app.household.meals].sort((a, b) => a.name.localeCompare(b.name)),
)
/** What a maybe-day serves: one of her meals, or its own kashrut. */
function serves(s: SpecialDay): string {
  const meal = app.meal(s.mealId)
  return meal ? `Serves ${meal.name}` : kashrutLabel(s.kashrut).title
}

/** Links the draft to one of her meals; its name fills in the maybe-day's name if blank. */
function pickMeal(mealId: string | null) {
  if (!draft.value) return
  const meal = app.meal(mealId ?? undefined)
  draft.value.mealId = meal?.id
  if (!meal) return
  draft.value.kashrut = meal.kashrut
  if (!draft.value.label.trim()) draft.value.label = meal.name
}

/** Index being edited; -1 for a new one. */
const editingIndex = ref(-1)
const draft = ref<SpecialDay | null>(null)

function add() {
  draft.value = newSpecialDay(app.household.rules?.mainSlotId || slots.value[0]?.id || '')
  editingIndex.value = -1
}

function edit(i: number) {
  draft.value = structuredClone(toRaw(specialDays.value[i]!))
  editingIndex.value = i
}

function save() {
  if (!draft.value) return
  const item = cleanSpecialDay(draft.value)
  const list = toRaw(specialDays.value)
  const i = editingIndex.value
  setRules({ specialDays: i < 0 ? [...list, item] : list.map((s, j) => (j === i ? item : s)) })
  draft.value = null
}

function remove() {
  const i = editingIndex.value
  setRules({ specialDays: toRaw(specialDays.value).filter((_, j) => j !== i) })
  draft.value = null
}

const weekdayItems = WEEKDAYS.map((title, value) => ({ title, value }))
const required = (v: string) => !!v?.trim() || 'Fill this in'
const slotRequired = (v: string | null) => !!v || 'Pick a meal of the day'
</script>

<template>
  <v-card title="Weekly rules" class="mb-4">
    <v-card-text>
      <WeekdayChips
        v-model="freshDays"
        label="Days you can cook fresh"
        hint="On other days the main meal must be made ahead."
      />
      <v-select
        v-model="mainSlotId"
        :items="slots"
        item-title="name"
        item-value="id"
        label="Main meal"
        hint="The meal that must be made ahead on the other days."
        persistent-hint
        clearable
        class="mt-2"
      />
    </v-card-text>

    <v-card-subtitle class="text-wrap">
      Maybe-days: something that may or may not happen. A backup is always planned, and the app asks
      you.
    </v-card-subtitle>
    <v-list class="py-0">
      <v-list-item
        v-for="(s, i) in specialDays"
        :key="i"
        :title="`${shortWeekday(s.day)}: ${s.label}`"
        :subtitle="`${slotName(s.slotId)} · ${serves(s)} · “${s.question}”`"
        lines="two"
        append-icon="mdi-pencil"
        data-test="special-day"
        @click="edit(i)"
      />
    </v-list>
    <v-card-actions>
      <v-btn
        prepend-icon="mdi-plus"
        variant="tonal"
        :disabled="slots.length === 0"
        data-test="add-special"
        @click="add"
      >
        Add maybe-day
      </v-btn>
    </v-card-actions>

    <EditDialog
      :open="!!draft"
      :title="editingIndex < 0 ? 'Add maybe-day' : 'Edit maybe-day'"
      :remove-title="editingIndex < 0 ? undefined : `Remove ${draft?.label}?`"
      @close="draft = null"
      @save="save"
      @remove="remove"
    >
      <template v-if="draft">
        <v-text-field
          v-model="draft.label"
          label="Name"
          placeholder="e.g. Shabbos leftovers"
          :rules="[required]"
        />
        <v-text-field
          v-model="draft.question"
          label="Question to ask"
          placeholder="e.g. Is Mom bringing supper on Wednesday?"
          :rules="[required]"
        />
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
          :model-value="draft.mealId ?? null"
          :items="mealItems"
          item-title="name"
          item-value="id"
          label="Serves one of your meals (optional)"
          hint="That meal is only put on the menu when you answer yes."
          persistent-hint
          clearable
          class="mb-4"
          @update:model-value="pickMeal"
        />
        <template v-if="!draft.mealId">
          <div :id="kashrutLabelId" class="text-subtitle-1">When it happens, it's</div>
          <ChoiceChips
            v-model="draft.kashrut"
            :items="KASHRUT_LABELS"
            :labelledby="kashrutLabelId"
            size="large"
            variant="outlined"
            mandatory
            column
          />
        </template>
      </template>
    </EditDialog>
  </v-card>
</template>
