<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { loadPrepChecks, savePrepChecks } from '@/lib/today'
import { useAppStore } from '@/stores/app'

const props = defineProps<{
  /** Rotation day being prepped for. */
  day: number
  /** Identifies this night's list (e.g. tomorrow's date), so ticks reset the next night. */
  listKey: string
}>()

const app = useAppStore()

const items = computed(() =>
  app.prepFor(props.day).items.map((item) => ({ ...item, id: `${item.slotId}:${item.text}` })),
)
const done = ref<string[]>([])

watch(
  () => props.listKey,
  async (key) => {
    done.value = await loadPrepChecks(key)
  },
  { immediate: true },
)

function toggle(id: string, checked: boolean | null) {
  done.value = checked ? [...done.value, id] : done.value.filter((t) => t !== id)
  void savePrepChecks(props.listKey, done.value)
}
</script>

<template>
  <section class="mb-4">
    <h2 class="text-h6 mb-2">Tonight's prep for tomorrow</h2>
    <v-card v-if="items.length === 0" variant="tonal">
      <v-card-text class="text-body-1">Nothing to prep tonight.</v-card-text>
    </v-card>
    <v-card v-else>
      <v-list class="py-0">
        <v-list-item v-for="item in items" :key="item.id" class="py-1">
          <v-checkbox
            :model-value="done.includes(item.id)"
            :label="item.text"
            hide-details
            density="comfortable"
            @update:model-value="toggle(item.id, $event)"
          />
        </v-list-item>
      </v-list>
    </v-card>
  </section>
</template>
