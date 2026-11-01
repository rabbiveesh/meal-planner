<script setup lang="ts">
// The week's fridge chart, laid out like her paper one: a title, the days down the side,
// a column per meal of the day, and big cells with room to write on by hand. One week fits
// one portrait page.
import { computed, useId } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { format, parseISO } from 'date-fns'

import { cellDisplay, chartSlots, weekOf } from '@/lib/plan'
import { WEEKDAYS, weekDays } from '@/lib/rotation'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const route = useRoute()
const router = useRouter()
const columnsId = useId()

// Week and columns live in the URL, so a refresh or the Back button keeps her choice.
const week = computed<0 | 1>({
  get: () => {
    const q = route.query.week
    return q === 'B' ? 1 : q === 'A' ? 0 : weekOf(app.today)
  },
  set: (w) => void router.replace({ query: { ...route.query, week: w ? 'B' : 'A' } }),
})

const slots = computed(() => {
  const q = route.query.slots
  const ids = typeof q === 'string' ? q.split(',').filter(Boolean) : null
  return chartSlots(app.household.slots, ids, 'home')
})

const picked = computed<string[]>({
  get: () => slots.value.map((s) => s.id),
  set: (ids) => void router.replace({ query: { ...route.query, slots: ids.join(',') } }),
})

const days = computed(() =>
  weekDays(week.value).map((day) => {
    const date = app.dateOf(day)
    return {
      day,
      date: parseISO(date),
      weekday: WEEKDAYS[day % 7],
      cells: slots.value.map((slot) => {
        const planned = slot.days.includes(day % 7)
        const cell = app.cell(day, slot.id)
        const special = app.special(day, slot.id)
        return {
          slotId: slot.id,
          planned,
          display:
            planned && !slot.handWritten
              ? cellDisplay(cell, app.meal(cell?.mealId), special)
              : null,
          // A special day she hasn't answered yet reads as an alternative, like "or Mom?".
          maybe:
            planned && special && !cell?.specialActive && app.specialAnswer(day, slot.id) == null
              ? special.label
              : null,
          note: planned ? app.note(date, slot.id) : '',
        }
      }),
    }
  }),
)

const dateRange = computed(() => {
  const first = days.value[0]?.date
  const last = days.value.at(-1)?.date
  if (!first || !last) return ''
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).formatRange(
    first,
    last,
  )
})

function back() {
  if (window.history.state?.back) router.back()
  else void router.push({ name: 'plan', query: { week: week.value ? 'B' : 'A' } })
}

function print() {
  window.print()
}
</script>

<template>
  <div class="week-chart">
    <div class="no-print d-flex ga-2 mb-4">
      <v-btn variant="tonal" prepend-icon="mdi-arrow-left" @click="back">Back</v-btn>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-printer" :disabled="!slots.length" @click="print">
        Print
      </v-btn>
    </div>

    <div class="no-print mb-4">
      <v-btn-toggle
        v-model="week"
        mandatory
        divided
        variant="outlined"
        color="primary"
        class="mb-3 d-flex"
      >
        <v-btn :value="0" class="flex-grow-1">Week A</v-btn>
        <v-btn :value="1" class="flex-grow-1">Week B</v-btn>
      </v-btn-toggle>

      <div :id="columnsId" class="text-subtitle-1">Columns on the chart</div>
      <v-chip-group
        v-model="picked"
        multiple
        column
        filter
        color="primary"
        :aria-labelledby="columnsId"
      >
        <v-chip v-for="s in app.household.slots" :key="s.id" :value="s.id" size="large">
          {{ s.name }}
        </v-chip>
      </v-chip-group>
    </div>

    <v-alert
      v-if="!slots.length"
      type="info"
      variant="tonal"
      text="Pick at least one meal of the day to put on the chart."
    />

    <section v-else class="sheet">
      <h1 class="title">Meal plan</h1>
      <div class="subtitle">{{ week ? 'Week B' : 'Week A' }} · {{ dateRange }}</div>

      <table class="chart">
        <thead>
          <tr>
            <th class="day-col"><span class="d-sr-only">Day</span></th>
            <th v-for="s in slots" :key="s.id">{{ s.name }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in days" :key="d.day">
            <th class="day-col" scope="row">
              <div class="weekday">{{ d.weekday }}</div>
              <div class="date">{{ format(d.date, 'd MMM') }}</div>
            </th>
            <td v-for="c in d.cells" :key="c.slotId" :class="{ off: !c.planned }">
              <template v-if="c.display">
                <div v-if="c.display.title" class="meal">{{ c.display.title }}</div>
                <div v-if="c.display.backup" class="version struck">{{ c.display.backup }}</div>
                <div v-for="v in c.display.versions" :key="v.label" class="version">
                  {{ v.label }}: {{ v.text }}
                </div>
              </template>
              <div v-if="c.maybe" class="version">or {{ c.maybe }}?</div>
              <div v-if="c.note" class="note">{{ c.note }}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.title {
  font-size: 2rem;
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
}

.subtitle {
  text-align: center;
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
  opacity: 0.8;
}

.chart {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.chart th,
.chart td {
  border: 1px solid rgba(var(--v-border-color), 0.6);
  padding: 0.4rem 0.5rem;
  vertical-align: top;
  text-align: left;
  overflow-wrap: break-word;
}

.chart thead th {
  font-size: 1.1rem;
  text-align: center;
}

.day-col {
  width: 7.5rem;
}

.weekday {
  font-size: 1.1rem;
}

.date {
  font-size: 0.9rem;
  font-weight: 400;
  opacity: 0.75;
}

/* Tall rows leave room to write on the chart by hand. */
.chart tbody tr {
  height: 7rem;
}

.meal {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.25;
}

.version {
  font-size: 0.95rem;
  opacity: 0.8;
}

.note {
  font-size: 0.95rem;
  font-style: italic;
  margin-top: 0.25rem;
}

.struck {
  text-decoration: line-through;
}

.off {
  background: repeating-linear-gradient(
    45deg,
    transparent 0 6px,
    rgba(var(--v-border-color), 0.15) 6px 8px
  );
}

@media print {
  /* Portrait, like the paper chart on her fridge. */
  @page {
    size: portrait;
    margin: 1cm;
  }

  .week-chart {
    color: #000;
  }

  .chart th,
  .chart td {
    border-color: #000;
  }

  /* The whole week on one page: six rows sized to fit A4 and Letter alike. */
  .sheet {
    break-inside: avoid;
  }

  .chart tbody tr {
    height: 3.4cm;
  }
}
</style>
