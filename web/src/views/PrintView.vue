<script setup lang="ts">
// A clean fridge chart for one view: a table per week, days down, slots across, big type
// and plenty of room to write on by hand.
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { format, parseISO } from 'date-fns'

import { cellDisplay, isView, slotsFor, viewLabel } from '@/lib/plan'
import { WEEKDAYS, weekDays } from '@/lib/rotation'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const route = useRoute()
const router = useRouter()

const view = computed(() => (isView(route.params.view) ? route.params.view : null))
const slots = computed(() => (view.value ? slotsFor(app.household.slots, view.value) : []))
const startLabel = computed(() => format(parseISO(app.data.rotationStart), 'EEEE d MMMM yyyy'))

const weeks = computed(() =>
  ([0, 1] as const).map((w) => ({
    label: w ? 'Week B' : 'Week A',
    rows: weekDays(w).map((day) => ({
      day,
      weekday: WEEKDAYS[day % 7],
      cells: slots.value.map((slot) => {
        if (!slot.days.includes(day % 7)) return { slotId: slot.id, planned: false, display: null }
        const cell = app.cell(day, slot.id)
        const special = app.special(day, slot.id)
        return {
          slotId: slot.id,
          planned: true,
          display: cellDisplay(cell, app.meal(cell?.mealId), special),
        }
      }),
    })),
  })),
)

function back() {
  if (window.history.state?.back) router.back()
  else void router.push({ name: 'plan', query: view.value ? { view: view.value } : {} })
}

function print() {
  window.print()
}
</script>

<template>
  <div class="print-chart">
    <div class="no-print d-flex ga-2 mb-4">
      <v-btn variant="tonal" prepend-icon="mdi-arrow-left" @click="back">Back</v-btn>
      <v-spacer />
      <v-btn v-if="view" color="primary" prepend-icon="mdi-printer" @click="print">Print</v-btn>
    </div>

    <v-alert v-if="!view" type="error" variant="tonal" text="There is no chart with that name." />

    <template v-else>
      <v-alert
        v-if="!slots.length"
        type="info"
        variant="tonal"
        text="This chart has no meals of the day set up yet."
      />

      <template v-else>
        <section v-for="w in weeks" :key="w.label" class="week">
          <h1 class="text-h5 mb-1">{{ viewLabel(view) }} · {{ w.label }}</h1>
          <div class="text-body-2 text-medium-emphasis mb-2">Rotation started {{ startLabel }}</div>

          <table class="chart">
            <thead>
              <tr>
                <th class="day-col" />
                <th v-for="s in slots" :key="s.id">{{ s.name }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in w.rows" :key="r.day">
                <th class="day-col" scope="row">{{ r.weekday }}</th>
                <td v-for="c in r.cells" :key="c.slotId" :class="{ off: !c.planned }">
                  <template v-if="c.display">
                    <div class="meal">{{ c.display.title }}</div>
                    <div v-if="c.display.backup" class="version struck">
                      {{ c.display.backup }}
                    </div>
                    <div v-for="v in c.display.versions" :key="v.label" class="version">
                      {{ v.label }}: {{ v.text }}
                    </div>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.week + .week {
  margin-top: 2rem;
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
}

.chart thead th {
  font-size: 1rem;
}

.day-col {
  width: 7rem;
  font-size: 1.1rem;
}

/* Tall rows leave room to write on the chart by hand. */
.chart tbody tr {
  height: 6rem;
}

.meal {
  font-size: 1.3rem;
  font-weight: 600;
  line-height: 1.25;
}

.version {
  font-size: 0.9rem;
  opacity: 0.75;
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
  /* Landscape on whatever paper the printer uses. */
  @page {
    size: landscape;
    margin: 1cm;
  }

  .print-chart {
    color: #000;
  }

  .chart th,
  .chart td {
    border-color: #000;
  }

  /* One week per page, never split across two. */
  .week {
    break-inside: avoid;
  }
  .week + .week {
    margin-top: 0;
    break-before: page;
  }

  .chart tbody tr {
    height: 2.6cm;
  }
}
</style>
