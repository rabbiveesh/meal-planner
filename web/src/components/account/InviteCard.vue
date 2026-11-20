<script setup lang="ts">
// Someone shared a meal plan with her: join it, or say no thanks.
import type { Tenant } from '@/account/tenants'
import { useAccountStore } from '@/stores/account'

const account = useAccountStore()

const sharedBy = (plan: Tenant) => plan.names[plan.owner] ?? 'Someone'
</script>

<template>
  <v-card
    v-for="plan in account.invites"
    :key="plan.id"
    variant="tonal"
    color="primary"
    class="mb-4"
    data-test="invite"
  >
    <v-card-text>
      <p class="text-body-large mb-3">
        <strong>{{ sharedBy(plan) }}</strong> shared the meal plan
        <strong>“{{ plan.name }}”</strong> with you. Join it to plan meals together. Your own plan
        stays as it is, and you can switch back to it any time.
      </p>
      <div class="d-flex flex-wrap ga-2">
        <v-btn color="primary" variant="flat" @click="account.accept(plan)">Join</v-btn>
        <v-btn variant="text" @click="account.decline(plan)">No thanks</v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>
