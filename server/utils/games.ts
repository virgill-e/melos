import { createError } from 'nuxt/server'
import type { GameTrack } from './tracks'

// Parties gardées en mémoire du serveur local : elles disparaissent au redémarrage, ce qui suffit
// pour une soirée. Les réponses ne quittent le serveur qu'au moment de la révélation
// (sauf vers le téléphone du maître du jeu).

interface Player extends PublicPlayer {
  /** Secret gardé par le téléphone pour se reconnecter après une mise en veille. */
  token: string
}

interface GameRound extends GameTrack {
  startMs: number
  found: FoundState
  foundBy: FoundBy
  /** Joueurs ayant déjà buzzé sur cette manche : la main passe aux autres. */
  locked: Set<string>
  revealed: boolean
}

interface Buzz {
  playerId: string
  expiresAt: number | null
  timer: ReturnType<typeof setTimeout> | null
}

export interface Game {
  id: string
  code: string
  version: number
  hostUserId: string
  playlistId: string
  playlistName: string
  settings: GameSettings
  phase: GamePhase
  roundIndex: number
  rounds: GameRound[]
  players: Player[]
  buzz: Buzz | null
  lastEvent: GameEvent | null
  createdAt: number
}

const GAME_TTL_MS = 6 * 60 * 60 * 1000
const START_MIN_RATIO = 0.2
const START_MAX_RATIO = 0.7
const END_MARGIN_MS = 5_000
const BUZZ_GRACE_MS = 1_000
const MAX_PLAYERS = 12
const MAX_NAME_LENGTH = 16
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const CODE_LENGTH = 4
const PLAYER_COLORS = ['#ff5b3a', '#3d9bff', '#b06cff', '#2fd08a', '#ffb020', '#ff4fa3', '#22c7d6', '#c9e94a']
const SOLO_PLAYER_ID = 'solo'

const games = new Map<string, Game>()
const gameIdsByCode = new Map<string, string>()
/** Morceaux déjà révélés par playlist, pour ne pas les rejouer d'une partie à l'autre (en mémoire). */
const playedByPlaylist = new Map<string, Set<string>>()
const listeners = new Set<(game: Game) => void>()
let eventSequence = 0

/** Appelé à chaque changement d'état d'une partie (diffusion WebSocket). */
export function onGameChange(listener: (game: Game) => void) {
  listeners.add(listener)
}

function changed(game: Game) {
  game.version++
  listeners.forEach(listener => listener(game))
}

function fail(statusCode: number, statusMessage: string): never {
  throw createError({ statusCode, statusMessage })
}

function purgeExpired() {
  const now = Date.now()
  for (const [id, game] of games) {
    if (now - game.createdAt <= GAME_TTL_MS) continue
    if (game.buzz?.timer) clearTimeout(game.buzz.timer)
    games.delete(id)
    gameIdsByCode.delete(game.code)
  }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

function generateCode(): string {
  let code: string
  do {
    code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('')
  } while (gameIdsByCode.has(code))
  return code
}

/** Position de départ tirée entre 20 % et 70 % du morceau, en laissant l'extrait finir avant l'outro. */
function pickStartMs(durationMs: number, extractMs: number): number {
  const min = durationMs * START_MIN_RATIO
  const max = Math.min(durationMs * START_MAX_RATIO, durationMs - extractMs - END_MARGIN_MS)
  if (max <= min) return Math.floor(min)
  return Math.floor(min + Math.random() * (max - min))
}

function currentRound(game: Game): GameRound {
  return game.rounds[game.roundIndex]!
}

function assertPhase(game: Game, ...phases: GamePhase[]) {
  if (!phases.includes(game.phase)) fail(409, `Action impossible pendant la phase "${game.phase}"`)
}

function findPlayer(game: Game, playerId: string): Player {
  return game.players.find(player => player.id === playerId) ?? fail(404, 'Joueur introuvable')
}

const toPublicPlayer = ({ token: _token, ...player }: Player): PublicPlayer => player

/**
 * Tire les morceaux en privilégiant ceux pas encore joués sur cette playlist. Quand il n'en reste
 * plus assez, l'historique repart à zéro et on complète avec les anciens.
 */
function pickTracks(playlistId: string, tracks: GameTrack[], count: number): GameTrack[] {
  const played = playedByPlaylist.get(playlistId) ?? new Set<string>()
  const fresh = shuffle(tracks.filter(track => !played.has(track.id)))
  if (fresh.length >= count) return fresh.slice(0, count)
  playedByPlaylist.delete(playlistId)
  const replayed = shuffle(tracks.filter(track => played.has(track.id)))
  return [...fresh, ...replayed].slice(0, count)
}

function markRevealed(game: Game, round: GameRound) {
  round.revealed = true
  let played = playedByPlaylist.get(game.playlistId)
  if (!played) playedByPlaylist.set(game.playlistId, played = new Set())
  played.add(round.id)
}

// --- Création et accès ---

export function createGame(input: { hostUserId: string, playlistId: string, playlistName: string, settings: GameSettings, tracks: GameTrack[] }): Game {
  purgeExpired()
  const extractMs = input.settings.extractSeconds * 1000
  const solo = input.settings.mode === 'solo'
  const game: Game = {
    id: crypto.randomUUID(),
    code: generateCode(),
    version: 0,
    hostUserId: input.hostUserId,
    playlistId: input.playlistId,
    playlistName: input.playlistName,
    settings: input.settings,
    phase: solo ? 'ready' : 'lobby',
    roundIndex: 0,
    rounds: pickTracks(input.playlistId, input.tracks, input.settings.rounds).map(track => ({
      ...track,
      startMs: pickStartMs(track.durationMs, extractMs),
      found: { title: false, artist: false },
      foundBy: { title: null, artist: null },
      locked: new Set(),
      revealed: false,
    })),
    players: solo
      ? [{ id: SOLO_PLAYER_ID, token: '', name: 'Toi', color: PLAYER_COLORS[0]!, score: 0, connected: true, role: 'player' }]
      : [],
    buzz: null,
    lastEvent: null,
    createdAt: Date.now(),
  }
  games.set(game.id, game)
  gameIdsByCode.set(game.code, game.id)
  return game
}

export function getGame(id: string): Game {
  return games.get(id) ?? fail(404, 'Partie introuvable (le serveur a peut-être redémarré)')
}

export function getHostGame(id: string | undefined, userId: string | undefined): Game {
  const game = getGame(id ?? '')
  if (!userId || game.hostUserId !== userId) fail(403, 'Cette partie appartient à un autre compte')
  return game
}

export function getGameByCode(code: string): Game {
  const id = gameIdsByCode.get(code.trim().toUpperCase())
  return getGame(id ?? '')
}

// --- Joueurs ---

function uniqueName(game: Game, wanted: string): string {
  const taken = new Set(game.players.map(player => player.name.toLowerCase()))
  if (!taken.has(wanted.toLowerCase())) return wanted
  for (let n = 2; ; n++) {
    if (!taken.has(`${wanted} ${n}`.toLowerCase())) return `${wanted} ${n}`
  }
}

function nextColor(game: Game): string {
  const used = new Set(game.players.map(player => player.color))
  return PLAYER_COLORS.find(color => !used.has(color)) ?? PLAYER_COLORS[game.players.length % PLAYER_COLORS.length]!
}

export function joinGame(game: Game, input: { name: string, role: PlayerRole, token?: string }): Player {
  const returning = input.token ? game.players.find(player => player.token === input.token) : undefined
  if (returning) {
    returning.connected = true
    changed(game)
    return returning
  }

  if (game.settings.mode === 'solo') fail(409, 'Cette partie se joue en solo')
  if (game.phase === 'finished') fail(409, 'Cette partie est terminée')

  const name = input.name.trim().slice(0, MAX_NAME_LENGTH)
  if (!name) fail(400, 'Choisis un prénom')

  if (input.role === 'master') {
    if (game.settings.mode !== 'master') fail(409, 'Cette partie n\'a pas de maître du jeu')
    if (game.players.some(player => player.role === 'master')) fail(409, 'Il y a déjà un maître du jeu')
  }
  else if (game.players.filter(player => player.role === 'player').length >= MAX_PLAYERS) {
    fail(409, `La partie est complète (${MAX_PLAYERS} joueurs)`)
  }

  const player: Player = {
    id: crypto.randomUUID().slice(0, 8),
    token: crypto.randomUUID(),
    name: uniqueName(game, name),
    color: nextColor(game),
    score: 0,
    connected: true,
    role: input.role,
  }
  game.players.push(player)
  changed(game)
  return player
}

/** L'hôte retire un joueur (téléphone d'un absent, doublon…), hors du moment où il a la main. */
export function removePlayer(game: Game, playerId: string) {
  const index = game.players.findIndex(player => player.id === playerId)
  if (index === -1) fail(404, 'Joueur introuvable')
  if (game.buzz?.playerId === playerId) fail(409, 'Ce joueur a la main, attends la fin de sa réponse')
  game.players.splice(index, 1)
  changed(game)
}

export function hasPlayer(game: Game, playerId: string): boolean {
  return game.players.some(player => player.id === playerId)
}

export function setPlayerConnected(game: Game, playerId: string, connected: boolean) {
  const player = game.players.find(p => p.id === playerId)
  if (!player || player.connected === connected) return
  player.connected = connected
  changed(game)
}

function canBuzz(game: Game, player: Player): boolean {
  return game.phase === 'playing'
    && player.role === 'player'
    && player.connected
    && !currentRound(game).locked.has(player.id)
}

// --- Déroulé ---

export function startGame(game: Game) {
  assertPhase(game, 'lobby')
  if (!game.players.some(player => player.role === 'player')) fail(409, 'Il faut au moins un joueur')
  if (game.settings.mode === 'master' && !game.players.some(player => player.role === 'master')) {
    fail(409, 'Il manque le maître du jeu')
  }
  game.phase = 'ready'
  changed(game)
}

export function startRound(game: Game): GameRound {
  assertPhase(game, 'ready')
  game.phase = 'playing'
  game.lastEvent = null
  changed(game)
  return currentRound(game)
}

/** Annule le démarrage si Spotify refuse la lecture, pour pouvoir réessayer. */
export function cancelRoundStart(game: Game) {
  if (game.phase !== 'playing') return
  game.phase = 'ready'
  changed(game)
}

function clearBuzz(game: Game) {
  if (game.buzz?.timer) clearTimeout(game.buzz.timer)
  game.buzz = null
}

export function revealRound(game: Game) {
  assertPhase(game, 'ready', 'playing', 'buzzed')
  clearBuzz(game)
  game.phase = 'reveal'
  markRevealed(game, currentRound(game))
  changed(game)
}

export function nextRound(game: Game) {
  assertPhase(game, 'reveal')
  if (game.roundIndex + 1 >= game.rounds.length) game.phase = 'finished'
  else {
    game.roundIndex++
    game.phase = 'ready'
  }
  game.lastEvent = null
  changed(game)
}

/** Crédite les parties de la réponse encore non trouvées et renvoie le nombre de points gagnés. */
function credit(game: Game, player: Player, match: FoundState): number {
  const round = currentRound(game)
  let gained = 0
  for (const part of ['artist', 'title'] as const) {
    if (!match[part] || round.found[part]) continue
    round.found[part] = true
    round.foundBy[part] = player.id
    gained++
  }
  player.score += gained
  return gained
}

// --- Solo ---

export function submitSoloAnswer(game: Game, text: string): { found: FoundState, gained: number } {
  if (game.settings.mode !== 'solo') fail(409, 'Les réponses se donnent sur les téléphones')
  assertPhase(game, 'playing')
  const round = currentRound(game)
  const match = matchAnswer(text, round.answer)
  const gained = credit(game, findPlayer(game, SOLO_PLAYER_ID), match)
  if (round.found.title && round.found.artist) revealRound(game)
  else changed(game)
  return { found: match, gained }
}

// --- Buzzers ---

export function buzz(game: Game, playerId: string) {
  const player = findPlayer(game, playerId)
  if (!canBuzz(game, player)) return
  const timed = game.settings.mode === 'buzzer'
  const answerMs = BUZZ_ANSWER_SECONDS * 1000
  game.buzz = {
    playerId,
    expiresAt: timed ? Date.now() + answerMs : null,
    // Sans réponse à temps, le buzz compte comme une erreur.
    timer: timed ? setTimeout(() => resolveBuzz(game, playerId, { title: false, artist: false }, true), answerMs + BUZZ_GRACE_MS) : null,
  }
  game.phase = 'buzzed'
  changed(game)
}

function resolveBuzz(game: Game, playerId: string, match: FoundState, timedOut = false) {
  if (game.phase !== 'buzzed' || game.buzz?.playerId !== playerId) return
  clearBuzz(game)
  const round = currentRound(game)
  const player = findPlayer(game, playerId)
  const gained = credit(game, player, match)
  round.locked.add(playerId)

  const complete = round.found.title && round.found.artist
  game.lastEvent = {
    id: ++eventSequence,
    kind: gained === 0 ? (timedOut ? 'timeout' : 'miss') : complete ? 'hit' : 'partial',
    playerId,
    gained,
  }

  const someoneCanStillBuzz = game.players.some(p => p.role === 'player' && p.connected && !round.locked.has(p.id))
  if (complete || !someoneCanStillBuzz) {
    game.phase = 'reveal'
    markRevealed(game, round)
  }
  else {
    game.phase = 'playing'
  }
  changed(game)
}

export function answerBuzz(game: Game, playerId: string, text: string) {
  if (game.settings.mode !== 'buzzer') fail(409, 'C\'est le maître du jeu qui valide')
  if (game.phase !== 'buzzed' || game.buzz?.playerId !== playerId) fail(409, 'Ce n\'est pas à toi de répondre')
  resolveBuzz(game, playerId, matchAnswer(text, currentRound(game).answer))
}

export function judgeBuzz(game: Game, masterId: string, found: FoundState) {
  if (findPlayer(game, masterId).role !== 'master') fail(403, 'Seul le maître du jeu valide')
  if (game.phase !== 'buzzed' || !game.buzz) fail(409, 'Personne n\'a la main')
  resolveBuzz(game, game.buzz.playerId, found)
}

// --- Vues ---

function remainingBuzzMs(game: Game): number | null {
  return game.buzz?.expiresAt ? Math.max(0, game.buzz.expiresAt - Date.now()) : null
}

function history(game: Game): RoundResult[] {
  return game.rounds.filter(round => round.revealed).map(round => ({
    answer: round.answer,
    found: { ...round.found },
    foundBy: { ...round.foundBy },
  }))
}

export function toPublicGame(game: Game): PublicGame {
  const round = game.rounds[game.roundIndex]
  return {
    id: game.id,
    code: game.code,
    version: game.version,
    playlistName: game.playlistName,
    settings: game.settings,
    phase: game.phase,
    roundIndex: game.roundIndex,
    roundCount: game.rounds.length,
    players: game.players.map(toPublicPlayer),
    found: { ...(round?.found ?? { title: false, artist: false }) },
    foundBy: { ...(round?.foundBy ?? { title: null, artist: null }) },
    buzz: game.buzz ? { playerId: game.buzz.playerId, remainingMs: remainingBuzzMs(game) } : null,
    lockedPlayerIds: round ? [...round.locked] : [],
    lastEvent: game.lastEvent,
    answer: game.phase === 'reveal' && round ? round.answer : null,
    history: history(game),
  }
}

export function toPlayerView(game: Game, playerId: string): PlayerView {
  const me = findPlayer(game, playerId)
  const round = game.rounds[game.roundIndex]
  const inRound = game.phase === 'ready' || game.phase === 'playing' || game.phase === 'buzzed'
  const buzzer = game.buzz ? game.players.find(player => player.id === game.buzz!.playerId) : undefined
  return {
    code: game.code,
    version: game.version,
    mode: game.settings.mode,
    phase: game.phase,
    roundIndex: game.roundIndex,
    roundCount: game.rounds.length,
    me: toPublicPlayer(me),
    players: game.players.map(toPublicPlayer),
    buzz: game.buzz && buzzer ? { playerId: buzzer.id, name: buzzer.name, remainingMs: remainingBuzzMs(game) } : null,
    canBuzz: canBuzz(game, me),
    found: { ...(round?.found ?? { title: false, artist: false }) },
    foundBy: { ...(round?.foundBy ?? { title: null, artist: null }) },
    answer: round && (game.phase === 'reveal' || (me.role === 'master' && inRound)) ? round.answer : null,
    lastEvent: game.lastEvent,
  }
}
