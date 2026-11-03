<script setup lang="ts">
const props = defineProps<{ game: PublicGame }>()

const ratio = computed(() => props.game.maxScore ? props.game.score / props.game.maxScore : 0)
const verdict = computed(() => {
  if (ratio.value >= 0.8) return 'Oreille absolue.'
  if (ratio.value >= 0.5) return 'Belle partie.'
  if (ratio.value >= 0.25) return 'Ça chauffe.'
  return 'La prochaine sera la bonne.'
})
</script>

<template>
  <div class="flex flex-1 flex-col">
    <AppHeader />
    <main class="flex-1 px-8 pb-24 md:px-16">
      <p class="text-white/50">{{ game.playlistName }} · {{ game.roundCount }} manches</p>
      <h1 class="mt-3 text-7xl font-bold tracking-[-0.05em] tabular-nums md:text-8xl">
        {{ game.score }}<span class="text-white/30"> / {{ game.maxScore }}</span>
      </h1>
      <p class="mt-3 text-2xl font-semibold tracking-tight">{{ verdict }}</p>

      <div class="mt-10 flex gap-3">
        <NuxtLink to="/playlists" class="rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-black transition hover:bg-white/85">
          Nouvelle partie
        </NuxtLink>
      </div>

      <ol class="mt-16 grid gap-x-10 border-t border-white/10 md:grid-cols-2">
        <li
          v-for="(round, index) in game.history"
          :key="index"
          class="flex items-center gap-4 border-b border-white/10 py-4"
        >
          <span class="w-6 text-sm tabular-nums text-white/30">{{ index + 1 }}</span>
          <img v-if="round.answer.imageUrl" :src="round.answer.imageUrl" alt="" class="size-12 rounded object-cover">
          <div class="min-w-0 flex-1">
            <a :href="round.answer.spotifyUrl" target="_blank" rel="noopener" class="block truncate font-medium hover:underline">{{ round.answer.title }}</a>
            <p class="truncate text-sm text-white/45">{{ round.answer.artists.join(', ') }}</p>
          </div>
          <div class="flex gap-1.5 text-xs font-medium">
            <span class="rounded-full px-2.5 py-1" :class="round.found.artist ? 'bg-white text-black' : 'bg-white/8 text-white/35'">Artiste</span>
            <span class="rounded-full px-2.5 py-1" :class="round.found.title ? 'bg-white text-black' : 'bg-white/8 text-white/35'">Titre</span>
          </div>
        </li>
      </ol>
    </main>
    <AppFooter />
  </div>
</template>
