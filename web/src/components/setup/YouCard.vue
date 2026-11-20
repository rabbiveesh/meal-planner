<script setup lang="ts">
// Her name, for the welcome when the app opens. Kept on this phone: a shared plan has
// several people, each greeted by their own name.
import { useMeStore } from '@/stores/me'

const me = useMeStore()
</script>

<template>
  <v-card title="You" class="mb-4">
    <v-card-text>
      <v-text-field
        :model-value="me.name"
        label="Your name"
        hint="This phone greets you by this name when the app opens."
        persistent-hint
        @update:model-value="me.setName"
      />
    </v-card-text>
  </v-card>
</template>
