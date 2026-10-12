<script setup lang="ts">
import { ref, useId, watch } from 'vue'

import type { StapleItem } from '@/data/schema'
import { useShoppingStore } from '@/stores/shopping'

/** Add a master-list item, or edit / remove one when `staple` is given. */
const props = defineProps<{ staple?: StapleItem | null }>()
const open = defineModel<boolean>({ required: true })

const shopping = useShoppingStore()
const name = ref('')
const category = ref<string | null>('')
const error = ref('')
const titleId = useId()

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    name.value = props.staple?.name ?? ''
    category.value = props.staple?.category ?? ''
    error.value = ''
  },
  { immediate: true },
)

function save() {
  const ok = props.staple
    ? shopping.updateStaple(props.staple.id, name.value, category.value ?? '')
    : shopping.addStaple(name.value, category.value ?? '')
  if (!ok) {
    error.value = name.value.trim() ? 'That item is already on the list.' : 'Enter a name.'
    return
  }
  open.value = false
}

function remove() {
  if (props.staple) shopping.removeStaple(props.staple.id)
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" :aria-labelledby="titleId" max-width="500">
    <v-card>
      <template #title>
        <span :id="titleId">{{ staple ? 'Edit item' : 'Add item' }}</span>
      </template>
      <v-card-text>
        <v-form @submit.prevent="save">
          <v-text-field
            v-model="name"
            label="Item"
            autofocus
            :error-messages="error"
            @update:model-value="error = ''"
          />
          <v-combobox
            v-model="category"
            :items="shopping.categories"
            label="Category / aisle"
            hint="Pick one or type a new one"
            persistent-hint
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-btn v-if="staple" color="error" prepend-icon="mdi-delete" @click="remove">Remove</v-btn>
        <v-spacer />
        <v-btn @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="save">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
