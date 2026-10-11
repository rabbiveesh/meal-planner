<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import RescueOptionList from '@/components/rescue/RescueOptionList.vue'
import type { Kashrut, MealOption, RescueAnswer } from '@/core'
import { kashrutLabel } from '@/lib/labels'
import { slotsOn, upcomingSlot } from '@/lib/today'
import { useAppStore } from '@/stores/app'

type KashrutChoice = Kashrut | 'either'

const app = useAppStore()
const router = useRouter()

const slots = computed(() => slotsOn(app.household, app.today))
const slotId = ref<string | undefined>()
const kashrut = ref<KashrutChoice | undefined>()
const answers = ref<RescueAnswer[]>([])

const kashrutChoices: { value: KashrutChoice; label: string }[] = [
  ...(['meat', 'dairy'] as const).map((k) => ({ value: k, label: kashrutLabel(k).title })),
  { value: 'either', label: 'Either' },
]

function startOver() {
  slotId.value = upcomingSlot(slots.value, new Date())?.id
  kashrut.value = undefined
  answers.value = []
}
startOver()

// A different meal or kashrut choice brings up different questions.
watch([slotId, kashrut], () => {
  answers.value = []
})

const slotName = computed(() => slots.value.find((s) => s.id === slotId.value)?.name ?? '')
const hasRescueMeals = computed(
  () =>
    slotId.value != null &&
    app.household.meals.some((m) => m.rescue && m.slots.includes(slotId.value!)),
)

const result = computed(() =>
  slotId.value && hasRescueMeals.value
    ? app.rescue({
        day: app.today,
        slotId: slotId.value,
        kashrut: kashrut.value === 'either' ? undefined : kashrut.value,
        answers: answers.value,
      })
    : undefined,
)

function answer(yes: boolean) {
  const question = result.value?.nextQuestion
  if (question) answers.value = [...answers.value, { question, yes }]
}

function use(option: MealOption) {
  if (!slotId.value) return
  app.setCell(app.today, slotId.value, option.mealId)
  void router.push({
    name: 'today',
    state: { snackbar: `${option.name} is on the plan for ${slotName.value}` },
  })
}
</script>

<template>
  <div class="d-flex align-center mb-4">
    <h1 class="text-h5 flex-grow-1">Rescue me</h1>
    <v-btn variant="text" prepend-icon="mdi-restart" @click="startOver">Start over</v-btn>
  </div>

  <v-card v-if="slots.length === 0" variant="tonal">
    <v-card-text class="text-body-1">No meals are planned today.</v-card-text>
  </v-card>

  <template v-else>
    <section class="mb-4">
      <h2 class="text-h6 mb-2">Which meal?</h2>
      <v-chip-group v-model="slotId" mandatory column selected-class="bg-primary">
        <v-chip v-for="s in slots" :key="s.id" :value="s.id" size="large" filter>
          {{ s.name }}
        </v-chip>
      </v-chip-group>
    </section>

    <v-card v-if="!hasRescueMeals" variant="tonal" color="info">
      <v-card-text class="text-body-1">
        You don't have any rescue meals for {{ slotName }} yet. Rescue meals are quick meals you can
        always fall back on, like hot dogs or frozen fries. Mark some meals as rescue meals in Meals
        and they'll show up here.
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-btn variant="flat" color="primary" block to="/meals">Go to Meals</v-btn>
      </v-card-actions>
    </v-card>

    <template v-else-if="result">
      <section class="mb-4">
        <h2 class="text-h6 mb-2">Meat, dairy, or either?</h2>
        <v-chip-group v-model="kashrut" column selected-class="bg-primary">
          <v-chip v-for="k in kashrutChoices" :key="k.value" :value="k.value" size="large" filter>
            {{ k.label }}
          </v-chip>
        </v-chip-group>
      </section>

      <v-card
        v-if="kashrut && result.nextQuestion"
        class="mb-4"
        color="primary"
        variant="tonal"
        data-test="question"
      >
        <v-card-title class="text-h6 text-wrap">{{ result.nextQuestion }}</v-card-title>
        <v-card-actions class="ga-2 px-4 pb-4">
          <v-btn
            class="flex-grow-1"
            size="x-large"
            variant="flat"
            color="primary"
            @click="answer(true)"
          >
            Yes
          </v-btn>
          <v-btn
            class="flex-grow-1"
            size="x-large"
            variant="outlined"
            color="primary"
            @click="answer(false)"
          >
            No
          </v-btn>
        </v-card-actions>
      </v-card>

      <section>
        <h2 class="text-h6 mb-2">
          <template v-if="result.options.length === 0">Nothing fits</template>
          <template v-else-if="result.ready"> {{ result.ready }} ready to go </template>
          <template v-else>Options</template>
        </h2>
        <p v-if="result.options.length === 0" class="text-body-1">
          None of your rescue meals fit these answers. Try "Either" or start over.
        </p>
        <RescueOptionList :options="result.options" :ready="result.ready" @use="use" />
      </section>
    </template>
  </template>
</template>
