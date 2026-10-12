<script setup lang="ts">
import { ref } from 'vue'

import { emptyData, importJson } from '@/data/repository'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const loading = ref(false)

async function useStarter() {
  loading.value = true
  try {
    const starter = await import('@/data/templates/starter.json')
    const data = importJson(JSON.stringify(starter.default))
    // The template's start date is only an example: start the rotation this week.
    app.replaceAll({ ...data, rotationStart: emptyData().rotationStart })
    app.regenerate()
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-card class="mb-4" variant="tonal" color="primary">
    <v-card-title class="text-h5 text-wrap">Welcome!</v-card-title>
    <v-card-text class="text-body-1">
      <p class="mb-3">
        Let's get your meal plan going. You can start from a ready-made example household with some
        everyday meals, or start with a blank slate and enter everything yourself.
      </p>
      <p>
        The example uses placeholder names (Parent 1, Child 1...). You can rename everyone and
        change anything in Setup.
      </p>
    </v-card-text>
    <v-card-actions class="flex-column align-stretch ga-2 pa-4">
      <v-btn variant="flat" color="primary" block :loading="loading" @click="useStarter">
        Start from the starter template
      </v-btn>
      <v-btn variant="outlined" block to="/setup">Start blank</v-btn>
    </v-card-actions>
  </v-card>
</template>
