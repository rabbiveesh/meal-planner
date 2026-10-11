<script setup lang="ts">
// Tap-to-toggle weekday chips (0 = Sunday) instead of a dropdown: fewer taps on a phone.
import { shortWeekday } from '@/lib/labels'
import { ALL_WEEKDAYS } from '@/lib/household'

const model = defineModel<number[]>({ required: true })

withDefaults(
  defineProps<{
    label?: string
    hint?: string
    /** Weekdays offered. */
    days?: readonly number[]
  }>(),
  { label: undefined, hint: undefined, days: () => ALL_WEEKDAYS },
)
</script>

<template>
  <div class="mb-2">
    <div v-if="label" class="text-subtitle-1">{{ label }}</div>
    <v-chip-group v-model="model" multiple column selected-class="text-primary">
      <v-chip v-for="d in days" :key="d" :value="d" filter variant="outlined" size="large">
        {{ shortWeekday(d) }}
      </v-chip>
    </v-chip-group>
    <div v-if="hint" class="text-caption text-medium-emphasis">{{ hint }}</div>
  </div>
</template>
