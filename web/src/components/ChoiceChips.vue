<script lang="ts">
/** One chip: the value it stands for and how it is shown. */
export interface Choice<T> {
  value: T
  title: string
  icon?: string
  color?: string
}
</script>

<script setup lang="ts" generic="T extends string | number, M extends T | T[] | undefined">
// Tap-to-pick filter chips. Vuetify's chips have no role or selected state of their own, so
// each chip is a toggle button whose aria-pressed comes from the same model the group edits.
// An array model picks several chips; a single value picks one. Other attributes (mandatory,
// column, variant, selected-class, class, ...) go to v-chip-group.
const model = defineModel<M>({ required: true })

defineProps<
  {
    items: readonly Choice<T>[]
    /** Chip size, e.g. "large". */
    size?: string
  } & (
    | {
        /** Names the group for screen readers when no visible label names it. */
        label: string
        labelledby?: never
      }
    | {
        /** The id of the visible label that names the group. */
        labelledby: string
        label?: never
      }
  )
>()

function isPicked(value: T): boolean {
  const picked: unknown = model.value
  return Array.isArray(picked) ? picked.includes(value) : picked === value
}
</script>

<template>
  <v-chip-group
    v-model="model"
    role="group"
    :aria-label="label"
    :aria-labelledby="labelledby"
    :multiple="Array.isArray(model)"
  >
    <v-chip
      v-for="item in items"
      :key="item.value"
      :value="item.value"
      role="button"
      :aria-pressed="isPicked(item.value)"
      :color="item.color"
      :prepend-icon="item.icon"
      :size="size"
      filter
    >
      {{ item.title }}
    </v-chip>
  </v-chip-group>
</template>
