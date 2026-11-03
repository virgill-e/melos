import { createError } from 'nuxt/server'
import type { GameTrack } from './tracks'

// Parties gardées en mémoire du serveur local : elles disparaissent au redémarrage, ce qui suffit
// pour une soirée. Les réponses ne quittent le serveur qu'au moment de la révélation.

interface GameRound extends GameTrack {
  startMs: number
  found: FoundState
  revealed: boolean
}

interface Game {
  id: string
  hostUserId: string
  playlistName: string
  settings: GameSettings
  phase: GamePhase
  roundIndex: number
  rounds: GameRound[]
  createdAt: number
}

const GAME_TTL_MS = 6 * 60 * 60 * 1000
const START_MIN_RATIO = 0.2
const START_MAX_RATIO = 0.7
const END_MARGIN_MS = 5_000

const games = new Map<string, Game>()

function purgeExpired() {
  const now = Date.now()
  for (const [id, game] of games) {
    if (now - game.createdAt > GAME_TTL_MS) games.delete(id)
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

/** Position de départ tirée entre 20 % et 70 % du morceau, en laissant l'extrait finir avant l'outro. */
function pickStartMs(durationMs: number, extractMs: number): number {
  const min = durationMs * START_MIN_RATIO
  const max = Math.min(durationMs * START_MAX_RATIO, durationMs - extractMs - END_MARGIN_MS)
  if (max <= min) return Math.floor(min)
  return Math.floor(min + Math.random() * (max - min))
}

const roundPoints = (found: FoundState) => Number(found.title) + Number(found.artist)

export function createGame(input: { hostUserId: string, playlistName: string, settings: GameSettings, tracks: GameTrack[] }): Game {
  purgeExpired()
  const extractMs = input.settings.extractSeconds * 1000
  const game: Game = {
    id: crypto.randomUUID(),
    hostUserId: input.hostUserId,
    playlistName: input.playlistName,
    settings: input.settings,
    phase: 'ready',
    roundIndex: 0,
    rounds: shuffle(input.tracks).slice(0, input.settings.rounds).map(track => ({
      ...track,
      startMs: pickStartMs(track.durationMs, extractMs),
      found: { title: false, artist: false },
      revealed: false,
    })),
    createdAt: Date.now(),
  }
  games.set(game.id, game)
  return game
}

export function getHostGame(id: string | undefined, userId: string): Game {
  const game = id ? games.get(id) : undefined
  if (!game) throw createError({ statusCode: 404, statusMessage: 'Partie introuvable (le serveur a peut-être redémarré)' })
  if (game.hostUserId !== userId) throw createError({ statusCode: 403, statusMessage: 'Cette partie appartient à un autre compte' })
  return game
}

function assertPhase(game: Game, ...phases: GamePhase[]) {
  if (!phases.includes(game.phase)) {
    throw createError({ statusCode: 409, statusMessage: `Action impossible pendant la phase "${game.phase}"` })
  }
}

function currentRound(game: Game): GameRound {
  return game.rounds[game.roundIndex]!
}

export function toPublicGame(game: Game): PublicGame {
  const round = game.rounds[game.roundIndex]
  return {
    id: game.id,
    playlistName: game.playlistName,
    settings: game.settings,
    phase: game.phase,
    roundIndex: game.roundIndex,
    roundCount: game.rounds.length,
    score: game.rounds.reduce((total, r) => total + roundPoints(r.found), 0),
    maxScore: game.rounds.length * POINTS_PER_ROUND,
    found: round?.found ?? { title: false, artist: false },
    answer: game.phase === 'reveal' && round ? round.answer : null,
    history: game.rounds.filter(r => r.revealed).map(r => ({ answer: r.answer, found: r.found, points: roundPoints(r.found) })),
  }
}

export function startRound(game: Game): GameRound {
  assertPhase(game, 'ready')
  game.phase = 'playing'
  return currentRound(game)
}

/** Annule le démarrage si Spotify refuse la lecture, pour pouvoir réessayer. */
export function cancelRoundStart(game: Game) {
  if (game.phase === 'playing') game.phase = 'ready'
}

export function revealRound(game: Game) {
  assertPhase(game, 'playing', 'ready')
  game.phase = 'reveal'
  currentRound(game).revealed = true
}

export function submitAnswer(game: Game, text: string): { found: FoundState, gained: number } {
  assertPhase(game, 'playing')
  const round = currentRound(game)
  const match = matchAnswer(text, round.answer)
  const found = { title: round.found.title || match.title, artist: round.found.artist || match.artist }
  const gained = roundPoints(found) - roundPoints(round.found)
  round.found = found
  if (found.title && found.artist) revealRound(game)
  return { found: match, gained }
}

export function nextRound(game: Game) {
  assertPhase(game, 'reveal')
  if (game.roundIndex + 1 >= game.rounds.length) {
    game.phase = 'finished'
    return
  }
  game.roundIndex++
  game.phase = 'ready'
}
