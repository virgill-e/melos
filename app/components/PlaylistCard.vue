<script setup lang="ts">
const props = defineProps<{ playlist: PlaylistSummary, selected: boolean }>()
defineEmits<{ select: [] }>()

const subtitle = computed(() => {
  const { trackCount, ownerName, usable } = props.playlist
  if (!usable) return `Par ${ownerName}`
  return trackCount === null ? ownerName : `${trackCount} titre${trackCount > 1 ? 's' : ''}`
})
</script>

<template>
  <div>
    <button
      type="button"
      class="block w-full text-left"
      :class="playlist.usable ? 'cursor-pointer' : 'cursor-not-allowed'"
      :aria-pressed="selected"
      :aria-disabled="!playlist.usable"
      @click="playlist.usable && $emit('select')"
    >
      <!-- Règles Spotify : pochette intacte (pas de recadrage, de voile ni de texte par-dessus), coins de 8 px. -->
      <div
        class="relative aspect-square overflow-hidden rounded-[8px] bg-surface-raised shadow-[0_8px_24px_rgb(0_0_0/0.35)] transition duration-300 ease-apple"
        :class="selected ? 'ring-2 ring-white ring-offset-4 ring-offset-black' : ''"
      >
        <img
          v-if="playlist.imageUrl"
          :src="playlist.imageUrl"
          :alt="`Pochette de ${playlist.name}`"
          loading="lazy"
          class="size-full object-cover"
        >
        <VinylDisc v-else class="m-[15%] w-[70%] opacity-60" />
      </div>
      <p class="mt-3 truncate text-[15px] font-medium tracking-tight" :class="playlist.usable ? '' : 'text-white/45'">{{ playlist.name }}</p>
      <p class="truncate text-[13px] text-white/45">{{ subtitle }}</p>
    </button>
    <a
      :href="playlist.spotifyUrl"
      target="_blank"
      rel="noopener"
      class="mt-1 inline-block text-[12px] font-medium text-white/40 transition hover:text-white"
    >
      Ouvrir dans Spotify
    </a>
  </div>
</template>
