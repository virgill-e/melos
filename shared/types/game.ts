/**
 * - solo : la réponse se tape sur l'écran principal.
 * - buzzer : le premier qui buzze tape sa réponse sur son téléphone, validation automatique.
 * - master : un maître du jeu (qui ne joue pas) voit la réponse et valide les réponses orales.
 */
export type GameMode = 'solo' | 'buzzer' | 'master'

export type GamePhase = 'lobby' | 'ready' | 'playing' | 'buzzed' | 'reveal' | 'finished'

export type PlayerRole = 'player' | 'master'

export interface GameSettings {
  mode: GameMode
  rounds: number
  extractSeconds: number
}

export interface TrackAnswer {
  title: string
  artists: string[]
  album: string
  year: string | null
  imageUrl: string | null
  spotifyUrl: string
}

export interface FoundState {
  title: boolean
  artist: boolean
}

/** Id du joueur qui a trouvé chaque partie de la réponse. */
export interface FoundBy {
  title: string | null
  artist: string | null
}

export interface PublicPlayer {
  id: string
  name: string
  color: string
  score: number
  connected: boolean
  role: PlayerRole
}

export interface BuzzState {
  playerId: string
  /** Temps restant pour répondre au moment de l'envoi (mode buzzer), null en mode maître du jeu. */
  remainingMs: number | null
}

export interface GameEvent {
  /** Incrémental, pour rejouer l'animation à chaque nouvel événement. */
  id: number
  kind: 'hit' | 'partial' | 'miss' | 'timeout'
  playerId: string
  gained: number
}

export interface RoundResult {
  answer: TrackAnswer
  found: FoundState
  foundBy: FoundBy
}

/** Vue de l'écran principal : la réponse n'y figure qu'après la révélation. */
export interface PublicGame {
  id: string
  code: string
  /** Incrémenté à chaque changement, pour ignorer un état plus ancien reçu en retard. */
  version: number
  playlistName: string
  settings: GameSettings
  phase: GamePhase
  /** Index 0 de la manche courante. */
  roundIndex: number
  roundCount: number
  players: PublicPlayer[]
  found: FoundState
  foundBy: FoundBy
  buzz: BuzzState | null
  lockedPlayerIds: string[]
  lastEvent: GameEvent | null
  answer: TrackAnswer | null
  history: RoundResult[]
}

/** Vue d'un téléphone. Le maître du jeu voit la réponse pendant la manche, les joueurs seulement à la révélation. */
export interface PlayerView {
  code: string
  version: number
  mode: GameMode
  phase: GamePhase
  roundIndex: number
  roundCount: number
  me: PublicPlayer
  players: PublicPlayer[]
  buzz: (BuzzState & { name: string }) | null
  canBuzz: boolean
  found: FoundState
  foundBy: FoundBy
  answer: TrackAnswer | null
  lastEvent: GameEvent | null
}

export interface AnswerResult {
  found: FoundState
  gained: number
  game: PublicGame
}

export type ClientMessage =
  | { type: 'host', gameId: string }
  | { type: 'join', code: string, name: string, role: PlayerRole, token?: string }
  | { type: 'buzz' }
  | { type: 'answer', text: string }
  | { type: 'judge', found: FoundState }

export type ServerMessage =
  | { type: 'host-state', game: PublicGame }
  | { type: 'player-state', view: PlayerView }
  | { type: 'joined', playerId: string, token: string }
  | { type: 'error', message: string, fatal?: boolean }
