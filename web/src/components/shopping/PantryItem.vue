<script setup lang="ts">
import { computed } from 'vue'

import type { PantryMark } from '@/data/schema'
import { formatNeed, type ShoppingItem } from '@/lib/shopping'

/** One pantry-check item: what it is, how much the meals need, and Have / Need buttons. */
const props = defineProps<{
  item: ShoppingItem
  mark?: PantryMark
  /** Big card for one-at-a-time mode; a compact row for the list. */
  large?: boolean
}>()
const emit = defineEmits<{ mark: [value: PantryMark | null] }>()

const need = computed(() => formatNeed(props.item))

/** Tapping the chosen answer again clears it. */
function choose(value: PantryMark) {
  emit('mark', props.mark === value ? null : value)
}
</script>

<template>
  <v-card :variant="large ? 'elevated' : 'outlined'" :class="large ? 'pa-2' : 'mb-2'">
    <v-card-item>
      <v-card-title :class="large ? 'text-h4 text-wrap' : 'text-h6 text-wrap'">
        {{ item.name }}
      </v-card-title>
      <v-card-subtitle v-if="large" class="text-body-1">{{ item.category }}</v-card-subtitle>
    </v-card-item>
    <v-card-text :class="large ? 'text-h6' : 'text-body-1'">
      <div v-if="need">Need: {{ need }}</div>
      <div v-else>On your master list</div>
      <div v-if="item.meals.length" class="text-medium-emphasis">
        For: {{ item.meals.join(', ') }}
      </div>
    </v-card-text>
    <v-card-actions class="ga-2">
      <v-btn
        class="flex-grow-1"
        :size="large ? 'x-large' : 'large'"
        color="success"
        :variant="mark === 'have' ? 'flat' : 'outlined'"
        prepend-icon="mdi-check"
        :aria-pressed="mark === 'have'"
        @click="choose('have')"
      >
        Have enough
      </v-btn>
      <v-btn
        class="flex-grow-1"
        :size="large ? 'x-large' : 'large'"
        color="error"
        :variant="mark === 'need' ? 'flat' : 'outlined'"
        prepend-icon="mdi-cart-plus"
        :aria-pressed="mark === 'need'"
        @click="choose('need')"
      >
        Need
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
