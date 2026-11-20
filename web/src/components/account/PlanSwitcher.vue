<script setup lang="ts">
// Which plan the app shows, once she has more than one: her own, and any she shares.
import { useAccountStore } from '@/stores/account'

const account = useAccountStore()
</script>

<template>
  <v-menu v-if="account.plans.length > 1">
    <template #activator="{ props: menu }">
      <v-btn
        v-bind="menu"
        variant="text"
        class="text-none"
        prepend-icon="mdi-account-group"
        append-icon="mdi-menu-down"
        :aria-label="`Plan: ${account.current?.name ?? ''}. Switch plan`"
        data-test="plan-switcher"
      >
        <span class="plan-name">{{ account.current?.name }}</span>
      </v-btn>
    </template>
    <v-list :selected="[account.current?.id]" color="primary">
      <v-list-subheader>Show the plan</v-list-subheader>
      <v-list-item
        v-for="plan in account.plans"
        :key="plan.id"
        :value="plan.id"
        :title="plan.name"
        :subtitle="plan.members.length > 1 ? `Shared by ${plan.members.length} people` : undefined"
        @click="account.switchTo(plan.id)"
      />
    </v-list>
  </v-menu>
</template>

<style scoped>
.plan-name {
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
