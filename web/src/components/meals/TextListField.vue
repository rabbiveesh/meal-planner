<script setup lang="ts">
// An editable list of short lines, e.g. night-before prep tasks or rescue questions.
const model = defineModel<string[]>({ required: true })

defineProps<{
  label: string
  addText: string
  placeholder?: string
}>()

function add() {
  model.value = [...model.value, '']
}

function remove(i: number) {
  model.value = model.value.filter((_, j) => j !== i)
}

function set(i: number, value: string) {
  model.value = model.value.map((v, j) => (j === i ? value : v))
}
</script>

<template>
  <div class="mb-4">
    <div class="text-subtitle-1 mb-1">{{ label }}</div>
    <v-text-field
      v-for="(line, i) in model"
      :key="i"
      :model-value="line"
      :placeholder="placeholder"
      density="comfortable"
      hide-details
      class="mb-2"
      @update:model-value="set(i, $event)"
    >
      <template #append>
        <v-btn
          icon="mdi-close"
          variant="text"
          :aria-label="`Remove line ${i + 1}`"
          @click="remove(i)"
        />
      </template>
    </v-text-field>
    <v-btn prepend-icon="mdi-plus" variant="tonal" @click="add">{{ addText }}</v-btn>
  </div>
</template>
