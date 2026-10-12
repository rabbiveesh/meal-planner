<script setup lang="ts">
import { formatNeed } from '@/lib/shopping'
import { useShoppingStore } from '@/stores/shopping'

/** In the store: everything not marked "have enough", ticked off as it goes in the cart. */
const shopping = useShoppingStore()
</script>

<template>
  <div>
    <v-empty-state
      v-if="!shopping.toBuy.length"
      icon="mdi-cart-check"
      title="Nothing to buy"
      text="Everything was marked as having enough."
    />

    <template v-else>
      <div class="text-h6 mb-2">
        {{ shopping.boughtCount }} of {{ shopping.toBuy.length }} in the cart
      </div>

      <section v-for="group in shopping.toBuyGroups" :key="group.category" class="mb-4">
        <h2 class="text-h5 font-weight-bold mb-1">{{ group.category }}</h2>
        <v-list class="py-0">
          <v-list-item
            v-for="item in group.items"
            :key="item.key"
            min-height="64"
            @click="shopping.setBought(item, !shopping.isBought(item))"
          >
            <template #prepend>
              <v-checkbox-btn
                :model-value="shopping.isBought(item)"
                :aria-label="item.name"
                color="primary"
                density="comfortable"
                @click.stop
                @update:model-value="shopping.setBought(item, !!$event)"
              />
            </template>
            <v-list-item-title
              class="text-h6 text-wrap"
              :class="{
                'text-decoration-line-through text-medium-emphasis': shopping.isBought(item),
              }"
            >
              {{ item.name }}
            </v-list-item-title>
            <v-list-item-subtitle v-if="formatNeed(item)" class="text-body-1">
              {{ formatNeed(item) }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </section>
    </template>
  </div>
</template>
