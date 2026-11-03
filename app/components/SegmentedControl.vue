<script setup lang="ts">
defineProps<{ label: string, options: readonly number[], suffix?: string }>()
const model = defineModel<number>({ required: true })
</script>

<template>
  <div class="flex items-center gap-3" role="radiogroup" :aria-label="label">
    <span class="text-sm text-white/45">{{ label }}</span>
    <div class="flex rounded-full bg-white/8 p-1">
      <button
        v-for="option in options"
        :key="option"
        type="button"
        role="radio"
        :aria-checked="model === option"
        class="rounded-full px-3 py-1.5 text-sm font-medium tabular-nums transition duration-300 ease-apple"
        :class="model === option ? 'bg-white text-black' : 'text-white/70 hover:text-white'"
        @click="model = option"
      >
        {{ option }}{{ suffix }}
      </button>
    </div>
  </div>
</template>
