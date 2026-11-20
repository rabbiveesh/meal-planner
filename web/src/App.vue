<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AppUpdate from '@/components/app/AppUpdate.vue'
import ConflictsCard from '@/components/app/ConflictsCard.vue'
import WelcomeBurst from '@/components/welcome/WelcomeBurst.vue'
import { useAccountStore } from '@/stores/account'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const account = useAccountStore()
// Loads the data from this phone, or from the account once sign-in says who is signed in.
onMounted(() => account.follow())

// The welcome shows once per app open, even when signing in loads the data again.
const opened = ref(false)
watch(
  () => app.loaded,
  (loaded) => (opened.value ||= loaded),
  { immediate: true },
)

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
        <v-alert
          v-if="app.saveError"
          type="error"
          variant="tonal"
          class="mb-4"
          :text="`Your last change wasn't saved: ${app.saveError}`"
        />
        <ConflictsCard />
        <router-view />
      </v-container>
      <div v-else class="d-flex justify-center pa-8"><v-progress-circular indeterminate /></div>
      <!-- Once per app open: App stays mounted while she moves between sections. -->
      <WelcomeBurst v-if="opened" :name="app.data.userName" />
      <AppUpdate />
    </v-main>

    <!-- Vuetify stacks `app` layout items in tree order, and views render inside
         v-main, above this in the tree. order="-1" makes the nav the outermost
         bottom item, so a view's `app` FAB or bar sits above it, not on it. -->
    <v-bottom-navigation grow order="-1" tag="nav" aria-label="Sections">
      <v-btn v-for="t in tabs" :key="t.to" :to="t.to" exact>
        <v-icon :icon="t.icon" />
        <span>{{ t.label }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>
