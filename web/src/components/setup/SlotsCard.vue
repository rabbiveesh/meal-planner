<script setup lang="ts">
// The meals of the day (slots): name, which chart, who eats when, days, repeat limit, or
// written by hand each day instead of planned.
import { computed, ref, toRaw, useId } from 'vue'

import type { SlotDef } from '@/core'
import ChoiceChips from '@/components/ChoiceChips.vue'
import WeekdayChips from '@/components/WeekdayChips.vue'
import EditDialog from './EditDialog.vue'
import { PLAN_VIEWS, viewLabel } from '@/lib/plan'
import { weekdayList } from '@/lib/labels'
import { cleanSlot, mealsUsingSlot, move, newSlot } from '@/lib/household'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const viewLabelId = useId()
// Each row is named by its slot and described by its summary, at `${rowId}-<index>-...`.
const rowId = useId()
const viewChoices = PLAN_VIEWS.map((v) => ({ value: v.id, title: v.label }))
const draft = ref<SlotDef | null>(null)
const isNew = ref(false)

function add() {
  draft.value = newSlot()
  isNew.value = true
}

function edit(s: SlotDef) {
  draft.value = structuredClone(toRaw(s))
  isNew.value = false
}

function save() {
  if (!draft.value) return
  app.saveSlot(cleanSlot(draft.value))
  draft.value = null
}

function moveSlot(index: number, delta: number) {
  const h = toRaw(app.household)
  app.setHousehold({ ...h, slots: move(h.slots, index, delta) })
}

const removeMessage = computed(() => {
  if (!draft.value) return ''
  const n = mealsUsingSlot(toRaw(app.household), draft.value.id)
  const meals = n === 1 ? '1 meal uses it' : `${n} meals use it`
  return `${n ? `${meals}; they'll stay in your list. ` : ''}It will be taken out of the plan and the weekly rules.`
})

function remove() {
  if (!draft.value) return
  const id = draft.value.id
  app.removeSlot(id)
  draft.value = null
}

function summary(s: SlotDef): string {
  const times = [
    s.childTime && `kids ${s.childTime}`,
    s.adultTime && `adults ${s.adultTime}`,
  ].filter(Boolean)
  if (s.handWritten) {
    return [viewLabel(s.view), 'written by hand', weekdayList(s.days, 'no days')].join(' · ')
  }
  return [viewLabel(s.view), ...times, weekdayList(s.days, 'no days')].join(' · ')
}

const required = (v: string) => !!v?.trim() || 'Enter a name'
const someoneEats = () =>
  !!(draft.value?.handWritten || draft.value?.adultTime || draft.value?.childTime) ||
  'Set a time for adults, children or both'
</script>

<template>
  <v-card title="Meals of the day" class="mb-4">
    <v-card-subtitle class="text-wrap">In the order they're eaten.</v-card-subtitle>
    <v-list class="py-0">
      <v-list-item
        v-for="(s, i) in app.household.slots"
        :key="s.id"
        :aria-labelledby="`${rowId}-${i}-name`"
        :aria-describedby="`${rowId}-${i}-summary`"
        lines="two"
        @click="edit(s)"
      >
        <template #title>
          <span :id="`${rowId}-${i}-name`">{{ s.name }}</span>
        </template>
        <template #subtitle>
          <span :id="`${rowId}-${i}-summary`">{{ summary(s) }}</span>
        </template>
        <template #append>
          <v-btn
            icon="mdi-arrow-up"
            variant="text"
            size="default"
            :disabled="i === 0"
            :aria-label="`Move ${s.name} up`"
            @click.stop="moveSlot(i, -1)"
          />
          <v-btn
            icon="mdi-arrow-down"
            variant="text"
            size="default"
            :disabled="i === app.household.slots.length - 1"
            :aria-label="`Move ${s.name} down`"
            @click.stop="moveSlot(i, 1)"
          />
        </template>
      </v-list-item>
    </v-list>
    <v-card-actions>
      <v-btn prepend-icon="mdi-plus" variant="tonal" data-test="add-slot" @click="add">
        Add meal of the day
      </v-btn>
    </v-card-actions>

    <EditDialog
      :open="!!draft"
      :title="isNew ? 'Add meal of the day' : 'Edit meal of the day'"
      :remove-title="isNew ? undefined : `Remove ${draft?.name}?`"
      :remove-message="removeMessage"
      @close="draft = null"
      @save="save"
      @remove="remove"
    >
      <template v-if="draft">
        <v-text-field
          v-model="draft.name"
          label="Name"
          placeholder="e.g. Kids' take-along"
          :rules="[required]"
          data-test="name"
        />
        <v-switch
          v-model="draft.handWritten"
          label="Write it by hand each day"
          hint="Never planned from your meals. Today shows a box to write in, and the printed chart a blank space."
          persistent-hint
          color="primary"
          inset
          class="mb-4"
          data-test="hand-written"
        />
        <div :id="viewLabelId" class="text-subtitle-1">Shown on chart</div>
        <ChoiceChips
          v-model="draft.view"
          :items="viewChoices"
          :labelledby="viewLabelId"
          size="large"
          variant="outlined"
          mandatory
          column
          class="mb-2"
        />
        <WeekdayChips
          v-if="draft.handWritten"
          v-model="draft.days"
          label="Days it's shown"
          class="mt-2"
        />
        <template v-else>
          <v-row dense>
            <v-col cols="6">
              <v-text-field
                v-model="draft.childTime"
                type="time"
                label="Kids eat at"
                clearable
                :rules="[someoneEats]"
                hint="Empty: kids don't eat it"
                persistent-hint
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="draft.adultTime"
                type="time"
                label="Adults eat at"
                clearable
                :rules="[someoneEats]"
                hint="Empty: adults don't eat it"
                persistent-hint
              />
            </v-col>
          </v-row>
          <WeekdayChips v-model="draft.days" label="Days it's planned" class="mt-2" />
          <v-number-input
            :model-value="draft.minRepeatDays ?? 0"
            label="Days before the same meal can repeat"
            :min="0"
            :max="14"
            @update:model-value="draft.minRepeatDays = $event ?? 0"
          />
          <v-switch
            v-model="draft.prepNightBefore"
            label="Prepared the night before"
            color="primary"
            inset
            hide-details
          />
        </template>
      </template>
    </EditDialog>
  </v-card>
</template>
