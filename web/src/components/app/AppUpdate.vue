<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

/** How often an open app asks the server whether a newer version is deployed. */
const CHECK_EVERY_MS = 60 * 60 * 1000

// vite-plugin-pwa's prompt flow: the new version waits until she taps Reload,
// so a page never swaps out from under her mid-edit.
const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => registration.update(), CHECK_EVERY_MS)
  },
})
</script>

<template>
  <v-snackbar v-model="needRefresh" timeout="-1" location="top">
    A new version of the app is ready.
    <template #actions>
      <v-btn color="secondary" variant="flat" @click="updateServiceWorker()">Reload</v-btn>
    </template>
  </v-snackbar>
</template>
