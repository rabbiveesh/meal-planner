<script setup lang="ts">
// Weekly rules: cook-fresh days, the main meal that must be made ahead on other days,
// and recurring "maybe" days (Shabbos leftovers, Mom bringing supper).
import { computed, ref, toRaw } from 'vue'

import type { Rules, SpecialDay } from '@/core'
import WeekdayChips from '@/components/WeekdayChips.vue'
import EditDialog from './EditDialog.vue'
import { KASHRUT_LABELS, kashrutLabel, shortWeekday } from '@/lib/labels'
import { WEEKDAYS } from '@/lib/rotation'
import { cleanSpecialDay, newSpecialDay, withRules } from '@/lib/household'
import { useAppStore } from '@/stores/app'

const app = useAppStore()

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

/** Index being edited; -1 for a new one. */
const editingIndex = ref(-1)
const draft = ref<SpecialDay | null>(null)

function add() {
  draft.value = newSpecialDay(app.household.rules?.mainSlotId || app.household.slots[0]?.id || '')
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
        :items="app.household.slots"
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
        :subtitle="`${slotName(s.slotId)} · ${kashrutLabel(s.kashrut).title} · “${s.question}”`"
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
        :disabled="app.household.slots.length === 0"
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
              :items="app.household.slots"
              item-title="name"
              item-value="id"
              label="Meal of the day"
              :rules="[slotRequired]"
            />
          </v-col>
        </v-row>
        <div class="text-subtitle-1">When it happens, it's</div>
        <v-chip-group v-model="draft.kashrut" mandatory column>
          <v-chip
            v-for="k in KASHRUT_LABELS"
            :key="k.value"
            :value="k.value"
            :color="k.color"
            :prepend-icon="k.icon"
            filter
            variant="outlined"
            size="large"
          >
            {{ k.title }}
          </v-chip>
        </v-chip-group>
      </template>
    </EditDialog>
  </v-card>
</template>
