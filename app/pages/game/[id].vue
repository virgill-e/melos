<script setup lang="ts">
definePageMeta({ middleware: 'auth', immersive: true })

const route = useRoute()
const gameId = route.params.id as string
const { data: initialGame, error: loadError } = await useFetch<PublicGame>(`/api/games/${gameId}`)

const game = ref<PublicGame | null>(initialGame.value ?? null)
const actionError = ref<string | null>(null)
const busy = ref(false)

/** L'état arrive à la fois par les réponses HTTP et par le WebSocket : on garde le plus récent. */
function applyState(next: PublicGame) {
  if (!game.value || next.version >= game.value.version) game.value = next
}

const socket = useGameSocket({
  onOpen: () => socket.send({ type: 'host', gameId }),
  onMessage: (message) => {
    if (message.type === 'host-state') applyState(message.game)
    else if (message.type === 'error') actionError.value = message.message
  },
})

function errorMessage(error: unknown, fallback: string) {
  return (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
}

async function hostAction(path: string, body?: Record<string, unknown>) {
  const next = await $fetch<PublicGame>(`/api/games/${gameId}/${path}`, { method: 'POST', body })
  applyState(next)
  return next
}

const player = useSpotifyPlayer()
const phase = computed(() => game.value?.phase)
const isSolo = computed(() => game.value?.settings.mode === 'solo')
const isReveal = computed(() => phase.value === 'reveal')
const isLastRound = computed(() => !!game.value && game.value.roundIndex + 1 >= game.value.roundCount)
const roundLabel = computed(() => game.value ? `MANCHE ${String(game.value.roundIndex + 1).padStart(2, '0')}` : '')
const playerById = (id: string | null | undefined) => game.value?.players.find(p => p.id === id)
const buzzer = computed(() => playerById(game.value?.buzz?.playerId))
const soloScore = computed(() => game.value?.players[0]?.score ?? 0)

// On garde la dernière réponse affichée pendant le fondu de sortie, au lieu de la vider d'un coup.
const shownAnswer = ref<TrackAnswer | null>(game.value?.answer ?? null)
watch(() => game.value?.answer, (answer) => {
  if (answer) shownAnswer.value = answer
})

const extract = useCountdown(() => void reveal())
extract.reset(game.value?.settings.extractSeconds ?? 0)
const answerCountdown = useCountdown()
watch(() => game.value?.buzz, (buzz) => {
  if (buzz?.remainingMs != null) answerCountdown.start(buzz.remainingMs / 1000)
  else answerCountdown.pause()
})

// La musique suit l'état de la partie : coupée au buzz, relancée quand la main passe.
watch(phase, async (current, previous) => {
  if (previous === 'playing' && current === 'buzzed') {
    extract.pause()
    await player.fadeOutAndPause(200)
  }
  else if (previous === 'buzzed' && current === 'playing') {
    await player.resumeWithFade()
    extract.resume()
  }
  else if (current === 'reveal' && (previous === 'playing' || previous === 'buzzed')) {
    extract.pause()
    await player.fadeOutAndPause(400)
  }
})

async function startGame() {
  if (busy.value) return
  busy.value = true
  actionError.value = null
  try {
    await hostAction('start')
  }
  catch (error) {
    actionError.value = errorMessage(error, 'Impossible de commencer la partie.')
  }
  finally {
    busy.value = false
  }
}

const answerInput = ref<HTMLInputElement>()
const answerText = ref('')
const feedback = ref<{ hit: boolean, text: string, key: number } | null>(null)

async function startRound() {
  if (phase.value !== 'ready' || !player.deviceId.value || busy.value) return
  busy.value = true
  actionError.value = null
  feedback.value = null
  player.activate()
  try {
    await player.prepareFadeIn()
    const playbackStarted = player.waitForPlayback()
    const next = await hostAction('round', { deviceId: player.deviceId.value })
    await playbackStarted
    void player.fadeIn()
    extract.start(next.settings.extractSeconds)
    if (isSolo.value) {
      await nextTick()
      answerInput.value?.focus()
    }
  }
  catch (error) {
    actionError.value = errorMessage(error, 'Impossible de lancer l\'extrait.')
  }
  finally {
    busy.value = false
  }
}

async function reveal() {
  if (phase.value !== 'playing' && phase.value !== 'buzzed') return
  try {
    await hostAction('reveal')
  }
  catch {
    // Une bonne réponse a pu révéler la manche entre-temps : on se resynchronise.
    applyState(await $fetch<PublicGame>(`/api/games/${gameId}`))
  }
}

async function submitSoloAnswer() {
  const text = answerText.value.trim()
  if (!text || phase.value !== 'playing') return
  answerText.value = ''
  try {
    const result = await $fetch<AnswerResult>(`/api/games/${gameId}/answer`, { method: 'POST', body: { text } })
    applyState(result.game)
    feedback.value = { hit: result.gained > 0, text: result.gained > 0 ? `+${result.gained}` : 'Pas ça', key: Date.now() }
  }
  catch (error) {
    actionError.value = errorMessage(error, 'Réponse non envoyée.')
  }
}

async function next() {
  if (!isReveal.value || busy.value) return
  try {
    const state = await hostAction('next')
    extract.reset(state.settings.extractSeconds)
    if (state.phase === 'ready') await startRound()
  }
  catch (error) {
    actionError.value = errorMessage(error, 'Impossible de passer à la manche suivante.')
  }
}

// Ce qui vient de se passer au buzzer, affiché quelques secondes.
const eventText = computed(() => {
  const event = game.value?.lastEvent
  const who = playerById(event?.playerId)?.name
  if (!event || !who) return null
  if (event.kind === 'hit') return `${who} trouve (+${event.gained})`
  if (event.kind === 'partial') return `${who} marque ${event.gained} point, la main passe`
  if (event.kind === 'timeout') return `Temps écoulé pour ${who}, la main passe`
  return `Raté pour ${who}, la main passe`
})

function foundLabel(part: 'artist' | 'title') {
  const label = part === 'artist' ? 'Artiste' : 'Titre'
  const finder = playerById(game.value?.foundBy[part])
  return finder && !isSolo.value ? `${label} · ${finder.name}` : label
}

function onKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.code !== 'Space') return
  event.preventDefault()
  if (phase.value === 'ready') void startRound()
  else if (isReveal.value) void next()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="loadError || !game" class="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
    <p class="text-2xl font-semibold tracking-tight">Partie introuvable</p>
    <p class="text-white/50">{{ loadError?.statusMessage ?? 'Elle a peut-être expiré.' }}</p>
    <NuxtLink to="/playlists" class="mt-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">Nouvelle partie</NuxtLink>
  </div>

  <GameResults v-else-if="game.phase === 'finished'" :game="game" />

  <div v-else class="@container relative isolate h-dvh overflow-hidden bg-surface">
    <p
      v-if="player.error.value || actionError"
      role="alert"
      class="absolute left-1/2 top-[6cqw] z-20 max-w-[80cqw] -translate-x-1/2 rounded-2xl bg-accent/20 px-5 py-2 text-center text-sm text-[#ffb9a8] backdrop-blur"
    >
      {{ player.error.value ?? actionError }}
    </p>

    <GameLobby v-if="game.phase === 'lobby'" :game="game" :starting="busy" @start="startGame" />

    <template v-else>
      <div
        class="absolute -inset-[10%] -z-10 scale-110 bg-cover bg-center blur-[120px] saturate-150 brightness-[.55] transition-opacity duration-[1200ms] ease-apple"
        :class="isReveal ? 'opacity-100' : 'opacity-0'"
        :style="shownAnswer?.imageUrl ? { backgroundImage: `url(${shownAnswer.imageUrl})` } : undefined"
      />

      <header class="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-[4cqw] py-[2.4cqw] text-[max(13px,1.05cqw)]">
        <span class="font-semibold tracking-tight">Melos <span class="ml-2 font-normal text-white/40">{{ game.playlistName }}</span></span>
        <span class="flex items-center gap-[2.4cqw]">
          <span v-if="!isSolo" class="text-white/40">Code <b class="font-semibold tracking-[0.15em] text-white/70">{{ game.code }}</b></span>
          <NuxtLink to="/playlists" class="text-white/50 transition hover:text-white">Quitter la partie</NuxtLink>
        </span>
      </header>

      <div class="grid h-full grid-cols-[52%_48%]">
        <section class="relative">
          <VinylDisc
            :spinning="phase === 'playing'"
            :label="roundLabel"
            class="absolute left-[9cqw] top-1/2 w-[min(40cqw,72dvh)] -translate-y-1/2 transition-transform duration-1000 ease-apple"
            :class="isReveal ? '-translate-x-[11cqw] scale-[.92]' : ''"
          />
          <div
            class="absolute left-[9cqw] top-1/2 aspect-square w-[min(40cqw,72dvh)] -translate-y-1/2 overflow-hidden rounded-[.7cqw] shadow-[0_2.5cqw_6cqw_rgb(0_0_0/0.45)] transition duration-1000 ease-apple"
            :class="isReveal ? 'scale-100 opacity-100 delay-150' : 'pointer-events-none scale-[.94] opacity-0'"
          >
            <img v-if="shownAnswer?.imageUrl" :src="shownAnswer.imageUrl" :alt="`Pochette de ${shownAnswer.album}`" class="size-full object-cover">
          </div>
        </section>

        <section class="relative">
          <!-- Écoute -->
          <div
            class="absolute inset-y-[7cqw] left-[2cqw] right-[7cqw] flex flex-col transition duration-700 ease-apple"
            :class="isReveal ? 'pointer-events-none -translate-y-[1.2cqw] opacity-0' : 'opacity-100'"
          >
            <p class="text-[1.15cqw] font-medium text-white/60">Manche {{ game.roundIndex + 1 }} sur {{ game.roundCount }}</p>

            <div class="flex flex-1 flex-col justify-center">
              <template v-if="phase === 'buzzed' && buzzer">
                <p class="text-[1.3cqw] font-medium text-white/50">A buzzé</p>
                <p class="buzz-in text-[7cqw] font-bold leading-[1] tracking-[-0.04em]" :style="{ color: buzzer.color }">{{ buzzer.name }}</p>
                <p class="mt-[1.6cqw] text-[1.6cqw] font-medium text-white/70">
                  <template v-if="game.buzz?.remainingMs != null">
                    <span class="tabular-nums text-white">{{ Math.ceil(answerCountdown.remaining.value) }} s</span> pour répondre sur son téléphone
                  </template>
                  <template v-else>Réponds à voix haute, le maître du jeu valide</template>
                </p>
              </template>

              <template v-else>
                <p class="text-[11cqw] font-semibold leading-[.9] tracking-[-0.05em] tabular-nums">{{ Math.ceil(extract.remaining.value) }}</p>
                <div class="mb-[1.6cqw] mt-[2.4cqw] h-0.5 overflow-hidden rounded bg-white/10">
                  <div class="h-full origin-left bg-white" :style="{ transform: `scaleX(${extract.remaining.value / game.settings.extractSeconds})` }" />
                </div>

                <template v-if="phase === 'ready'">
                  <p class="text-[2.2cqw] font-semibold tracking-tight">Prêts ?</p>
                  <button
                    type="button"
                    class="mt-[2cqw] self-start rounded-full bg-white px-[2cqw] py-[1cqw] text-[1.3cqw] font-semibold text-black transition hover:bg-white/85"
                    :aria-busy="busy || !player.deviceId.value"
                    @click="startRound"
                  >
                    {{ !player.deviceId.value ? 'Connexion au lecteur…' : busy ? 'Lancement…' : 'Lancer l\'extrait' }}
                  </button>
                  <p class="mt-[1cqw] text-[1cqw] text-white/35">ou appuie sur Espace</p>
                </template>

                <div v-else class="flex flex-col gap-[1.2cqw]">
                  <div class="flex flex-wrap items-center gap-[1cqw] text-[1.2cqw] font-medium">
                    <span v-for="part in (['artist', 'title'] as const)" :key="part" class="rounded-full px-[1.2cqw] py-[.5cqw] transition duration-500 ease-apple" :class="game.found[part] ? 'bg-white text-black' : 'bg-white/8 text-white/45'">
                      {{ foundLabel(part) }}
                    </span>
                    <span v-if="isSolo && feedback" :key="feedback.key" class="feedback ml-[.5cqw]" :class="feedback.hit ? 'text-white' : 'text-white/45'">{{ feedback.text }}</span>
                  </div>
                  <p v-if="!isSolo" :key="game.lastEvent?.id" class="feedback text-[1.4cqw] text-white/60">
                    {{ eventText ?? 'Buzzez sur vos téléphones' }}
                  </p>
                  <form v-else @submit.prevent="submitSoloAnswer">
                    <input
                      ref="answerInput"
                      v-model="answerText"
                      type="text"
                      autocomplete="off"
                      spellcheck="false"
                      placeholder="Titre, artiste ou les deux"
                      aria-label="Ta réponse"
                      class="w-full rounded-[1cqw] bg-white/8 px-[1.6cqw] py-[1.2cqw] text-[1.6cqw] font-medium outline-none ring-white/30 transition placeholder:text-white/30 focus:bg-white/12 focus:ring-1"
                    >
                  </form>
                </div>
              </template>
            </div>

            <GameScoreboard v-if="!isSolo" :game="game" />
            <p v-else class="text-[1.2cqw] text-white/45">Score <span class="font-semibold tabular-nums text-white">{{ soloScore }}</span> / {{ game.roundCount * POINTS_PER_ROUND }}</p>
          </div>

          <!-- Révélation -->
          <div
            class="absolute inset-y-[7cqw] left-[2cqw] right-[7cqw] flex flex-col justify-center transition duration-700 ease-apple"
            :class="isReveal ? 'opacity-100 delay-300' : 'pointer-events-none translate-y-[1.2cqw] opacity-0'"
          >
            <template v-if="shownAnswer">
              <p class="absolute top-0 text-[1.15cqw] font-medium text-white/60">C'était</p>
              <h2 class="text-[5cqw] font-bold leading-none tracking-[-0.035em]">{{ shownAnswer.title }}</h2>
              <div class="transition duration-700 ease-apple" :class="isReveal ? 'opacity-100 delay-500' : 'translate-y-[.8cqw] opacity-0'">
                <p class="mt-[1cqw] text-[2.3cqw] font-medium tracking-tight text-white/65">{{ shownAnswer.artists.join(', ') }}</p>
                <p class="mt-[.5cqw] text-[1.4cqw] text-white/40">{{ shownAnswer.album }}<template v-if="shownAnswer.year"> · {{ shownAnswer.year }}</template></p>

                <div class="mt-[3.2cqw] flex flex-wrap items-center gap-[1cqw] text-[1.25cqw] font-medium">
                  <span v-for="part in (['artist', 'title'] as const)" :key="part" class="rounded-full px-[1.4cqw] py-[.7cqw]" :class="game.found[part] ? 'bg-white/90 text-black' : 'bg-white/10 text-white/50'">
                    {{ foundLabel(part) }}
                  </span>
                  <a :href="shownAnswer.spotifyUrl" target="_blank" rel="noopener" class="ml-[.6cqw] text-white/60 transition hover:text-white">
                    Écouter sur Spotify
                  </a>
                </div>

                <button
                  type="button"
                  class="mt-[4cqw] rounded-full bg-white px-[2cqw] py-[1cqw] text-[1.3cqw] font-semibold text-black transition hover:bg-white/85"
                  @click="next"
                >
                  {{ isLastRound ? 'Voir les résultats' : 'Manche suivante' }}
                </button>
                <p class="mt-[1cqw] text-[1cqw] text-white/35">ou appuie sur Espace</p>
              </div>
            </template>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.feedback {
  animation: rise-in 0.5s var(--ease-apple);
}

.buzz-in {
  animation: rise-in 0.6s var(--ease-apple);
}

@keyframes rise-in {
  from { opacity: 0; transform: translateY(0.6cqw); }
}
</style>
