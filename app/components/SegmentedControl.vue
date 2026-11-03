<script setup lang="ts" generic="T extends string | number">
defineProps<{ label: string, options: readonly { value: T, label: string }[] }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="flex items-center gap-3" role="radiogroup" :aria-label="label">
    <span class="text-sm text-white/45">{{ label }}</span>
    <div class="flex rounded-full bg-white/8 p-1">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="model === option.value"
        class="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium tabular-nums transition duration-300 ease-apple"
        :class="model === option.value ? 'bg-white text-black' : 'text-white/70 hover:text-white'"
        @click="model = option.value"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
