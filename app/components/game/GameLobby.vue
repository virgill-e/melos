<script setup lang="ts">
import { renderSVG } from 'uqr'

const props = defineProps<{ game: PublicGame, starting: boolean }>()
defineEmits<{ start: [] }>()

const { data: network } = await useFetch('/api/network')

// Les téléphones joignent la machine par son IP locale, sur le même port que l'écran principal.
const joinBase = computed(() => {
  const address = network.value?.addresses[0]
  if (!address || !import.meta.client) return null
  return `http://${address}${location.port ? `:${location.port}` : ''}`
})
const joinUrl = computed(() => joinBase.value && `${joinBase.value}/join/${props.game.code}`)
const qrSvg = computed(() => joinUrl.value && renderSVG(joinUrl.value, { border: 0, whiteColor: '#ffffff', blackColor: '#000000' }))

const players = computed(() => props.game.players.filter(player => player.role === 'player'))
const master = computed(() => props.game.players.find(player => player.role === 'master'))
const modeLabel = computed(() => MODE_OPTIONS.find(option => option.value === props.game.settings.mode)?.label)
const missing = computed(() => {
  if (!players.value.length) return 'En attente des joueurs'
  if (props.game.settings.mode === 'master' && !master.value) return 'En attente du maître du jeu'
  return null
})
</script>

<template>
  <div class="@container relative grid h-dvh grid-cols-[52%_48%] bg-surface">
    <header class="absolute inset-x-0 top-0 flex items-center justify-between px-[4cqw] py-[2.4cqw] text-[max(13px,1.05cqw)]">
      <span class="font-semibold tracking-tight">Melos <span class="ml-2 font-normal text-white/40">{{ game.playlistName }}</span></span>
      <NuxtLink to="/playlists" class="text-white/50 transition hover:text-white">Quitter</NuxtLink>
    </header>

    <section class="flex flex-col items-center justify-center gap-[2.4cqw]">
      <div v-if="qrSvg" class="w-[min(26cqw,52dvh)] rounded-[1.6cqw] bg-white p-[2cqw]" v-html="qrSvg" />
      <p v-else class="max-w-[30cqw] text-center text-[1.3cqw] text-white/50">
        Aucun réseau local détecté. Connecte cet ordinateur au même Wi-Fi que les téléphones.
      </p>
      <div class="text-center">
        <p class="text-[1.3cqw] text-white/50">Scanne pour rejoindre, ou va sur</p>
        <p v-if="joinBase" class="mt-[.4cqw] text-[1.5cqw] font-medium tabular-nums">{{ joinBase.replace('http://', '') }}/join</p>
        <p class="mt-[1.2cqw] text-[1.1cqw] text-white/40">Code</p>
        <p class="text-[4cqw] font-bold leading-none tracking-[0.2em]">{{ game.code }}</p>
      </div>
    </section>

    <section class="flex flex-col justify-center pr-[7cqw]">
      <p class="text-[1.15cqw] font-medium text-white/60">{{ modeLabel }} · {{ game.roundCount }} manches · extraits de {{ game.settings.extractSeconds }} s</p>
      <h1 class="mt-[1cqw] text-[4.4cqw] font-bold leading-none tracking-[-0.04em]">
        {{ players.length }} joueur{{ players.length > 1 ? 's' : '' }}
      </h1>

      <TransitionGroup
        tag="ul"
        class="mt-[2.4cqw] flex min-h-[12cqw] flex-wrap content-start gap-[1cqw]"
        enter-from-class="scale-75 opacity-0"
        enter-active-class="transition duration-500 ease-apple"
      >
        <li
          v-for="player in players"
          :key="player.id"
          class="flex items-center gap-[.8cqw] rounded-full bg-white/8 py-[.6cqw] pl-[.6cqw] pr-[1.4cqw] text-[1.4cqw] font-medium"
          :class="player.connected ? '' : 'opacity-40'"
        >
          <PlayerAvatar :player="player" class="w-[2.4cqw] text-[.9cqw]" />
          {{ player.name }}
        </li>
      </TransitionGroup>

      <p v-if="game.settings.mode === 'master'" class="mt-[1.6cqw] text-[1.3cqw] text-white/50">
        Maître du jeu : <span class="font-medium text-white">{{ master?.name ?? 'personne pour l\'instant' }}</span>
      </p>

      <div class="mt-[3cqw] flex items-center gap-[1.6cqw]">
        <button
          type="button"
          class="rounded-full bg-white px-[2.2cqw] py-[1cqw] text-[1.3cqw] font-semibold text-black transition hover:bg-white/85"
          :aria-busy="starting"
          @click="$emit('start')"
        >
          Commencer la partie
        </button>
        <span v-if="missing" class="text-[1.1cqw] text-white/40">{{ missing }}</span>
      </div>
    </section>
  </div>
</template>
