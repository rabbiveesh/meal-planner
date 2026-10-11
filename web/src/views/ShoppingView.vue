<script setup lang="ts">
import { ref, useId } from 'vue'

import PantryCheck from '@/components/shopping/PantryCheck.vue'
import ShoppingList from '@/components/shopping/ShoppingList.vue'
import StaplesEditor from '@/components/shopping/StaplesEditor.vue'
import { useShoppingStore } from '@/stores/shopping'

const shopping = useShoppingStore()

// Open on the store list once the pantry check is finished, otherwise on the check.
const allChecked = shopping.items.length > 0 && shopping.checkedCount === shopping.items.length
const tab = ref<'staples' | 'check' | 'list'>(allChecked ? 'list' : 'check')

const confirmOpen = ref(false)
const confirmTitleId = useId()
function startNewTrip() {
  shopping.newTrip()
  confirmOpen.value = false
  tab.value = 'check'
}
</script>

<template>
  <div>
    <div class="d-flex align-center mb-2">
      <h1 class="text-h5">Shopping</h1>
      <v-spacer />
      <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="confirmOpen = true">
        New trip
      </v-btn>
    </div>

    <v-tabs v-model="tab" grow class="mb-4">
      <v-tab value="staples">Master list</v-tab>
      <v-tab value="check">Pantry check</v-tab>
      <v-tab value="list">Shopping list</v-tab>
    </v-tabs>

    <v-tabs-window v-model="tab">
      <v-tabs-window-item value="staples"><StaplesEditor /></v-tabs-window-item>
      <v-tabs-window-item value="check"><PantryCheck @done="tab = 'list'" /></v-tabs-window-item>
      <v-tabs-window-item value="list"><ShoppingList /></v-tabs-window-item>
    </v-tabs-window>

    <v-dialog v-model="confirmOpen" :aria-labelledby="confirmTitleId" max-width="420">
      <v-card
        text="This clears the pantry check and the ticks on the shopping list. Your master list stays."
      >
        <template #title>
          <span :id="confirmTitleId">Start a new trip?</span>
        </template>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="confirmOpen = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" @click="startNewTrip">Start new trip</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
