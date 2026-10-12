<script setup lang="ts">
// The ingredients of one meal: item, amount per adult and per child serving, unit and
// store category. Stacked rows rather than a wide table so it fits a phone screen.
import type { Ingredient } from '@/core'
import { newIngredient } from '@/lib/meals'

const model = defineModel<Ingredient[]>({ required: true })

defineProps<{
  /** Suggestions from ingredients she already entered, so names stay consistent. */
  items: string[]
  units: string[]
  categories: string[]
}>()

function add() {
  model.value = [...model.value, newIngredient()]
}

function remove(i: number) {
  model.value = model.value.filter((_, j) => j !== i)
}

function set<K extends keyof Ingredient>(i: number, key: K, value: Ingredient[K] | null) {
  model.value = model.value.map((ing, j) => (j === i ? { ...ing, [key]: value ?? undefined } : ing))
}
</script>

<template>
  <div class="mb-4">
    <div class="text-subtitle-1 mb-1">Ingredients</div>
    <v-sheet
      v-for="(ing, i) in model"
      :key="i"
      border
      rounded="lg"
      class="pa-3 mb-2"
      data-test="ingredient"
    >
      <div class="d-flex align-center ga-2">
        <v-combobox
          :model-value="ing.item"
          :items="items"
          label="Item"
          density="comfortable"
          hide-details
          @update:model-value="set(i, 'item', $event ?? '')"
        />
        <v-btn
          icon="mdi-delete"
          variant="text"
          :aria-label="`Remove ${ing.item || 'ingredient'}`"
          @click="remove(i)"
        />
      </div>
      <v-row dense class="mt-1">
        <v-col cols="6" sm="3">
          <v-number-input
            :model-value="ing.perAdult ?? null"
            label="Per adult"
            :min="0"
            :precision="null"
            control-variant="hidden"
            density="comfortable"
            hide-details
            @update:model-value="set(i, 'perAdult', $event)"
          />
        </v-col>
        <v-col cols="6" sm="3">
          <v-number-input
            :model-value="ing.perChild ?? null"
            label="Per child"
            :min="0"
            :precision="null"
            control-variant="hidden"
            density="comfortable"
            hide-details
            @update:model-value="set(i, 'perChild', $event)"
          />
        </v-col>
        <v-col cols="6" sm="3">
          <v-combobox
            :model-value="ing.unit ?? null"
            :items="units"
            label="Unit"
            density="comfortable"
            hide-details
            @update:model-value="set(i, 'unit', $event)"
          />
        </v-col>
        <v-col cols="6" sm="3">
          <v-combobox
            :model-value="ing.category ?? null"
            :items="categories"
            label="Category"
            density="comfortable"
            hide-details
            @update:model-value="set(i, 'category', $event)"
          />
        </v-col>
      </v-row>
    </v-sheet>
    <v-btn prepend-icon="mdi-plus" variant="tonal" @click="add">Add ingredient</v-btn>
  </div>
</template>
