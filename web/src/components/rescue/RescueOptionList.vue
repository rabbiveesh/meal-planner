<script setup lang="ts">
import type { MealOption } from '@/core'

defineProps<{
  options: MealOption[]
  /** How many of `options` (from the start) are confirmed ready. */
  ready: number
}>()

defineEmits<{ use: [option: MealOption] }>()
</script>

<template>
  <v-card v-for="(option, i) in options" :key="option.mealId" class="mb-3" data-test="option">
    <v-card-title class="text-h6 text-wrap d-flex align-center ga-2">
      {{ option.name }}
      <v-chip v-if="i < ready" color="success" size="small" prepend-icon="mdi-check">Ready</v-chip>
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
</template>
