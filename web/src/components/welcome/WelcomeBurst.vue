<script setup lang="ts">
// A burst of stars and a greeting that floats across the screen once, when the app opens.
// It never blocks a tap, and with reduced motion the stars are skipped and the greeting fades.
import confetti from 'canvas-confetti'
import { onMounted, ref } from 'vue'

import { welcomeMessage } from '@/lib/welcome'

const props = defineProps<{ name: string }>()

const message = welcomeMessage(props.name)
const showing = ref(true)

const stars: confetti.Options = {
  shapes: ['star'],
  colors: ['#ffd54f', '#ff8a65', '#f06292', '#81c784', '#64b5f6'],
  particleCount: 60,
  spread: 70,
  startVelocity: 45,
  scalar: 1.2,
  disableForReducedMotion: true,
}

onMounted(() => {
  void confetti({ ...stars, angle: 60, origin: { x: 0, y: 0.7 } })
  void confetti({ ...stars, angle: 120, origin: { x: 1, y: 0.7 } })
})
</script>

<template>
  <div v-if="showing" class="welcome no-print" role="status" @animationend="showing = false">
    <span class="welcome-text text-h5 font-weight-bold">
      <v-icon icon="mdi-star-four-points" class="mr-2" />{{ message }}
    </span>
  </div>
</template>

<style scoped>
.welcome {
  position: fixed;
  inset: 40% 0 auto 0;
  z-index: 2000;
  display: flex;
  justify-content: center;
  pointer-events: none;
  animation: float-across 3.2s ease-in-out forwards;
}

.welcome-text {
  padding: 12px 24px;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(135deg, #f57c00, #e91e63);
  box-shadow: 0 6px 20px rgb(0 0 0 / 25%);
  max-width: calc(100vw - 32px);
  text-align: center;
}

@keyframes float-across {
  0% {
    transform: translateX(-110vw) rotate(-6deg);
  }
  25%,
  75% {
    transform: translateX(0) rotate(0);
  }
  100% {
    transform: translateX(110vw) rotate(6deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .welcome {
    animation: fade 3.2s ease-in-out forwards;
  }
}

@keyframes fade {
  0%,
  100% {
    opacity: 0;
  }
  15%,
  85% {
    opacity: 1;
  }
}
</style>
