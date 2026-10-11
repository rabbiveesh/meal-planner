<script setup lang="ts">
// Full-screen add/edit form for one meal. Works on a copy; nothing changes until Save.
import { computed, ref, toRaw, useTemplateRef, watch } from 'vue'

import type { Meal } from '@/core'
import ConfirmButton from '@/components/ConfirmButton.vue'
import WeekdayChips from '@/components/WeekdayChips.vue'
import IngredientRows from './IngredientRows.vue'
import TextListField from './TextListField.vue'
import { KASHRUT_LABELS, PREP_LABELS } from '@/lib/labels'
import {
  cleanMeal,
  knownIngredientValues,
  mealProblems,
  newMeal,
  type MealDraft,
} from '@/lib/meals'
import { useAppStore } from '@/stores/app'

const props = defineProps<{
  /** The meal to edit; null closes the editor. */
  meal: Meal | null
  /** A meal not saved yet (no Delete button). */
  isNew: boolean
}>()
const emit = defineEmits<{ close: []; save: [meal: Meal]; delete: [id: string] }>()

const app = useAppStore()
const draft = ref<MealDraft | null>(null)
const form = useTemplateRef('form')

watch(
  () => props.meal,
  (m) => {
    draft.value = m ? newMeal(structuredClone(toRaw(m))) : null
  },
  { immediate: true },
)

const open = computed({
  get: () => draft.value != null,
  set: (v) => {
    if (!v) emit('close')
  },
})

const slots = computed(() => app.household.slots)
/** The soft version only matters if someone needs soft food (or one was already entered). */
const showSoft = computed(
  () => app.household.eaters.some((e) => e.softFood) || !!draft.value?.softVersion,
)
const suggestions = computed(() => ({
  items: knownIngredientValues(app.household.meals, 'item'),
  units: knownIngredientValues(app.household.meals, 'unit'),
  categories: knownIngredientValues(app.household.meals, 'category'),
}))

const nameRule = () => (draft.value && mealProblems(draft.value).name) || true
const slotsRule = () => (draft.value && mealProblems(draft.value).slots) || true

async function save() {
  if (!draft.value) return
  const result = await form.value?.validate()
  if (result && !result.valid) return
  if (Object.keys(mealProblems(draft.value)).length) return
  emit('save', cleanMeal(draft.value))
}
</script>

<template>
  <v-dialog v-model="open" fullscreen transition="dialog-bottom-transition">
    <v-card v-if="draft">
      <v-toolbar color="primary">
        <v-btn icon="mdi-close" aria-label="Cancel" @click="emit('close')" />
        <v-toolbar-title>{{ isNew ? 'New meal' : 'Edit meal' }}</v-toolbar-title>
        <v-toolbar-items>
          <v-btn variant="text" data-test="save" @click="save">Save</v-btn>
        </v-toolbar-items>
      </v-toolbar>

      <v-card-text class="mx-auto w-100" style="max-width: 720px">
        <v-form ref="form" @submit.prevent="save">
          <v-text-field
            v-model="draft.name"
            label="Meal name"
            :rules="[nameRule]"
            autofocus
            data-test="name"
          />

          <v-input :model-value="draft.slots" :rules="[slotsRule]" class="mb-2">
            <div class="w-100">
              <div class="text-subtitle-1">Meal slots it can fill</div>
              <v-chip-group v-model="draft.slots" multiple column selected-class="text-primary">
                <v-chip
                  v-for="s in slots"
                  :key="s.id"
                  :value="s.id"
                  filter
                  variant="outlined"
                  size="large"
                >
                  {{ s.name }}
                </v-chip>
              </v-chip-group>
            </div>
          </v-input>

          <div class="text-subtitle-1">Meat, dairy or parve</div>
          <v-chip-group v-model="draft.kashrut" mandatory column class="mb-2">
            <v-chip
              v-for="k in KASHRUT_LABELS"
              :key="k.value"
              :value="k.value"
              :color="k.color"
              :prepend-icon="k.icon"
              filter
              variant="outlined"
              size="large"
            >
              {{ k.title }}
            </v-chip>
          </v-chip-group>

          <div class="text-subtitle-1">How it's made</div>
          <v-chip-group v-model="draft.prep" mandatory column class="mb-2">
            <v-chip
              v-for="p in PREP_LABELS"
              :key="p.value"
              :value="p.value"
              :color="p.color"
              :prepend-icon="p.icon"
              filter
              variant="outlined"
              size="large"
            >
              {{ p.title }}
            </v-chip>
          </v-chip-group>

          <WeekdayChips
            v-model="draft.days"
            label="Days it fits"
            hint="None picked means any day."
          />

          <v-text-field
            v-model="draft.kidsVersion"
            label="Kids' version"
            placeholder="e.g. with chips and pitas"
            class="mt-2"
          />
          <v-text-field
            v-model="draft.adultsVersion"
            label="Adults' version"
            placeholder="e.g. with rice and salad"
          />
          <v-text-field
            v-if="showSoft"
            v-model="draft.softVersion"
            label="Soft version"
            placeholder="e.g. mashed, no skin"
          />

          <IngredientRows
            v-model="draft.ingredients"
            :items="suggestions.items"
            :units="suggestions.units"
            :categories="suggestions.categories"
          />

          <TextListField
            v-model="draft.prepTasks"
            label="Night-before prep"
            add-text="Add prep task"
            placeholder="e.g. Take the chicken out of the freezer"
          />

          <v-switch
            v-model="draft.rescue"
            label="Rescue meal (ready fast when the plan falls apart)"
            color="primary"
            inset
            hide-details
            data-test="rescue"
          />
          <TextListField
            v-if="draft.rescue"
            v-model="draft.rescueQuestions"
            label="Questions before suggesting it (all must be yes)"
            add-text="Add question"
            placeholder="e.g. Do you have hot dogs in the fridge?"
          />

          <v-switch
            v-model="draft.fun"
            label="Fun meal (an occasional treat)"
            color="primary"
            inset
            hide-details
          />

          <div class="text-subtitle-1 mt-2">Cook double: leftovers go to</div>
          <v-chip-group v-model="draft.leftoversFor" multiple column selected-class="text-primary">
            <v-chip
              v-for="s in slots"
              :key="s.id"
              :value="s.id"
              filter
              variant="outlined"
              size="large"
            >
              {{ s.name }}
            </v-chip>
          </v-chip-group>
          <div class="text-caption text-medium-emphasis mb-4">
            The next day, these meals are filled with this meal's leftovers.
          </div>

          <v-textarea v-model="draft.notes" label="Notes" rows="2" auto-grow />

          <div class="d-flex flex-wrap ga-2 mt-2">
            <v-btn color="primary" variant="flat" prepend-icon="mdi-content-save" @click="save">
              Save meal
            </v-btn>
            <v-spacer />
            <ConfirmButton
              v-if="!isNew"
              :title="`Delete ${draft.name || 'this meal'}?`"
              message="It will also be taken out of the plan."
              confirm-text="Delete"
              color="error"
              variant="text"
              prepend-icon="mdi-delete"
              data-test="delete"
              @confirm="emit('delete', draft.id)"
            >
              Delete meal
            </ConfirmButton>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
