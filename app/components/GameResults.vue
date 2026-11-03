<script setup lang="ts">
const props = defineProps<{ game: PublicGame }>()

const isSolo = computed(() => props.game.settings.mode === 'solo')
const maxScore = computed(() => props.game.roundCount * POINTS_PER_ROUND)
const ranking = computed(() => props.game.players
  .filter(player => player.role === 'player')
  .sort((a, b) => b.score - a.score))
const soloScore = computed(() => ranking.value[0]?.score ?? 0)

const headline = computed(() => {
  if (isSolo.value) {
    const ratio = maxScore.value ? soloScore.value / maxScore.value : 0
    if (ratio >= 0.8) return 'Oreille absolue.'
    if (ratio >= 0.5) return 'Belle partie.'
    if (ratio >= 0.25) return 'Ça chauffe.'
    return 'La prochaine sera la bonne.'
  }
  const [first, second] = ranking.value
  if (!first) return 'Partie terminée.'
  if (second && second.score === first.score) return 'Égalité en tête.'
  return `${first.name} l'emporte.`
})

const nameOf = (id: string | null) => props.game.players.find(player => player.id === id)?.name
</script>

<template>
  <div class="flex flex-1 flex-col">
    <AppHeader />
    <main class="flex-1 px-8 pb-24 md:px-16">
      <p class="text-white/50">{{ game.playlistName }} · {{ game.roundCount }} manches</p>

      <template v-if="isSolo">
        <h1 class="mt-3 text-7xl font-bold tracking-[-0.05em] tabular-nums md:text-8xl">
          {{ soloScore }}<span class="text-white/30"> / {{ maxScore }}</span>
        </h1>
        <p class="mt-3 text-2xl font-semibold tracking-tight">{{ headline }}</p>
      </template>

      <template v-else>
        <h1 class="mt-3 text-6xl font-bold tracking-[-0.045em] md:text-7xl">{{ headline }}</h1>
        <ol class="mt-10 max-w-xl">
          <li v-for="(player, index) in ranking" :key="player.id" class="flex items-center gap-4 border-b border-white/10 py-3 text-lg">
            <span class="w-6 tabular-nums text-white/35">{{ index + 1 }}</span>
            <PlayerAvatar :player="player" class="w-9 text-xs" />
            <span class="flex-1 font-medium">{{ player.name }}</span>
            <span class="font-semibold tabular-nums">{{ player.score }}</span>
          </li>
        </ol>
      </template>

      <div class="mt-10 flex gap-3">
        <NuxtLink to="/playlists" class="rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-black transition hover:bg-white/85">
          Nouvelle partie
        </NuxtLink>
      </div>

      <h2 class="mt-16 text-xl font-semibold tracking-tight">Les morceaux</h2>
      <ol class="mt-4 grid gap-x-10 border-t border-white/10 md:grid-cols-2">
        <li v-for="(round, index) in game.history" :key="index" class="flex items-center gap-4 border-b border-white/10 py-4">
          <span class="w-6 text-sm tabular-nums text-white/30">{{ index + 1 }}</span>
          <img v-if="round.answer.imageUrl" :src="round.answer.imageUrl" alt="" class="size-12 rounded object-cover">
          <div class="min-w-0 flex-1">
            <a :href="round.answer.spotifyUrl" target="_blank" rel="noopener" class="block truncate font-medium hover:underline">{{ round.answer.title }}</a>
            <p class="truncate text-sm text-white/45">{{ round.answer.artists.join(', ') }}</p>
          </div>
          <div class="flex gap-1.5 text-xs font-medium">
            <span v-for="part in (['artist', 'title'] as const)" :key="part" class="rounded-full px-2.5 py-1" :class="round.found[part] ? 'bg-white text-black' : 'bg-white/8 text-white/35'">
              {{ part === 'artist' ? 'Artiste' : 'Titre' }}<template v-if="!isSolo && nameOf(round.foundBy[part])"> · {{ nameOf(round.foundBy[part]) }}</template>
            </span>
          </div>
        </li>
      </ol>
    </main>
    <AppFooter />
  </div>
</template>
