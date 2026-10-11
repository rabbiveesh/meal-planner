<script setup lang="ts">
// A button that asks "are you sure?" in a dialog before emitting `confirm`.
// Attributes (color, variant, icon, text, ...) pass through to the button.
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    title: string
    message?: string
    confirmText?: string
    confirmColor?: string
  }>(),
  { message: undefined, confirmText: 'Yes', confirmColor: 'error' },
)
const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <v-dialog max-width="420">
    <template #activator="{ props: activator }">
      <v-btn v-bind="{ ...$attrs, ...activator }"><slot /></v-btn>
    </template>
    <template #default="{ isActive }">
      <v-card :title="title" :text="message">
        <v-card-actions>
          <v-spacer />
          <v-btn @click="isActive.value = false">Cancel</v-btn>
          <v-btn
            :color="confirmColor"
            variant="flat"
            data-test="confirm"
            @click="((isActive.value = false), emit('confirm'))"
          >
            {{ confirmText }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </v-dialog>
</template>
