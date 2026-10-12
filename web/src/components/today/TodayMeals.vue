<script setup lang="ts">
import { computed } from 'vue'

import { slotsOn } from '@/lib/today'
import { useAppStore } from '@/stores/app'

const props = defineProps<{ day: number }>()

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
    <v-card-text class="text-body-1">Nothing is planned today. Enjoy!</v-card-text>
  </v-card>
  <v-card v-else class="mb-4">
    <v-list lines="three" class="py-0">
      <template v-for="(row, i) in rows" :key="row.slot.id">
        <v-divider v-if="i > 0" />
        <v-list-item class="py-3">
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
        </v-list-item>
      </template>
    </v-list>
  </v-card>
</template>
