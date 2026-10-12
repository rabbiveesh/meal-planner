<script setup lang="ts">
// One day of one chart: a big tappable row per slot. Tapping a row asks the parent to swap it.
import { computed, useId } from 'vue'

import type { Conflict, SlotDef } from '@/core'
import { cellDisplay, conflictsFor } from '@/lib/plan'
import { dayLabel } from '@/lib/rotation'
import { useAppStore } from '@/stores/app'

const props = defineProps<{
  day: number
  /** Slots of this chart planned on this weekday. */
  slots: SlotDef[]
  /** Kashrut problems for this day, from the core. */
  conflicts: Conflict[]
  isToday?: boolean
}>()

const emit = defineEmits<{ pick: [slotId: string] }>()

const app = useAppStore()
const titleId = useId()

const rows = computed(() =>
  props.slots.map((slot) => {
    const cell = app.cell(props.day, slot.id)
    const special = app.special(props.day, slot.id)
    return {
      slot,
      cell,
      special,
      display: cellDisplay(cell, app.meal(cell?.mealId), special),
      conflicts: conflictsFor(props.conflicts, slot.id),
    }
  }),
)
</script>

<template>
  <v-card
    role="group"
    :aria-labelledby="titleId"
    :color="isToday ? 'primary' : undefined"
    :variant="isToday ? 'outlined' : 'elevated'"
  >
    <v-card-title class="d-flex align-center text-h6">
      <span :id="titleId">{{ dayLabel(day) }}</span>
      <v-chip v-if="isToday" class="ml-2" color="primary" size="small" label>Today</v-chip>
    </v-card-title>

    <v-list class="py-0" bg-color="transparent">
      <template v-for="(row, i) in rows" :key="row.slot.id">
        <v-divider v-if="i > 0" />
        <v-list-item
          class="py-3"
          :base-color="row.conflicts.length ? 'warning' : undefined"
          :aria-label="`${row.slot.name}: ${row.display.title ?? 'Pick a meal'}. Tap to change.`"
          @click="emit('pick', row.slot.id)"
        >
          <div class="text-overline text-medium-emphasis" style="line-height: 1.5">
            {{ row.slot.name }}
          </div>

          <div v-if="row.display.title" class="text-h6 text-high-emphasis">
            {{ row.display.title }}
          </div>
          <div v-else class="text-h6 text-disabled">
            <v-icon icon="mdi-plus-circle-outline" size="small" /> Pick a meal
          </div>

          <!-- The backup meal no longer applies while the special day is on. HTML maps <s> to the
               deletion role; it is spelled out because aria-query (Testing Library) maps only <del>. -->
          <s
            v-if="row.display.backup"
            role="deletion"
            class="d-block text-body-2 text-medium-emphasis"
          >
            {{ row.display.backup }}
          </s>

          <div
            v-for="v in row.display.versions"
            :key="v.label"
            class="text-body-2 text-medium-emphasis"
          >
            {{ v.label }}: {{ v.text }}
          </div>

          <div
            v-if="
              row.cell?.leftover || row.cell?.locked || (row.special && !row.cell?.specialActive)
            "
            class="d-flex flex-wrap ga-1 mt-1"
          >
            <v-chip v-if="row.cell?.leftover" size="small" prepend-icon="mdi-recycle">
              Leftovers
            </v-chip>
            <v-chip v-if="row.cell?.locked" size="small" prepend-icon="mdi-lock">
              Hand-picked
            </v-chip>
            <v-chip
              v-if="row.special && !row.cell?.specialActive"
              size="small"
              variant="outlined"
              prepend-icon="mdi-help-circle-outline"
            >
              {{ row.special.label }}?
            </v-chip>
          </div>

          <v-alert
            v-for="c in row.conflicts"
            :key="c.eater"
            class="mt-2"
            type="warning"
            variant="tonal"
            density="compact"
            :text="c.message"
          />

          <template #append>
            <v-icon icon="mdi-chevron-right" />
          </template>
        </v-list-item>
      </template>
    </v-list>
  </v-card>
</template>
