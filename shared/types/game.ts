export type GamePhase = 'ready' | 'playing' | 'reveal' | 'finished'

export interface GameSettings {
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

export interface RoundResult {
  answer: TrackAnswer
  found: FoundState
  points: number
}

/** Vue de la partie envoyée au client : la réponse n'y figure qu'après la révélation. */
export interface PublicGame {
  id: string
  playlistName: string
  settings: GameSettings
  phase: GamePhase
  /** Index 0 de la manche courante. */
  roundIndex: number
  roundCount: number
  score: number
  maxScore: number
  found: FoundState
  answer: TrackAnswer | null
  history: RoundResult[]
}

export interface AnswerResult {
  found: FoundState
  gained: number
  game: PublicGame
}
