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
  <div class="group relative">
    <button
      type="button"
      class="block w-full text-left transition duration-300 ease-apple"
      :class="playlist.usable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'"
      :aria-pressed="selected"
      :aria-disabled="!playlist.usable"
      @click="playlist.usable && $emit('select')"
    >
      <div
        class="relative aspect-square overflow-hidden rounded-md bg-surface-raised shadow-[0_8px_24px_rgb(0_0_0/0.35)] transition duration-500 ease-apple"
        :class="[
          selected ? 'ring-2 ring-white ring-offset-4 ring-offset-black' : '',
          playlist.usable ? 'group-hover:-translate-y-1' : '',
        ]"
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
      <p class="mt-3 truncate text-[15px] font-medium tracking-tight">{{ playlist.name }}</p>
      <p class="truncate text-[13px] text-white/45">{{ subtitle }}</p>
    </button>
    <a
      :href="playlist.spotifyUrl"
      target="_blank"
      rel="noopener"
      class="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white/80 opacity-0 backdrop-blur transition group-hover:opacity-100 focus-visible:opacity-100"
    >
      Ouvrir dans Spotify
    </a>
  </div>
</template>
