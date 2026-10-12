<script setup lang="ts">
// Tap-to-toggle weekday chips (0 = Sunday) instead of a dropdown: fewer taps on a phone.
import { computed, useId } from 'vue'

import ChoiceChips from '@/components/ChoiceChips.vue'
import { shortWeekday } from '@/lib/labels'
import { ALL_WEEKDAYS } from '@/lib/household'

const model = defineModel<number[]>({ required: true })

const props = withDefaults(
  defineProps<{
    /** Shown above the chips and names them for screen readers. */
    label: string
    hint?: string
    /** Weekdays offered. */
    days?: readonly number[]
  }>(),
  { hint: undefined, days: () => ALL_WEEKDAYS },
)

const labelId = useId()
const items = computed(() => props.days.map((d) => ({ value: d, title: shortWeekday(d) })))
</script>

<template>
  <div class="mb-2">
    <div :id="labelId" class="text-subtitle-1">{{ label }}</div>
    <ChoiceChips
      v-model="model"
      :items="items"
      :labelledby="labelId"
      size="large"
      variant="outlined"
      column
      selected-class="text-primary"
    />
    <div v-if="hint" class="text-caption text-medium-emphasis">{{ hint }}</div>
  </div>
</template>
