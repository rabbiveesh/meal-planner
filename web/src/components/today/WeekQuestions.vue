<script setup lang="ts">
// This week's special-day questions. Answers are kept by date, so a new week brings new
// questions (from Shabbos on, they are about the coming week) and each one flies off the
// screen once she answers it. She can still change an answer by tapping that day's meal.
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
  specialsThisWeek(app.household, props.today)
    // undefined = not asked yet; the backup meal stays planned until she says yes.
    .filter(({ day, special }) => app.specialAnswer(day, special.slotId) === undefined)
    .map(({ day, special }) => ({
      key: `${day}-${special.slotId}`,
      day,
      special,
      backup: app.meal(app.cell(day, special.slotId)?.mealId)?.name,
    })),
)
</script>

<template>
  <!-- The last card takes the heading with it. -->
  <Transition name="fly-off">
    <section v-if="questions.length" :aria-labelledby="headingId" class="questions mb-4">
      <h2 :id="headingId" class="text-h6 mb-2">Questions this week</h2>
      <TransitionGroup name="fly-off">
        <v-card
          v-for="q in questions"
          :key="q.key"
          role="group"
          :aria-labelledby="`${cardId}-${q.key}-day ${cardId}-${q.key}-question`"
          class="question mb-3"
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
              variant="outlined"
              color="primary"
              @click="app.setSpecialActive(q.day, q.special.slotId, true)"
            >
              Yes
            </v-btn>
            <v-btn
              class="flex-grow-1"
              variant="outlined"
              color="primary"
              @click="app.setSpecialActive(q.day, q.special.slotId, false)"
            >
              No
            </v-btn>
          </v-card-actions>
          <v-card-text class="pt-0 text-body-1" data-test="answer">
            <template v-if="q.backup">Planned: {{ q.backup }} (backup)</template>
            <template v-else>No backup meal planned yet</template>
          </v-card-text>
        </v-card>
      </TransitionGroup>
    </section>
  </Transition>
</template>

<style scoped>
/* Answered cards leave the flow while they fly, so the ones below slide up into place. */
.questions {
  position: relative;
}

.question.fly-off-leave-active {
  position: absolute;
  left: 0;
  right: 0;
}

.fly-off-leave-active {
  transition:
    transform 0.6s ease-in,
    opacity 0.6s ease-in;
}

.fly-off-leave-to {
  transform: translateX(110vw) rotate(8deg);
  opacity: 0;
}

.fly-off-move {
  transition: transform 0.4s ease;
}

@media (prefers-reduced-motion: reduce) {
  .fly-off-leave-active {
    transition: opacity 0.3s;
  }

  .fly-off-leave-to {
    transform: none;
  }

  .fly-off-move {
    transition: none;
  }
}
</style>
