<script setup lang="ts">
import type { Meal } from '@/core'
import { kashrutLabel, prepLabel } from '@/lib/labels'

defineProps<{ meal: Meal }>()
defineEmits<{ edit: [] }>()
</script>

<template>
  <v-list-item :title="meal.name" lines="two" class="py-2" @click="$emit('edit')">
    <template #subtitle>
      <div class="d-flex flex-wrap ga-1 mt-1">
        <v-chip
          :color="kashrutLabel(meal.kashrut).color"
          :prepend-icon="kashrutLabel(meal.kashrut).icon"
          size="small"
          label
        >
          {{ kashrutLabel(meal.kashrut).title }}
        </v-chip>
        <v-chip
          :color="prepLabel(meal.prep).color"
          :prepend-icon="prepLabel(meal.prep).icon"
          size="small"
          label
        >
          {{ prepLabel(meal.prep).title }}
        </v-chip>
        <v-chip v-if="meal.rescue" prepend-icon="mdi-lifebuoy" size="small" label>Rescue</v-chip>
        <v-chip v-if="meal.fun" prepend-icon="mdi-party-popper" size="small" label>Fun</v-chip>
      </div>
    </template>
    <template #append>
      <v-icon icon="mdi-chevron-right" />
    </template>
  </v-list-item>
</template>
