<script setup lang="ts">
// Backup to a file, restore from one, or start over from the starter template.
import { ref, toRaw } from 'vue'

import type { AppData } from '@/data/schema'
import ConfirmButton from '@/components/ConfirmButton.vue'
import { downloadBackup, readBackup, starterData } from '@/lib/backup'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
const error = ref('')
const message = ref('')
/** A read backup waiting for her to confirm it should replace everything. */
const pending = ref<AppData | null>(null)
const file = ref<File | File[] | null>(null)

function download() {
  error.value = ''
  try {
    downloadBackup(structuredClone(toRaw(app.data)))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function onFile(value: File | File[] | null | undefined) {
  const chosen = Array.isArray(value) ? value[0] : value
  if (!chosen) return
  error.value = ''
  try {
    pending.value = await readBackup(chosen)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    file.value = null
  }
}

function restore() {
  if (!pending.value) return
  app.replaceAll(pending.value)
  pending.value = null
  message.value = 'Backup restored.'
}

function loadStarter() {
  error.value = ''
  app.replaceAll(starterData(app.data.rotationStart))
  message.value = 'Starter template loaded.'
}
</script>

<template>
  <v-card title="Backup" class="mb-4">
    <v-card-text>
      <v-alert type="info" variant="tonal" class="mb-4" density="comfortable">
        Everything is saved only on this phone for now. Download a backup now and then, and keep it
        somewhere safe (e.g. email it to yourself).
      </v-alert>
      <v-alert
        v-if="error"
        type="error"
        class="mb-4"
        closable
        :text="error"
        data-test="error"
        @click:close="error = ''"
      />

      <div class="d-flex flex-column ga-3">
        <v-btn
          prepend-icon="mdi-download"
          color="primary"
          variant="flat"
          data-test="download"
          @click="download"
        >
          Download backup
        </v-btn>

        <v-file-input
          v-model="file"
          label="Restore from backup"
          accept="application/json,.json"
          prepend-icon=""
          prepend-inner-icon="mdi-upload"
          hide-details
          data-test="restore"
          @update:model-value="onFile"
        />

        <ConfirmButton
          title="Load the starter template?"
          message="This replaces all your meals, settings and plan with the example household. Download a backup first if you want to keep them."
          confirm-text="Replace everything"
          prepend-icon="mdi-file-restore"
          variant="tonal"
          data-test="starter"
          @confirm="loadStarter"
        >
          Load starter template
        </ConfirmButton>
      </div>
    </v-card-text>

    <v-dialog :model-value="!!pending" max-width="420" @update:model-value="pending = null">
      <v-card title="Restore this backup?">
        <v-card-text>
          It has {{ pending?.household?.meals?.length ?? 0 }} meals and
          {{ pending?.household?.eaters?.length ?? 0 }} people. It replaces everything on this
          phone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="pending = null">Cancel</v-btn>
          <v-btn color="error" variant="flat" data-test="confirm-restore" @click="restore">
            Restore
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar :model-value="!!message" :timeout="2500" @update:model-value="message = ''">
      {{ message }}
    </v-snackbar>
  </v-card>
</template>
