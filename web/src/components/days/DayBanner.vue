<script setup lang="ts">
// The orange banner naming a day. It sticks under the app bar while its day is on screen, so
// she always knows which day she is looking at when she scrolls down. Inside a card it stays
// with that card, and the next day's banner takes its place when the next card comes up.
withDefaults(defineProps<{ tag?: string }>(), { tag: 'div' })
</script>

<template>
  <component :is="tag" class="day-banner bg-day">
    <slot />
  </component>
</template>

<style scoped>
.day-banner {
  position: sticky;
  /* Vuetify's layout sets this to the app bar's height. */
  top: var(--v-layout-top, 0px);
  z-index: 1;
}
</style>
