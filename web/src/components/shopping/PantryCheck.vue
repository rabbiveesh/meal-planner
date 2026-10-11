<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { PantryMark } from '@/data/schema'
import { nextUnmarked, type ShoppingItem } from '@/lib/shopping'
import { useShoppingStore } from '@/stores/shopping'
import PantryItem from './PantryItem.vue'

/** Standing at the pantry: tap "Have enough" or "Need" for every item. */
const emit = defineEmits<{ done: [] }>()
const shopping = useShoppingStore()

const mode = ref<'one' | 'list'>('one')
const total = computed(() => shopping.items.length)
const progress = computed(() => (total.value ? (100 * shopping.checkedCount) / total.value : 0))

// One at a time: the item being shown. Starts at the first one not answered yet.
const index = ref(Math.max(0, nextUnmarked(shopping.items, shopping.marks)))
// The list can shrink (e.g. a meal was removed); never point past its end.
watch(total, (n) => {
  if (index.value >= n) index.value = Math.max(0, n - 1)
})
const current = computed<ShoppingItem | undefined>(() => shopping.items[index.value])
const allChecked = computed(() => total.value > 0 && shopping.checkedCount === total.value)

function markCurrent(value: PantryMark | null) {
  if (!current.value) return
  shopping.mark(current.value, value)
  if (!value) return
  const next = nextUnmarked(shopping.items, shopping.marks, index.value)
  if (next >= 0) index.value = next
}

function step(by: number) {
  index.value = (index.value + by + total.value) % total.value
}
</script>

<template>
  <div>
    <v-empty-state
      v-if="!total"
      icon="mdi-cupboard"
      title="Nothing to check yet"
      text="Add your master list, or plan some meals, and they will show up here."
    />

    <template v-else>
      <div class="d-flex align-center flex-wrap ga-3 mb-2">
        <div class="text-h6">{{ shopping.checkedCount }} of {{ total }} checked</div>
        <v-spacer />
        <v-btn-toggle v-model="mode" mandatory divided variant="outlined" density="comfortable">
          <v-btn value="one" prepend-icon="mdi-card-outline">One at a time</v-btn>
          <v-btn value="list" prepend-icon="mdi-format-list-bulleted">List</v-btn>
        </v-btn-toggle>
      </div>
      <v-progress-linear :model-value="progress" color="primary" height="10" rounded class="mb-4" />

      <v-alert
        v-if="allChecked"
        type="success"
        variant="tonal"
        class="mb-4"
        title="Pantry check done"
        text="Everything you marked as needed is on the shopping list."
      >
        <template #append>
          <v-btn color="success" variant="flat" @click="emit('done')">Shopping list</v-btn>
        </template>
      </v-alert>

      <template v-if="mode === 'one' && current">
        <div class="text-body-1 text-medium-emphasis mb-2">Item {{ index + 1 }} of {{ total }}</div>
        <PantryItem :item="current" :mark="shopping.marks[current.key]" large @mark="markCurrent" />
        <div class="d-flex justify-space-between mt-3">
          <v-btn variant="text" prepend-icon="mdi-chevron-left" @click="step(-1)">Back</v-btn>
          <v-btn variant="text" append-icon="mdi-chevron-right" @click="step(1)">Skip</v-btn>
        </div>
      </template>

      <template v-else-if="mode === 'list'">
        <section v-for="group in shopping.groups" :key="group.category" class="mb-4">
          <h2 class="text-h6 font-weight-bold mb-2">{{ group.category }}</h2>
          <PantryItem
            v-for="item in group.items"
            :key="item.key"
            :item="item"
            :mark="shopping.marks[item.key]"
            @mark="shopping.mark(item, $event)"
          />
        </section>
      </template>
    </template>
  </div>
</template>
