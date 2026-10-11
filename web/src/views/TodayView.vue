<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { addDays, format } from 'date-fns'

import FirstRunCard from '@/components/today/FirstRunCard.vue'
import PrepChecklist from '@/components/today/PrepChecklist.vue'
import TodayMeals from '@/components/today/TodayMeals.vue'
import WeekQuestions from '@/components/today/WeekQuestions.vue'
import { dayLabel } from '@/lib/rotation'
import { nextDay } from '@/lib/today'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const route = useRoute()
const router = useRouter()

const now = new Date()
const firstRun = computed(() => app.firstRun || app.household.meals.length === 0)
const tomorrow = computed(() => nextDay(app.today))
const tomorrowKey = format(addDays(now, 1), 'yyyy-MM-dd')

// Other screens (e.g. Rescue) can send a message here through the navigation's history state.
const snackbarText = ref<string>(String(router.options.history.state.snackbar ?? ''))
const snackbar = ref(snackbarText.value !== '')
if (snackbar.value) {
  // Drop it from history so a reload or "back" doesn't show it again.
  void router.replace({ path: route.fullPath, state: {}, force: true })
}
</script>

<template>
  <FirstRunCard v-if="firstRun" />
  <template v-else>
    <header class="mb-4">
      <h1 class="text-h5">{{ format(now, 'EEEE, d MMMM') }}</h1>
      <div class="text-body-1 text-medium-emphasis">{{ dayLabel(app.today) }}</div>
    </header>

    <v-btn
      to="/rescue"
      color="secondary"
      size="x-large"
      block
      prepend-icon="mdi-lifebuoy"
      class="mb-4"
    >
      Rescue me
    </v-btn>

    <TodayMeals :day="app.today" />
    <WeekQuestions :today="app.today" />
    <PrepChecklist :day="tomorrow" :list-key="tomorrowKey" />
  </template>

  <v-snackbar v-model="snackbar" :text="snackbarText" color="success" timeout="4000" />
</template>
