<script setup lang="ts">
definePageMeta({ middleware: 'auth', immersive: true })

const route = useRoute()
const gameId = route.params.id as string
const { data: game, error: loadError } = await useFetch<PublicGame>(`/api/games/${gameId}`)

const player = useSpotifyPlayer()
const busy = ref(false)
const actionError = ref<string | null>(null)

const phase = computed(() => game.value?.phase)
const isReveal = computed(() => phase.value === 'reveal')
const roundLabel = computed(() => game.value ? `MANCHE ${String(game.value.roundIndex + 1).padStart(2, '0')}` : '')
const roundPoints = computed(() => Number(game.value?.found.title) + Number(game.value?.found.artist))
const isLastRound = computed(() => !!game.value && game.value.roundIndex + 1 >= game.value.roundCount)

// On garde la dernière réponse affichée pendant le fondu de sortie, au lieu de la vider d'un coup.
const shownAnswer = ref<TrackAnswer | null>(game.value?.answer ?? null)
watch(() => game.value?.answer, (answer) => {
  if (answer) shownAnswer.value = answer
})

function errorMessage(error: unknown, fallback: string) {
  return (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
}

// Chrono : démarre quand le son démarre réellement, révèle automatiquement à zéro.
const remaining = ref(game.value?.settings.extractSeconds ?? 0)
let timerFrame = 0

function startTimer() {
  const total = game.value!.settings.extractSeconds
  const startedAt = performance.now()
  const tick = (now: number) => {
    remaining.value = Math.max(0, total - (now - startedAt) / 1000)
    if (remaining.value <= 0) return void reveal()
    timerFrame = requestAnimationFrame(tick)
  }
  timerFrame = requestAnimationFrame(tick)
}

function stopTimer() {
  cancelAnimationFrame(timerFrame)
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
    game.value = await $fetch<PublicGame>(`/api/games/${gameId}/round`, {
      method: 'POST',
      body: { deviceId: player.deviceId.value },
    })
    await playbackStarted
    void player.fadeIn()
    remaining.value = game.value.settings.extractSeconds
    startTimer()
    await nextTick()
    answerInput.value?.focus()
  }
  catch (error) {
    actionError.value = errorMessage(error, 'Impossible de lancer l\'extrait.')
  }
  finally {
    busy.value = false
  }
}

async function onRevealed() {
  stopTimer()
  await player.fadeOutAndPause()
}

async function reveal() {
  stopTimer()
  if (phase.value !== 'playing') return
  try {
    game.value = await $fetch<PublicGame>(`/api/games/${gameId}/reveal`, { method: 'POST' })
  }
  catch {
    // Une bonne réponse a pu révéler la manche entre-temps : on se resynchronise.
    game.value = await $fetch<PublicGame>(`/api/games/${gameId}`)
  }
  await onRevealed()
}

async function submitAnswer() {
  const text = answerText.value.trim()
  if (!text || phase.value !== 'playing') return
  answerText.value = ''
  try {
    const result = await $fetch<AnswerResult>(`/api/games/${gameId}/answer`, { method: 'POST', body: { text } })
    game.value = result.game
    feedback.value = {
      hit: result.gained > 0,
      text: result.gained > 0 ? `+${result.gained}` : 'Pas ça',
      key: Date.now(),
    }
    if (result.game.phase === 'reveal') await onRevealed()
  }
  catch (error) {
    actionError.value = errorMessage(error, 'Réponse non envoyée.')
  }
}

async function next() {
  if (!isReveal.value || busy.value) return
  try {
    game.value = await $fetch<PublicGame>(`/api/games/${gameId}/next`, { method: 'POST' })
    if (game.value.phase === 'ready') await startRound()
  }
  catch (error) {
    actionError.value = errorMessage(error, 'Impossible de passer à la manche suivante.')
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.code !== 'Space') return
  event.preventDefault()
  if (phase.value === 'ready') void startRound()
  else if (isReveal.value) void next()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  stopTimer()
})
</script>

<template>
  <div v-if="loadError || !game" class="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
    <p class="text-2xl font-semibold tracking-tight">Partie introuvable</p>
    <p class="text-white/50">{{ loadError?.statusMessage ?? 'Elle a peut-être expiré.' }}</p>
    <NuxtLink to="/playlists" class="mt-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">Nouvelle partie</NuxtLink>
  </div>

  <GameResults v-else-if="game.phase === 'finished'" :game="game" />

  <div v-else class="@container relative isolate h-dvh overflow-hidden bg-surface">
    <div
      class="absolute -inset-[10%] -z-10 scale-110 bg-cover bg-center blur-[120px] saturate-150 brightness-[.55] transition-opacity duration-[1200ms] ease-apple"
      :class="isReveal ? 'opacity-100' : 'opacity-0'"
      :style="shownAnswer?.imageUrl ? { backgroundImage: `url(${shownAnswer.imageUrl})` } : undefined"
    />

    <header class="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-[4cqw] py-[2.4cqw] text-[max(13px,1.05cqw)]">
      <span class="font-semibold tracking-tight">Melos <span class="ml-2 font-normal text-white/40">{{ game.playlistName }}</span></span>
      <NuxtLink to="/playlists" class="text-white/50 transition hover:text-white">Quitter la partie</NuxtLink>
    </header>

    <p
      v-if="player.error.value || actionError"
      role="alert"
      class="absolute left-1/2 top-[6cqw] z-10 -translate-x-1/2 rounded-full bg-accent/20 px-5 py-2 text-sm text-[#ffb9a8] backdrop-blur"
    >
      {{ player.error.value ?? actionError }}
    </p>

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
            <p class="text-[11cqw] font-semibold leading-[.9] tracking-[-0.05em] tabular-nums">{{ Math.ceil(remaining) }}</p>
            <div class="mb-[1.6cqw] mt-[2.4cqw] h-0.5 overflow-hidden rounded bg-white/10">
              <div class="h-full origin-left bg-white" :style="{ transform: `scaleX(${remaining / game.settings.extractSeconds})` }" />
            </div>

            <template v-if="phase === 'ready'">
              <p class="text-[2.2cqw] font-semibold tracking-tight">Prêt ?</p>
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

            <form v-else class="flex flex-col gap-[1.2cqw]" @submit.prevent="submitAnswer">
              <div class="flex items-center gap-[1cqw] text-[1.2cqw] font-medium">
                <span class="rounded-full px-[1.2cqw] py-[.5cqw] transition duration-500 ease-apple" :class="game.found.artist ? 'bg-white text-black' : 'bg-white/8 text-white/45'">Artiste</span>
                <span class="rounded-full px-[1.2cqw] py-[.5cqw] transition duration-500 ease-apple" :class="game.found.title ? 'bg-white text-black' : 'bg-white/8 text-white/45'">Titre</span>
                <span v-if="feedback" :key="feedback.key" class="feedback ml-[.5cqw]" :class="feedback.hit ? 'text-white' : 'text-white/45'">{{ feedback.text }}</span>
              </div>
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

          <p class="text-[1.2cqw] text-white/45">Score <span class="font-semibold tabular-nums text-white">{{ game.score }}</span> / {{ game.maxScore }}</p>
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

              <div class="mt-[3.2cqw] flex items-center gap-[1.4cqw]">
                <span class="rounded-full bg-white/14 px-[1.6cqw] py-[.9cqw] text-[1.35cqw] font-semibold tabular-nums">
                  {{ roundPoints > 0 ? `+${roundPoints} point${roundPoints > 1 ? 's' : ''}` : '0 point' }}
                </span>
                <a :href="shownAnswer.spotifyUrl" target="_blank" rel="noopener" class="text-[1.2cqw] font-medium text-white/60 transition hover:text-white">
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
  </div>
</template>

<style scoped>
.feedback {
  animation: feedback-in 0.5s var(--ease-apple);
}

@keyframes feedback-in {
  from { opacity: 0; transform: translateY(0.4cqw); }
}
</style>
