<script setup lang="ts">
import { computed, useId } from 'vue'

import { dayLabel } from '@/lib/rotation'
import { specialsThisWeek } from '@/lib/today'
import { useAppStore } from '@/stores/app'

const props = defineProps<{ today: number }>()

const app = useAppStore()
const headingId = useId()
// Each question card is named by its day and question, at `${cardId}-<key>-day` / `-question`.
const cardId = useId()

const questions = computed(() =>
  specialsThisWeek(app.household, props.today).map(({ day, special }) => {
    const cell = app.cell(day, special.slotId)
    return {
      key: `${day}-${special.slotId}`,
      day,
      special,
      // undefined = not asked yet; the backup meal stays planned until she says yes.
      answer: app.specialAnswer(day, special.slotId),
      backup: app.meal(cell?.mealId)?.name,
    }
  }),
)
</script>

<template>
  <section v-if="questions.length" :aria-labelledby="headingId" class="mb-4">
    <h2 :id="headingId" class="text-h6 mb-2">Questions this week</h2>
    <v-card
      v-for="q in questions"
      :key="q.key"
      role="group"
      :aria-labelledby="`${cardId}-${q.key}-day ${cardId}-${q.key}-question`"
      class="mb-3"
    >
      <v-card-subtitle :id="`${cardId}-${q.key}-day`" class="pt-3">
        {{ dayLabel(q.day) }}
      </v-card-subtitle>
      <v-card-text :id="`${cardId}-${q.key}-question`" class="text-body-1 pb-2">
        {{ q.special.question }}
      </v-card-text>
      <v-card-actions class="ga-2 px-4">
        <v-btn
          class="flex-grow-1"
          :variant="q.answer === true ? 'flat' : 'outlined'"
          color="primary"
          :aria-pressed="q.answer === true"
          @click="app.setSpecialActive(q.day, q.special.slotId, true)"
        >
          Yes
        </v-btn>
        <v-btn
          class="flex-grow-1"
          :variant="q.answer === false ? 'flat' : 'outlined'"
          color="primary"
          :aria-pressed="q.answer === false"
          @click="app.setSpecialActive(q.day, q.special.slotId, false)"
        >
          No
        </v-btn>
      </v-card-actions>
      <v-card-text class="pt-0 text-body-1" data-test="answer">
        <template v-if="q.answer">Planned: {{ q.special.label }}</template>
        <template v-else-if="q.backup">Planned: {{ q.backup }} (backup)</template>
        <template v-else>No backup meal planned yet</template>
      </v-card-text>
    </v-card>
  </section>
</template>
