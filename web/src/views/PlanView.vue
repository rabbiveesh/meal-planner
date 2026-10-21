<script setup lang="ts">
// The two-week rotation as separate, uncrowded charts (at home / take-along / breakfast),
// one week at a time, one card per day.
import { computed, ref, useId } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PlanDayCard from '@/components/plan/PlanDayCard.vue'
import SwapDialog from '@/components/plan/SwapDialog.vue'
import type { Conflict, View } from '@/core'
import { PLAN_VIEWS, isView, slotsFor, weekOf } from '@/lib/plan'
import { plannedSlots } from '@/lib/household'
import { CYCLE_DAYS, weekDays } from '@/lib/rotation'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const route = useRoute()
const router = useRouter()

// Chart and week live in the URL so coming back from Print (or a refresh) keeps her place.
const view = computed<View>({
  get: () => (isView(route.query.view) ? route.query.view : 'home'),
  set: (v) => void router.replace({ query: { ...route.query, view: v } }),
})
const week = computed<0 | 1>({
  get: () => {
    const q = route.query.week
    return q === 'B' ? 1 : q === 'A' ? 0 : weekOf(app.today)
  },
  set: (w) => void router.replace({ query: { ...route.query, week: w ? 'B' : 'A' } }),
})

const hasMeals = computed(() => app.household.meals.length > 0)
const hasPlan = computed(() => app.planWithAnswers.cells.some((c) => c.mealId))
const viewSlots = computed(() => slotsFor(plannedSlots(app.household.slots), view.value))

const days = computed(() =>
  weekDays(week.value)
    .map((day) => ({ day, slots: slotsFor(plannedSlots(app.household.slots), view.value, day) }))
    .filter((d) => d.slots.length > 0),
)

// Kashrut problems for every day of the rotation, from the core.
const conflicts = computed<Conflict[][]>(() =>
  Array.from({ length: CYCLE_DAYS }, (_, day) => app.checkDay(day)),
)

const swap = ref<{ day: number; slotId: string } | null>(null)
const swapOpen = ref(false)
function openSwap(day: number, slotId: string) {
  swap.value = { day, slotId }
  swapOpen.value = true
}

const confirmRegenerate = ref(false)
const confirmTitleId = useId()
const regenerated = ref(false)
function regenerate() {
  app.regenerate()
  confirmRegenerate.value = false
  regenerated.value = true
}
</script>

<template>
  <div>
    <v-empty-state
      v-if="!hasMeals"
      icon="mdi-silverware-fork-knife"
      headline="No meals yet"
      text="The plan is built only from your own meals. Add them first, or start from a template in Setup."
    >
      <template #actions>
        <v-btn color="primary" :to="{ name: 'meals' }">Add meals</v-btn>
        <v-btn variant="tonal" :to="{ name: 'setup' }">Setup</v-btn>
      </template>
    </v-empty-state>

    <template v-else>
      <div class="d-flex flex-wrap align-center ga-2 mb-3">
        <h1 class="text-h5 mr-auto">Two-week plan</h1>
        <v-btn color="primary" prepend-icon="mdi-autorenew" @click="confirmRegenerate = true">
          Make a new plan
        </v-btn>
        <v-btn variant="tonal" prepend-icon="mdi-printer" :to="{ name: 'print', params: { view } }">
          Print
        </v-btn>
      </div>

      <v-tabs v-model="view" grow color="primary" class="mb-3">
        <v-tab v-for="v in PLAN_VIEWS" :key="v.id" :value="v.id" class="text-body-1">
          {{ v.label }}
        </v-tab>
      </v-tabs>

      <v-btn-toggle
        v-model="week"
        mandatory
        divided
        variant="outlined"
        color="primary"
        class="mb-4 d-flex"
      >
        <v-btn :value="0" class="flex-grow-1">Week A</v-btn>
        <v-btn :value="1" class="flex-grow-1">Week B</v-btn>
      </v-btn-toggle>

      <v-alert
        v-if="!hasPlan"
        class="mb-4"
        type="info"
        variant="tonal"
        text="No plan yet. Tap “Make a new plan” and the app will fill both weeks from your meals."
      />

      <v-alert
        v-if="!viewSlots.length"
        type="info"
        variant="tonal"
        text="This chart has no meals of the day set up. You can add them in Setup."
      >
        <template #append>
          <v-btn variant="text" :to="{ name: 'setup' }">Setup</v-btn>
        </template>
      </v-alert>

      <div v-else class="d-flex flex-column ga-4">
        <PlanDayCard
          v-for="d in days"
          :key="d.day"
          :day="d.day"
          :slots="d.slots"
          :conflicts="conflicts[d.day] ?? []"
          :is-today="d.day === app.today"
          @pick="openSwap(d.day, $event)"
        />
      </div>
    </template>

    <SwapDialog v-if="swap" v-model="swapOpen" :day="swap.day" :slot-id="swap.slotId" />

    <v-dialog v-model="confirmRegenerate" :aria-labelledby="confirmTitleId" max-width="480">
      <v-card>
        <template #title>
          <span :id="confirmTitleId">Make a new plan?</span>
        </template>
        <v-card-text class="text-body-1">
          This fills both weeks again with fresh picks from your meals. Meals you picked by hand
          (marked “Hand-picked”) stay where they are.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmRegenerate = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" @click="regenerate">Make a new plan</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="regenerated" timeout="3000">New plan made</v-snackbar>
  </div>
</template>
