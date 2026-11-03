<script setup lang="ts">
defineProps<{ label?: string }>()

const GROOVE_START = 19
const GROOVE_END = 48.5
const GROOVE_STEP = 0.55
const grooves = Array.from(
  { length: Math.floor((GROOVE_END - GROOVE_START) / GROOVE_STEP) },
  (_, i) => +(GROOVE_START + i * GROOVE_STEP).toFixed(2),
)
</script>

<template>
  <div class="relative aspect-square">
    <svg viewBox="0 0 100 100" class="block size-full" aria-hidden="true">
      <defs>
        <radialGradient id="vinyl-body" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#151516" />
          <stop offset="1" stop-color="#0a0a0a" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#vinyl-body)" />
      <g fill="none" stroke="#fff" stroke-opacity=".07" stroke-width=".12">
        <circle v-for="r in grooves" :key="r" cx="50" cy="50" :r="r" />
      </g>
      <circle cx="50" cy="50" r="17" fill="#ece9e4" />
      <text x="50" y="44" text-anchor="middle" font-weight="600" font-size="3.2" fill="#111" letter-spacing=".4">MELOS</text>
      <text v-if="label" x="50" y="59" text-anchor="middle" font-weight="500" font-size="2.2" fill="#111" fill-opacity=".5">{{ label }}</text>
      <circle cx="50" cy="50" r="1.3" fill="#0c0c0d" />
    </svg>
    <div class="vinyl-sheen pointer-events-none absolute inset-0 rounded-full" />
  </div>
</template>

<style scoped>
.vinyl-sheen {
  background: conic-gradient(from 30deg, transparent, rgb(255 255 255 / 0.05) 12%, transparent 25%, transparent 50%, rgb(255 255 255 / 0.04) 62%, transparent 75%);
  mask: radial-gradient(circle, transparent 34%, #000 35%);
}
</style>
