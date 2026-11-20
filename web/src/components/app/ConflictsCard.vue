<script setup lang="ts">
// Things changed on two phones at once: she picks which version is right.
import type { EditConflict } from '@/core'
import {
  conflictEntry,
  entryTitle,
  keepAsShown,
  keepOrDelete,
  optionLabel,
  pick,
} from '@/lib/conflicts'
import { useAppStore } from '@/stores/app'

const app = useAppStore()

const title = (c: EditConflict) => entryTitle(conflictEntry(c), app.household)
</script>

<template>
  <v-card
    v-if="app.conflicts.length"
    variant="tonal"
    color="warning"
    class="mb-4"
    title="Changed on two phones at once"
    data-test="conflicts"
  >
    <v-card-text>
      <div v-for="c in app.conflicts" :key="c.recordId" class="mb-4">
        <template v-if="c.kind === 'changed'">
          <p class="mb-2">
            <strong>{{ title(c) }}</strong> was changed on two phones. Which one is right?
          </p>
          <v-btn
            v-for="option in c.options"
            :key="option.id"
            block
            variant="outlined"
            class="mb-2 text-none"
            @click="app.settle([pick(c, option)])"
          >
            {{ optionLabel(option, app.household) }}
          </v-btn>
        </template>
        <template v-else>
          <p class="mb-2">
            <strong>{{ title(c) }}</strong> was deleted on one phone while it was being changed on
            another.
          </p>
          <v-btn block variant="outlined" class="mb-2" @click="app.settle([keepOrDelete(c, true)])">
            Keep it
          </v-btn>
          <v-btn block variant="outlined" @click="app.settle([keepOrDelete(c, false)])">
            Delete it
          </v-btn>
        </template>
      </div>
      <v-btn
        v-if="app.conflicts.length > 1"
        block
        color="warning"
        variant="flat"
        @click="app.settle(keepAsShown(app.conflicts))"
      >
        Keep what's showing for all of them
      </v-btn>
    </v-card-text>
  </v-card>
</template>
