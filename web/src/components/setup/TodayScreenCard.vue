<script setup lang="ts">
// When the Today screen starts opening on tomorrow.
import { useAppStore } from '@/stores/app'

const app = useAppStore()

function setFrom(value: unknown) {
  if (typeof value === 'string' && value) app.setTomorrowFrom(value)
}
</script>

<template>
  <v-card title="Today screen" class="mb-4">
    <v-card-text>
      <v-text-field
        :model-value="app.data.tomorrowFrom"
        type="time"
        label="Show tomorrow from"
        hint="From this time each evening, the app opens on tomorrow's meals"
        persistent-hint
        @update:model-value="setFrom"
      />
    </v-card-text>
  </v-card>
</template>
