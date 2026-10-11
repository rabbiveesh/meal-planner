<script setup lang="ts">
// Who eats: name, adult/child, wait after meat, soft food.
import { ref, toRaw } from 'vue'

import type { Eater } from '@/core'
import ChoiceChips from '@/components/ChoiceChips.vue'
import EditDialog from './EditDialog.vue'
import { EATER_KIND_LABELS, eaterKindLabel } from '@/lib/labels'
import { cleanEater, newEater, upsert } from '@/lib/household'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const draft = ref<Eater | null>(null)
const isNew = ref(false)
// The chips keep the group's colour, so only value, title and icon are shown.
const kindChoices = EATER_KIND_LABELS.map(({ value, title, icon }) => ({ value, title, icon }))

function add() {
  draft.value = newEater()
  isNew.value = true
}

function edit(e: Eater) {
  draft.value = structuredClone(toRaw(e))
  isNew.value = false
}

function save() {
  if (!draft.value) return
  const h = toRaw(app.household)
  app.setHousehold({ ...h, eaters: upsert(h.eaters, cleanEater(draft.value)) })
  draft.value = null
}

function remove() {
  if (!draft.value) return
  app.removeEater(draft.value.id)
  draft.value = null
}

function summary(e: Eater): string {
  const parts = [eaterKindLabel(e.kind).title]
  parts.push(e.waitHours ? `waits ${e.waitHours} h after meat` : 'no wait after meat')
  if (e.softFood) parts.push('soft food')
  return parts.join(' · ')
}

const required = (v: string) => !!v?.trim() || 'Enter a name'
</script>

<template>
  <v-card title="Who eats" class="mb-4">
    <v-list class="py-0">
      <v-list-item
        v-for="e in app.household.eaters"
        :key="e.id"
        :title="e.name"
        :subtitle="summary(e)"
        :prepend-icon="eaterKindLabel(e.kind).icon"
        append-icon="mdi-pencil"
        data-test="eater"
        @click="edit(e)"
      />
    </v-list>
    <v-card-actions>
      <v-btn prepend-icon="mdi-plus" variant="tonal" data-test="add-eater" @click="add">
        Add person
      </v-btn>
    </v-card-actions>

    <EditDialog
      :open="!!draft"
      :title="isNew ? 'Add person' : 'Edit person'"
      :remove-title="isNew ? undefined : `Remove ${draft?.name}?`"
      @close="draft = null"
      @save="save"
      @remove="remove"
    >
      <template v-if="draft">
        <v-text-field v-model="draft.name" label="Name" :rules="[required]" data-test="name" />
        <ChoiceChips
          v-model="draft.kind"
          :items="kindChoices"
          label="Adult or child"
          size="large"
          variant="outlined"
          mandatory
          class="mb-2"
        />
        <v-number-input
          :model-value="draft.waitHours ?? 0"
          label="Hours waited after meat before dairy"
          :min="0"
          :max="24"
          :step="0.5"
          :precision="null"
          @update:model-value="draft.waitHours = $event ?? 0"
        />
        <v-switch
          v-model="draft.softFood"
          label="Needs a soft-food option"
          color="primary"
          inset
          hide-details
        />
        <v-textarea v-model="draft.notes" label="Notes" rows="2" auto-grow class="mt-2" />
      </template>
    </EditDialog>
  </v-card>
</template>
