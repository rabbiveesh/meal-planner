<script setup lang="ts">
// Shared shell for the Setup edit dialogs: a form with Save / Cancel and an optional
// confirmed Remove. Full screen on phones, a normal dialog on bigger screens.
import { useId, useTemplateRef } from 'vue'
import { useDisplay } from 'vuetify'

import ConfirmButton from '@/components/ConfirmButton.vue'

const props = defineProps<{
  open: boolean
  title: string
  /** Show a Remove button that asks `removeTitle` first. */
  removeTitle?: string
  removeMessage?: string
}>()
const emit = defineEmits<{ close: []; save: []; remove: [] }>()

const { smAndDown } = useDisplay()
const form = useTemplateRef('form')
const titleId = useId()

async function save() {
  const result = await form.value?.validate()
  if (result && !result.valid) return
  emit('save')
}

function onOpen(v: boolean) {
  if (!v && props.open) emit('close')
}
</script>

<template>
  <v-dialog
    :model-value="open"
    :aria-labelledby="titleId"
    :fullscreen="smAndDown"
    max-width="600"
    @update:model-value="onOpen"
  >
    <v-card>
      <v-toolbar color="primary">
        <v-btn icon="mdi-close" aria-label="Cancel" @click="emit('close')" />
        <v-toolbar-title :id="titleId">{{ title }}</v-toolbar-title>
        <v-toolbar-items>
          <v-btn variant="text" data-test="save" @click="save">Save</v-btn>
        </v-toolbar-items>
      </v-toolbar>
      <v-card-text>
        <v-form ref="form" @submit.prevent="save">
          <slot />
        </v-form>
        <div v-if="removeTitle" class="d-flex mt-4">
          <v-spacer />
          <ConfirmButton
            :title="removeTitle"
            :message="removeMessage"
            confirm-text="Remove"
            color="error"
            variant="text"
            prepend-icon="mdi-delete"
            data-test="remove"
            @confirm="emit('remove')"
          >
            Remove
          </ConfirmButton>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
