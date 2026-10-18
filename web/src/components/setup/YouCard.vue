<script setup lang="ts">
// Her name, for the welcome when the app opens.
import { useAppStore } from '@/stores/app'

const app = useAppStore()
</script>

<template>
  <v-card title="You" class="mb-4">
    <v-card-text>
      <v-text-field
        :model-value="app.data.userName"
        label="Your name"
        hint="The app greets you by this name when it opens."
        persistent-hint
        @update:model-value="app.setUserName"
      />
    </v-card-text>
  </v-card>
</template>
