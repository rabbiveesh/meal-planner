<script setup lang="ts">
// One day's meals, a big row per slot. Tapping a row asks the parent to change that meal;
// under each row is her own note for that meal on that date.
import { computed } from 'vue'

import { slotsOn } from '@/lib/today'
import { useAppStore } from '@/stores/app'

const props = defineProps<{
  day: number
  /** The calendar date shown (yyyy-MM-dd), which her notes belong to. */
  date: string
}>()

const emit = defineEmits<{ pick: [slotId: string] }>()

const app = useAppStore()

const rows = computed(() =>
  slotsOn(app.household, props.day).map((slot) => {
    const cell = app.cell(props.day, slot.id)
    const special = cell?.specialActive ? app.special(props.day, slot.id) : undefined
    return { slot, cell, meal: app.meal(cell?.mealId), special }
  }),
)
</script>

<template>
  <v-card v-if="rows.length === 0" class="mb-4" variant="tonal">
    <v-card-text class="text-body-1">Nothing is planned for this day. Enjoy!</v-card-text>
  </v-card>
  <v-card v-else class="mb-4">
    <v-list lines="three" class="py-0">
      <template v-for="(row, i) in rows" :key="row.slot.id">
        <v-divider v-if="i > 0" />
        <v-list-item
          class="py-3"
          :aria-label="`${row.slot.name}: ${row.special?.label ?? row.meal?.name ?? 'Not planned yet'}. Tap to change.`"
          @click="emit('pick', row.slot.id)"
        >
          <v-list-item-subtitle class="text-body-2 mb-1">{{ row.slot.name }}</v-list-item-subtitle>
          <v-list-item-title class="text-h6 text-wrap">
            <template v-if="row.special">{{ row.special.label }}</template>
            <template v-else-if="row.meal">{{ row.meal.name }}</template>
            <span v-else class="text-medium-emphasis">Not planned yet</span>
          </v-list-item-title>
          <template v-if="row.meal && !row.special">
            <div class="text-body-1 mt-1">
              <div v-if="row.meal.kidsVersion">Kids: {{ row.meal.kidsVersion }}</div>
              <div v-if="row.meal.adultsVersion">Adults: {{ row.meal.adultsVersion }}</div>
              <div v-if="row.meal.softVersion">Soft: {{ row.meal.softVersion }}</div>
            </div>
            <v-chip v-if="row.cell?.leftover" class="mt-2" size="small" color="secondary">
              Leftovers
            </v-chip>
          </template>
          <template #append>
            <v-icon icon="mdi-chevron-right" />
          </template>
        </v-list-item>
        <div class="px-4 pb-3">
          <v-textarea
            :model-value="app.note(date, row.slot.id)"
            :aria-label="`Notes for ${row.slot.name}`"
            placeholder="Notes"
            prepend-inner-icon="mdi-pencil"
            variant="plain"
            density="compact"
            rows="1"
            auto-grow
            hide-details
            @update:model-value="app.setNote(date, row.slot.id, $event)"
          />
        </div>
      </template>
    </v-list>
  </v-card>
</template>
