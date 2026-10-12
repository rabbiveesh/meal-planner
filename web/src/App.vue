<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
onMounted(() => app.load())

const tabs = [
  { to: '/', icon: 'mdi-calendar-today', label: 'Today' },
  { to: '/plan', icon: 'mdi-table', label: 'Plan' },
  { to: '/rescue', icon: 'mdi-lifebuoy', label: 'Rescue' },
  { to: '/shopping', icon: 'mdi-cart', label: 'Shopping' },
  { to: '/meals', icon: 'mdi-silverware-fork-knife', label: 'Meals' },
]
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable">
      <v-app-bar-title>Meal Planner</v-app-bar-title>
      <template #append>
        <v-btn icon="mdi-cog" to="/setup" aria-label="Setup" />
      </template>
    </v-app-bar>

    <v-main>
      <v-alert v-if="app.loadError" type="error" class="ma-4" :text="app.loadError" />
      <v-container v-else-if="app.loaded" class="pa-3" style="max-width: 900px">
        <router-view />
      </v-container>
      <div v-else class="d-flex justify-center pa-8"><v-progress-circular indeterminate /></div>
    </v-main>

    <v-bottom-navigation grow>
      <v-btn v-for="t in tabs" :key="t.to" :to="t.to" exact>
        <v-icon :icon="t.icon" />
        <span>{{ t.label }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>
