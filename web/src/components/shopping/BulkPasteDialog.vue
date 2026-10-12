<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'

import { parseStapleList } from '@/lib/shopping'
import { useShoppingStore } from '@/stores/shopping'

/** Paste a whole store list at once, one item per line. */
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ imported: [result: { added: number; skipped: number }] }>()

const shopping = useShoppingStore()
const text = ref('')
const titleId = useId()

watch(open, (isOpen) => {
  if (isOpen) text.value = ''
})

const parsed = computed(() => parseStapleList(text.value))
const categoryCount = computed(() => new Set(parsed.value.map((p) => p.category)).size)

function add() {
  emit('imported', shopping.importStaples(text.value))
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" :aria-labelledby="titleId" max-width="600" scrollable>
    <v-card>
      <template #title>
        <span :id="titleId">Paste a list</span>
      </template>
      <v-card-text>
        <p class="mb-3">
          One item per line. A line ending with <strong>:</strong> starts a category, e.g.
          <em>Dairy:</em>. Or write <em>Dairy: milk</em> on one line. Items already on your list are
          skipped.
        </p>
        <v-textarea
          v-model="text"
          label="Your list"
          rows="10"
          auto-grow
          autofocus
          placeholder="Dairy:&#10;Milk&#10;Cottage cheese&#10;Bakery:&#10;Pitas"
        />
        <div class="text-body-1">
          {{ parsed.length }} items in {{ categoryCount }}
          {{ categoryCount === 1 ? 'category' : 'categories' }}
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!parsed.length" @click="add">
          Add {{ parsed.length }} items
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
