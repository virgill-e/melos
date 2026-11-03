<script setup lang="ts">
definePageMeta({ immersive: true })

const route = useRoute()
const code = String(route.params.code).toUpperCase()
const STORAGE_KEY = `melos:${code}`
const NAME_KEY = 'melos:name'

interface StoredSeat {
  token: string
  name: string
}

const { data: info, error: infoError } = await useFetch(`/api/join/${code}`)

const view = ref<PlayerView | null>(null)
const joined = ref(false)
const joining = ref(false)
const error = ref<string | null>(null)
const name = ref('')
const role = ref<PlayerRole>('player')

function readSeat(): StoredSeat | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
  }
  catch {
    return null
  }
}

const socket = useGameSocket({
  // À chaque (re)connexion, un téléphone déjà inscrit reprend sa place grâce à son jeton.
  onOpen: () => {
    const seat = readSeat()
    if (!seat?.token) return
    joining.value = true
    socket.send({ type: 'join', code, name: seat.name, role: 'player', token: seat.token })
  },
  onMessage: (message) => {
    if (message.type === 'joined') {
      const seatName = name.value.trim() || readSeat()?.name || ''
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: message.token, name: seatName }))
      joined.value = true
      joining.value = false
      error.value = null
    }
    else if (message.type === 'player-state') {
      if (!view.value || message.view.version >= view.value.version) view.value = message.view
    }
    else if (message.type === 'error') {
      joining.value = false
      error.value = message.message
    }
  },
})

onMounted(() => {
  name.value = localStorage.getItem(NAME_KEY) ?? ''
})

function join() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = 'Choisis un prénom'
    return
  }
  localStorage.setItem(NAME_KEY, trimmed)
  joining.value = true
  error.value = null
  socket.send({ type: 'join', code, name: trimmed, role: role.value })
}

const me = computed(() => view.value?.me)
const isMaster = computed(() => me.value?.role === 'master')
const isMyBuzz = computed(() => !!view.value?.buzz && view.value.buzz.playerId === me.value?.id)
const rank = computed(() => {
  if (!view.value || !me.value) return null
  const better = view.value.players.filter(p => p.role === 'player' && p.score > me.value!.score).length
  return better + 1
})

// Buzzer : retour immédiat au toucher, sans attendre l'aller-retour serveur.
const pressed = ref(false)
function pressBuzz() {
  if (!view.value?.canBuzz) return
  pressed.value = true
  navigator.vibrate?.(40)
  socket.send({ type: 'buzz' })
}
watch(() => view.value?.phase, () => { pressed.value = false })

// Saisie après un buzz (mode buzzer).
const answerText = ref('')
const answerCountdown = useCountdown()
watch(() => view.value?.buzz, (buzz) => {
  if (buzz?.remainingMs != null) answerCountdown.start(buzz.remainingMs / 1000)
  else answerCountdown.pause()
  if (!buzz) answerText.value = ''
})
const answerInput = ref<HTMLInputElement>()
watch(isMyBuzz, async (mine) => {
  if (!mine) return
  await nextTick()
  answerInput.value?.focus()
})

function sendAnswer() {
  const text = answerText.value.trim()
  if (!text) return
  socket.send({ type: 'answer', text })
  answerText.value = ''
}

// Validation du maître du jeu.
const verdict = reactive<FoundState>({ artist: false, title: false })
watch(() => view.value?.buzz?.playerId, () => {
  verdict.artist = false
  verdict.title = false
})
const verdictPoints = computed(() => Number(verdict.artist) + Number(verdict.title))
function sendVerdict(found: FoundState) {
  socket.send({ type: 'judge', found })
}

const lastEventText = computed(() => {
  const event = view.value?.lastEvent
  if (!event || event.playerId !== me.value?.id) return null
  if (event.gained > 0) return `+${event.gained} point${event.gained > 1 ? 's' : ''}`
  return event.kind === 'timeout' ? 'Temps écoulé' : 'Raté'
})

const myPointsThisRound = computed(() => {
  const foundBy = view.value?.foundBy
  if (!foundBy || !me.value) return 0
  return Number(foundBy.artist === me.value.id) + Number(foundBy.title === me.value.id)
})

const playerName = (id: string | null | undefined) => view.value?.players.find(p => p.id === id)?.name
</script>

<template>
  <main class="relative flex min-h-dvh flex-col select-none">
    <p
      v-if="joined && socket.status.value !== 'open'"
      class="absolute inset-x-4 top-4 z-10 rounded-xl bg-white/10 px-4 py-2 text-center text-sm text-white/70 backdrop-blur"
    >
      Reconnexion…
    </p>

    <!-- Inscription -->
    <section v-if="!joined || !view || !me" class="flex flex-1 flex-col justify-center px-6">
      <p class="text-lg font-semibold tracking-tight">Melos</p>
      <h1 class="mt-6 text-4xl font-bold tracking-[-0.035em]">Rejoindre <span class="tracking-[0.15em]">{{ code }}</span></h1>

      <p v-if="info" class="mt-2 text-white/50">{{ info.playlistName }}</p>

      <p v-if="infoError" class="mt-6 text-white/60">Partie introuvable. Vérifie le code sur l'écran principal.</p>
      <p v-else-if="info?.mode === 'solo'" class="mt-6 text-white/60">Cette partie se joue en solo sur l'écran principal.</p>
      <p v-else-if="joining" class="mt-6 text-white/50">Connexion à la partie…</p>
      <form v-else class="mt-8 flex flex-col gap-3" @submit.prevent="join">
        <input
          v-model="name"
          maxlength="16"
          autocomplete="nickname"
          placeholder="Ton prénom"
          aria-label="Ton prénom"
          class="rounded-2xl bg-white/8 px-5 py-4 text-lg font-medium outline-none placeholder:text-white/30 focus:bg-white/12"
        >
        <fieldset v-if="info?.masterAvailable" class="mt-2 grid grid-cols-2 gap-2">
          <legend class="sr-only">Rôle</legend>
          <button
            v-for="option in ([{ value: 'player', label: 'Je joue' }, { value: 'master', label: 'Maître du jeu' }] as const)"
            :key="option.value"
            type="button"
            :aria-pressed="role === option.value"
            class="rounded-2xl px-4 py-3 text-sm font-medium transition"
            :class="role === option.value ? 'bg-white text-black' : 'bg-white/8 text-white/70'"
            @click="role = option.value"
          >
            {{ option.label }}
          </button>
        </fieldset>
        <p v-if="info?.masterAvailable" class="text-xs text-white/35">Le maître du jeu ne joue pas : il voit la réponse et valide.</p>
        <button type="submit" class="mt-3 rounded-2xl bg-white py-4 text-base font-semibold text-black">Rejoindre</button>
      </form>
      <p v-if="error" role="alert" class="mt-4 text-sm text-[#ffb9a8]">{{ error }}</p>
      <NuxtLink v-if="error || infoError" to="/join" class="mt-2 text-sm text-white/50 underline">Saisir un autre code</NuxtLink>
    </section>

    <template v-else>
      <header class="flex items-center justify-between px-5 pb-2 pt-5 text-sm font-semibold">
        <span class="flex items-center gap-2"><PlayerAvatar :player="me" class="w-6 text-[10px]" />{{ me.name }}</span>
        <span v-if="!isMaster" class="tabular-nums text-white/60">{{ me.score }} pt{{ me.score > 1 ? 's' : '' }}</span>
        <span v-else class="text-white/60">Maître du jeu</span>
      </header>

      <!-- Maître du jeu -->
      <section v-if="isMaster" class="flex flex-1 flex-col px-5 pb-6">
        <template v-if="view.phase === 'lobby'">
          <div class="flex flex-1 flex-col justify-center">
            <h1 class="text-3xl font-bold tracking-tight">Tu es le maître du jeu</h1>
            <p class="mt-2 text-white/50">Tu verras chaque réponse ici. Garde ton écran pour toi.</p>
          </div>
        </template>
        <template v-else-if="view.phase === 'finished'">
          <div class="flex flex-1 flex-col justify-center"><h1 class="text-3xl font-bold tracking-tight">Partie terminée</h1></div>
        </template>
        <template v-else>
          <p class="mt-2 text-sm text-white/45">Manche {{ view.roundIndex + 1 }} sur {{ view.roundCount }}</p>
          <div v-if="view.answer" class="mt-4 flex items-center gap-4 rounded-2xl bg-white/6 p-3">
            <img v-if="view.answer.imageUrl" :src="view.answer.imageUrl" alt="" class="size-16 rounded-lg object-cover">
            <div class="min-w-0">
              <p class="truncate text-lg font-semibold">{{ view.answer.title }}</p>
              <p class="truncate text-white/60">{{ view.answer.artists.join(', ') }}</p>
            </div>
          </div>
          <div class="mt-3 flex gap-2 text-xs font-medium">
            <span v-for="part in (['artist', 'title'] as const)" :key="part" class="rounded-full px-3 py-1" :class="view.found[part] ? 'bg-white text-black' : 'bg-white/8 text-white/45'">
              {{ part === 'artist' ? 'Artiste' : 'Titre' }}<template v-if="playerName(view.foundBy[part])"> · {{ playerName(view.foundBy[part]) }}</template>
            </span>
          </div>

          <div v-if="view.phase === 'buzzed' && view.buzz" class="mt-auto flex flex-col gap-3">
            <p class="text-2xl font-bold tracking-tight">{{ view.buzz.name }} <span class="font-medium text-white/50">a la main</span></p>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="part in (['artist', 'title'] as const)"
                :key="part"
                type="button"
                :disabled="view.found[part]"
                :aria-pressed="verdict[part]"
                class="rounded-2xl py-5 text-base font-semibold transition disabled:opacity-30"
                :class="verdict[part] ? 'bg-white text-black' : 'bg-white/10'"
                @click="verdict[part] = !verdict[part]"
              >
                {{ part === 'artist' ? 'Artiste juste' : 'Titre juste' }}
              </button>
            </div>
            <button type="button" class="rounded-2xl bg-white py-5 text-base font-semibold text-black" @click="sendVerdict({ ...verdict })">
              {{ verdictPoints ? `Valider (+${verdictPoints})` : 'Faux, la main passe' }}
            </button>
          </div>
          <p v-else class="mt-auto text-center text-white/45">
            {{ view.phase === 'reveal' ? 'Réponse révélée' : view.phase === 'playing' ? 'En attente d\'un buzz' : 'Manche en préparation' }}
          </p>
        </template>
      </section>

      <!-- Joueur -->
      <section v-else class="flex flex-1 flex-col">
        <div v-if="view.phase === 'lobby'" class="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <PlayerAvatar :player="me" class="w-28 text-3xl" />
          <h1 class="text-3xl font-bold tracking-tight">C'est bon, {{ me.name }}</h1>
          <p class="text-white/50">La partie commence bientôt. Regarde l'écran principal.</p>
        </div>

        <div v-else-if="view.phase === 'ready'" class="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p class="text-white/50">Manche {{ view.roundIndex + 1 }} sur {{ view.roundCount }}</p>
          <h1 class="text-4xl font-bold tracking-tight">Prépare-toi</h1>
        </div>

        <button
          v-else-if="view.phase === 'playing' && view.canBuzz"
          type="button"
          class="m-3 flex flex-1 touch-manipulation flex-col items-center justify-center rounded-[28px] text-black transition-transform duration-100 active:scale-[.97]"
          :class="pressed ? 'scale-[.97] brightness-90' : ''"
          :style="{ backgroundColor: me.color }"
          @pointerdown.prevent="pressBuzz"
        >
          <span class="text-6xl font-bold tracking-[-0.04em]">Buzz</span>
          <span class="mt-2 text-sm font-medium opacity-60">Touche n'importe où</span>
        </button>

        <div v-else-if="view.phase === 'playing'" class="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p v-if="lastEventText" class="text-5xl font-bold tracking-tight">{{ lastEventText }}</p>
          <h1 class="text-2xl font-semibold tracking-tight">Tu as tenté ta chance</h1>
          <p class="text-white/50">La main est aux autres pour cette manche.</p>
        </div>

        <div v-else-if="view.phase === 'buzzed' && isMyBuzz" class="m-3 flex flex-1 flex-col rounded-[28px] bg-white p-5 text-black">
          <template v-if="view.mode === 'buzzer'">
            <div class="flex items-center justify-between">
              <p class="text-2xl font-bold tracking-tight">À toi</p>
              <p class="text-2xl font-bold tabular-nums">{{ Math.ceil(answerCountdown.remaining.value) }}</p>
            </div>
            <div class="mt-2 flex gap-2 text-xs font-medium">
              <span v-for="part in (['artist', 'title'] as const)" :key="part" class="rounded-full px-3 py-1" :class="view.found[part] ? 'bg-black text-white' : 'bg-black/8 text-black/50'">
                {{ part === 'artist' ? 'Artiste' : 'Titre' }}{{ view.found[part] ? ' trouvé' : '' }}
              </span>
            </div>
            <!-- En haut de l'écran : le clavier du téléphone masquerait un champ placé en bas. -->
            <form class="mt-6 flex flex-col gap-3" @submit.prevent="sendAnswer">
              <input
                ref="answerInput"
                v-model="answerText"
                autocomplete="off"
                autocorrect="off"
                spellcheck="false"
                placeholder="Titre, artiste ou les deux"
                aria-label="Ta réponse"
                class="rounded-2xl bg-black/6 px-5 py-4 text-lg font-medium outline-none placeholder:text-black/35 focus:bg-black/10"
              >
              <button type="submit" class="rounded-2xl bg-black py-4 text-base font-semibold text-white">Envoyer</button>
            </form>
          </template>
          <div v-else class="flex flex-1 flex-col items-center justify-center text-center">
            <p class="text-5xl font-bold tracking-tight">À toi</p>
            <p class="mt-2 text-black/60">Réponds à voix haute</p>
          </div>
        </div>

        <div v-else-if="view.phase === 'buzzed'" class="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p class="text-4xl font-bold tracking-tight">{{ view.buzz?.name }}</p>
          <p class="text-white/50">a la main</p>
        </div>

        <div v-else-if="view.phase === 'reveal'" class="flex flex-1 flex-col justify-center gap-4 px-6">
          <p class="text-white/50">C'était</p>
          <div v-if="view.answer" class="flex items-center gap-4">
            <img v-if="view.answer.imageUrl" :src="view.answer.imageUrl" alt="" class="size-20 rounded-lg object-cover">
            <div class="min-w-0">
              <p class="text-xl font-semibold leading-tight">{{ view.answer.title }}</p>
              <p class="truncate text-white/60">{{ view.answer.artists.join(', ') }}</p>
            </div>
          </div>
          <p class="text-3xl font-bold tracking-tight">{{ myPointsThisRound ? `+${myPointsThisRound} point${myPointsThisRound > 1 ? 's' : ''}` : '0 point' }}</p>
        </div>

        <div v-else-if="view.phase === 'finished'" class="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p class="text-white/50">Partie terminée</p>
          <p class="text-7xl font-bold tracking-[-0.05em]">{{ rank === 1 ? '1er' : `${rank}e` }}</p>
          <p class="text-xl font-medium">{{ me.score }} point{{ me.score > 1 ? 's' : '' }}</p>
        </div>
      </section>

      <p v-if="error" role="alert" class="px-5 pb-4 text-center text-sm text-[#ffb9a8]">{{ error }}</p>
    </template>
  </main>
</template>
