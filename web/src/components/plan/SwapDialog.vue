<script setup lang="ts">
// Swap one cell by hand: the core's meal options for it (good fits first, the rest with
// their warnings), plus clear, keep-on-regenerate and the cell's special day, if it has one.
import { computed, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'

import type { MealOption } from '@/core'
import { groupOptions } from '@/lib/plan'
import { dayLabel } from '@/lib/rotation'
import { useAppStore } from '@/stores/app'

const open = defineModel<boolean>({ required: true })
const props = defineProps<{ day: number; slotId: string }>()

const app = useAppStore()
const { smAndDown } = useDisplay()

const slot = computed(() => app.household.slots.find((s) => s.id === props.slotId))
const cell = computed(() => app.cell(props.day, props.slotId))
const current = computed(() => app.meal(cell.value?.mealId))
const special = computed(() => app.special(props.day, props.slotId))

const search = ref('')
// The core's options for this cell, good fits first; only worked out while the dialog is open.
const options = computed<MealOption[]>(() =>
  open.value ? app.mealOptions(props.day, props.slotId) : [],
)
const groups = computed(() => groupOptions(options.value, search.value))

// Each time the dialog opens, start with an empty search.
watch(open, (isOpen) => {
  if (isOpen) search.value = ''
})

function pick(mealId: string | null) {
  app.setCell(props.day, props.slotId, mealId)
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" :fullscreen="smAndDown" max-width="600" scrollable>
    <v-card>
      <v-toolbar color="primary" density="comfortable">
        <v-btn icon="mdi-close" aria-label="Close" @click="open = false" />
        <v-toolbar-title>
          {{ slot?.name ?? slotId }}
          <div class="text-body-2">{{ dayLabel(day) }}</div>
        </v-toolbar-title>
      </v-toolbar>

      <v-card-text class="pa-4">
        <div class="text-body-2 text-medium-emphasis">Planned now</div>
        <div class="text-h6 mb-2">{{ current?.name ?? 'Nothing yet' }}</div>

        <v-switch
          v-if="current"
          :model-value="cell?.locked ?? false"
          color="primary"
          inset
          hide-details
          label="Keep this when making a new plan"
          @update:model-value="app.setLocked(day, slotId, !!$event)"
        />
        <v-switch
          v-if="special"
          :model-value="cell?.specialActive ?? false"
          color="primary"
          inset
          :label="special.label"
          :hint="`On means the planned meal is skipped. ${special.question}`"
          persistent-hint
          @update:model-value="app.setSpecialActive(day, slotId, !!$event)"
        />

        <v-text-field
          v-model="search"
          class="mt-4"
          prepend-inner-icon="mdi-magnify"
          label="Search meals"
          clearable
          hide-details
          @click:clear="search = ''"
        />

        <v-list lines="two" class="mt-2">
          <template v-if="groups.fits.length">
            <v-list-subheader>Good fits</v-list-subheader>
            <v-list-item
              v-for="o in groups.fits"
              :key="o.mealId"
              :active="o.mealId === current?.id"
              color="primary"
              prepend-icon="mdi-check-circle-outline"
              @click="pick(o.mealId)"
            >
              <template #title
                ><span class="text-h6">{{ o.name }}</span></template
              >
            </v-list-item>
          </template>

          <template v-if="groups.warned.length">
            <v-list-subheader>Possible, but check</v-list-subheader>
            <v-list-item
              v-for="o in groups.warned"
              :key="o.mealId"
              :active="o.mealId === current?.id"
              color="primary"
              prepend-icon="mdi-alert-outline"
              @click="pick(o.mealId)"
            >
              <template #title
                ><span class="text-h6">{{ o.name }}</span></template
              >
              <div v-for="w in o.warnings" :key="w" class="text-body-2 text-warning">{{ w }}</div>
            </v-list-item>
          </template>

          <v-list-item
            v-if="!groups.fits.length && !groups.warned.length"
            class="text-medium-emphasis"
            :title="search ? 'No meals match your search' : 'No meals for this slot yet'"
          />
        </v-list>
      </v-card-text>

      <v-divider />
      <v-card-actions class="flex-wrap ga-2 pa-3">
        <v-btn prepend-icon="mdi-plus" variant="text" :to="{ name: 'meals' }" @click="open = false">
          Add a new meal
        </v-btn>
        <v-spacer />
        <v-btn
          v-if="current"
          prepend-icon="mdi-eraser"
          variant="tonal"
          color="error"
          @click="pick(null)"
        >
          Clear
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
