<script setup lang="ts">
// Which Sunday starts week A of the two-week rotation.
import { computed, ref } from 'vue'
import { format, isSunday, isValid, parseISO, startOfWeek } from 'date-fns'

import { dayLabel } from '@/lib/rotation'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const error = ref('')

const start = computed<Date>(() => parseISO(app.data.rotationStart))

function setStart(value: unknown) {
  const date = value instanceof Date ? value : null
  if (!date || !isValid(date)) return
  if (!isSunday(date)) {
    error.value = 'Pick a Sunday'
    return
  }
  error.value = ''
  app.setRotationStart(format(date, 'yyyy-MM-dd'))
}

function startThisWeek() {
  setStart(startOfWeek(new Date(), { weekStartsOn: 0 }))
}

const allowed = (d: unknown) => d instanceof Date && isSunday(d)
</script>

<template>
  <v-card title="Two-week rotation" class="mb-4">
    <v-card-text>
      <p class="mb-3">
        Today is <strong data-test="today">{{ dayLabel(app.today) }}</strong
        >.
      </p>
      <v-date-input
        :model-value="start"
        label="Week A starts on Sunday"
        :allowed-dates="allowed"
        :error-messages="error"
        prepend-icon=""
        prepend-inner-icon="mdi-calendar"
        @update:model-value="setStart"
      />
      <v-btn variant="tonal" @click="startThisWeek">Make this week week A</v-btn>
    </v-card-text>
  </v-card>
</template>
