<script setup lang="ts">
import { computed, ref } from 'vue'

import type { StapleItem } from '@/data/schema'
import { DEFAULT_CATEGORY, groupByCategory } from '@/lib/shopping'
import { useShoppingStore } from '@/stores/shopping'
import BulkPasteDialog from './BulkPasteDialog.vue'
import StapleDialog from './StapleDialog.vue'

/** Her store master list: things she buys every trip, in her store's order. */
const shopping = useShoppingStore()

const groups = computed(() =>
  groupByCategory(
    shopping.staples.map((s) => ({ staple: s, category: s.category.trim() || DEFAULT_CATEGORY })),
  ),
)

const editOpen = ref(false)
const editing = ref<StapleItem | null>(null)
const pasteOpen = ref(false)
const message = ref('')

function openEditor(staple: StapleItem | null) {
  editing.value = staple
  editOpen.value = true
}

function onImported({ added, skipped }: { added: number; skipped: number }) {
  message.value = `Added ${added} items` + (skipped ? `, ${skipped} were already there` : '')
}
</script>

<template>
  <div>
    <div class="d-flex flex-wrap ga-2 mb-4">
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openEditor(null)">Add item</v-btn>
      <v-btn prepend-icon="mdi-clipboard-text" @click="pasteOpen = true">Paste a list</v-btn>
    </div>

    <v-empty-state
      v-if="!shopping.staples.length"
      icon="mdi-format-list-bulleted"
      title="No master list yet"
      text="Add the things you buy every trip, or paste your whole store list at once."
    />

    <v-list v-else lines="one" class="text-h6">
      <template v-for="group in groups" :key="group.category">
        <v-list-subheader class="text-subtitle-1 font-weight-bold">
          {{ group.category }}
        </v-list-subheader>
        <v-list-item
          v-for="{ staple } in group.items"
          :key="staple.id"
          :title="staple.name"
          append-icon="mdi-pencil"
          @click="openEditor(staple)"
        />
      </template>
    </v-list>

    <StapleDialog v-model="editOpen" :staple="editing" />
    <BulkPasteDialog v-model="pasteOpen" @imported="onImported" />
    <v-snackbar :model-value="!!message" @update:model-value="message = ''">
      {{ message }}
    </v-snackbar>
  </div>
</template>
