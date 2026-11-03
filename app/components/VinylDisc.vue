<script setup lang="ts">
const props = defineProps<{ label?: string, spinning?: boolean }>()

const GROOVE_START = 19
const GROOVE_END = 48.5
const GROOVE_STEP = 0.55
const grooves = Array.from(
  { length: Math.floor((GROOVE_END - GROOVE_START) / GROOVE_STEP) },
  (_, i) => +(GROOVE_START + i * GROOVE_STEP).toFixed(2),
)

// 33 tours/min. Le disque accélère et freine progressivement, comme un vrai plateau.
const REVOLUTION_MS = 1818
const SPIN_UP_MS = 1600
const SPIN_DOWN_MS = 800

const gradientId = useId()
const disc = ref<SVGSVGElement>()
let spin: Animation | null = null
let rampFrame = 0

function rampTo(target: number, durationMs: number) {
  if (!spin) return
  cancelAnimationFrame(rampFrame)
  const from = spin.playbackRate
  const start = performance.now()
  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / durationMs)
    const eased = 1 - (1 - progress) ** 3
    spin!.playbackRate = from + (target - from) * eased
    if (progress < 1) rampFrame = requestAnimationFrame(step)
  }
  rampFrame = requestAnimationFrame(step)
}

onMounted(() => {
  spin = disc.value!.animate(
    [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
    { duration: REVOLUTION_MS, iterations: Infinity },
  )
  spin.playbackRate = 0
  if (props.spinning) rampTo(1, SPIN_UP_MS)
})

watch(() => props.spinning, spinning => rampTo(spinning ? 1 : 0, spinning ? SPIN_UP_MS : SPIN_DOWN_MS))

onBeforeUnmount(() => {
  cancelAnimationFrame(rampFrame)
  spin?.cancel()
})
</script>

<template>
  <div class="relative aspect-square">
    <svg ref="disc" viewBox="0 0 100 100" class="block size-full" aria-hidden="true">
      <defs>
        <radialGradient :id="gradientId" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#151516" />
          <stop offset="1" stop-color="#0a0a0a" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" :fill="`url(#${gradientId})`" />
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
