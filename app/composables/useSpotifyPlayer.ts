/// <reference types="spotify-web-playback-sdk" />

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js'
const PLAYER_VOLUME = 0.8
const FADE_STEPS = 10
const PLAYBACK_START_TIMEOUT_MS = 8_000

let sdkLoading: Promise<void> | null = null

function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve()
  sdkLoading ??= new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onerror = () => {
      sdkLoading = null
      reject(new Error('Impossible de charger le lecteur Spotify'))
    }
    document.head.appendChild(script)
  })
  return sdkLoading
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Lecteur Web Playback SDK de l'appareil hôte. La lecture d'un morceau est déclenchée côté serveur
 * (PUT /me/player/play sur `deviceId`) : le navigateur ne reçoit jamais la liste des réponses.
 */
export function useSpotifyPlayer() {
  const deviceId = ref<string | null>(null)
  const error = ref<string | null>(null)
  let player: Spotify.Player | null = null
  let playbackWaiters: (() => void)[] = []

  async function connect() {
    try {
      await loadSdk()
    }
    catch (e) {
      error.value = (e as Error).message
      return
    }

    player = new window.Spotify.Player({
      name: 'Melos',
      volume: PLAYER_VOLUME,
      getOAuthToken: (callback) => {
        $fetch('/api/spotify/token')
          .then(({ accessToken }) => callback(accessToken))
          .catch(() => { error.value = 'Session Spotify expirée, reconnecte-toi.' })
      },
    })

    player.addListener('ready', ({ device_id }) => {
      deviceId.value = device_id
      error.value = null
    })
    player.addListener('not_ready', () => { deviceId.value = null })
    player.addListener('initialization_error', () => { error.value = 'Ce navigateur ne permet pas la lecture Spotify. Utilise Chrome, Edge ou Firefox sur ordinateur.' })
    player.addListener('authentication_error', () => { error.value = 'Spotify a refusé l\'authentification du lecteur. Reconnecte-toi.' })
    player.addListener('account_error', () => { error.value = 'Un compte Spotify Premium est nécessaire pour la lecture.' })
    player.addListener('playback_error', ({ message }) => { error.value = `Erreur de lecture : ${message}` })
    player.addListener('player_state_changed', (state) => {
      if (state && !state.paused) {
        playbackWaiters.forEach(resolve => resolve())
        playbackWaiters = []
      }
    })

    if (!await player.connect()) error.value = 'Connexion au lecteur Spotify impossible.'
  }

  /** À appeler dans un geste utilisateur (clic) : sans ça, certains navigateurs bloquent l'audio. */
  function activate() {
    return player?.activateElement()
  }

  /** Résout quand le son démarre réellement, pour caler le chrono sur l'audio et non sur la requête. */
  function waitForPlayback(): Promise<void> {
    return Promise.race([
      new Promise<void>(resolve => playbackWaiters.push(resolve)),
      wait(PLAYBACK_START_TIMEOUT_MS),
    ])
  }

  async function fadeTo(volume: number, durationMs: number) {
    if (!player) return
    const from = await player.getVolume()
    for (let step = 1; step <= FADE_STEPS; step++) {
      await player.setVolume(from + (volume - from) * (step / FADE_STEPS))
      await wait(durationMs / FADE_STEPS)
    }
  }

  async function prepareFadeIn() {
    await player?.setVolume(0)
  }

  function fadeIn() {
    return fadeTo(PLAYER_VOLUME, 700)
  }

  async function fadeOutAndPause() {
    await fadeTo(0, 400)
    await player?.pause()
    await player?.setVolume(PLAYER_VOLUME)
  }

  onMounted(connect)
  onBeforeUnmount(() => player?.disconnect())

  return { deviceId, error, activate, waitForPlayback, prepareFadeIn, fadeIn, fadeOutAndPause }
}
