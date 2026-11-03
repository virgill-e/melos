<script setup lang="ts">
defineProps<{ player: Pick<PublicPlayer, 'name' | 'color'> }>()
</script>

<template>
  <span
    class="inline-grid aspect-square shrink-0 place-items-center rounded-full font-semibold text-black"
    :style="{ backgroundColor: player.color }"
    aria-hidden="true"
  >
    {{ player.name.slice(0, 2).toUpperCase() }}
  </span>
</template>
