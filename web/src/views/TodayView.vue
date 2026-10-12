<script setup lang="ts">
// One day at a time, today by default. Swiping (or the arrows) turns to the next or previous
// day; tapping a meal changes it. The shown date lives in the URL so a refresh keeps her place.
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { addDays, format, isSameDay } from 'date-fns'

import SwapDialog from '@/components/plan/SwapDialog.vue'
import FirstRunCard from '@/components/today/FirstRunCard.vue'
import PrepChecklist from '@/components/today/PrepChecklist.vue'
import TodayMeals from '@/components/today/TodayMeals.vue'
import WeekQuestions from '@/components/today/WeekQuestions.vue'
import { dayLabel, rotationDay } from '@/lib/rotation'
import { dateParam, nextDay, shownDate } from '@/lib/today'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const route = useRoute()
const router = useRouter()

const now = new Date()
const firstRun = computed(() => app.firstRun || app.household.meals.length === 0)
const tomorrow = computed(() => nextDay(app.today))
const tomorrowKey = format(addDays(now, 1), 'yyyy-MM-dd')

const date = computed(() => shownDate(route.query.date, now))
const isToday = computed(() => isSameDay(date.value, now))
const day = computed(() => rotationDay(date.value, app.data.rotationStart))

/** Shows `to`; today needs no date in the URL. */
function show(to: Date) {
  const query = { ...route.query, date: isSameDay(to, now) ? undefined : dateParam(to) }
  void router.replace({ query })
}

/** Turns `days` days forward, or back when negative. */
function turn(days: number) {
  show(addDays(date.value, days))
}

// Like turning a page: the finger moves left to go forward a day.
const swipe = { left: () => turn(1), right: () => turn(-1) }

const swap = ref<string | null>(null)
const swapOpen = ref(false)
function openSwap(slotId: string) {
  swap.value = slotId
  swapOpen.value = true
}

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
  <div v-else v-touch="swipe" class="today">
    <header class="d-flex align-center ga-2 mb-4">
      <v-btn icon="mdi-chevron-left" variant="tonal" aria-label="Previous day" @click="turn(-1)" />
      <div class="flex-grow-1 text-center">
        <h1 class="text-h5">{{ format(date, 'EEEE, d MMMM') }}</h1>
        <div class="text-body-1 text-medium-emphasis">
          {{ isToday ? `Today · ${dayLabel(day)}` : dayLabel(day) }}
        </div>
      </div>
      <v-btn icon="mdi-chevron-right" variant="tonal" aria-label="Next day" @click="turn(1)" />
    </header>

    <v-btn
      v-if="!isToday"
      variant="text"
      color="primary"
      prepend-icon="mdi-calendar-today"
      block
      class="mb-4"
      @click="show(now)"
    >
      Back to today
    </v-btn>

    <v-btn
      v-if="isToday"
      to="/rescue"
      color="secondary"
      size="x-large"
      block
      prepend-icon="mdi-lifebuoy"
      class="mb-4"
    >
      Rescue me
    </v-btn>

    <TodayMeals :day="day" @pick="openSwap" />
    <template v-if="isToday">
      <WeekQuestions :today="app.today" />
      <PrepChecklist :day="tomorrow" :list-key="tomorrowKey" />
    </template>

    <SwapDialog v-if="swap" v-model="swapOpen" :day="day" :slot-id="swap" />
  </div>

  <v-snackbar v-model="snackbar" :text="snackbarText" color="success" timeout="4000" />
</template>

<style scoped>
/* Let the browser keep vertical scrolling and pinch zoom; sideways swipes are ours. */
.today {
  touch-action: pan-y pinch-zoom;
}
</style>
