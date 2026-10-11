<script setup lang="ts">
import { useId } from 'vue'

import type { MealOption } from '@/core'

defineProps<{
  options: MealOption[]
  /** How many of `options` (from the start) are confirmed ready. */
  ready: number
}>()

defineEmits<{ use: [option: MealOption] }>()

// A list of option cards, each named by its meal. Name the list itself by passing
// aria-labelledby (attributes fall through to the list).
const nameId = useId()
</script>

<template>
  <div role="list">
    <v-card
      v-for="(option, i) in options"
      :key="option.mealId"
      role="listitem"
      :aria-labelledby="`${nameId}-${i}`"
      class="mb-3"
    >
      <v-card-title class="text-h6 text-wrap d-flex align-center ga-2">
        <span :id="`${nameId}-${i}`">{{ option.name }}</span>
        <v-chip v-if="i < ready" color="success" size="small" prepend-icon="mdi-check">
          Ready
        </v-chip>
      </v-card-title>
      <v-card-text v-if="option.warnings.length" class="pb-0">
        <v-alert
          v-for="w in option.warnings"
          :key="w"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-2"
          :text="w"
        />
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-btn
          block
          :variant="i < ready ? 'flat' : 'outlined'"
          color="primary"
          @click="$emit('use', option)"
        >
          Use this
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>
