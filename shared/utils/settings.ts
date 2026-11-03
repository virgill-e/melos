import type { GameMode, GameSettings } from '../types/game'

/** Nombres de manches proposés. */
export const ROUND_OPTIONS: readonly number[] = [5, 10, 15, 20]

/** Durées d'extrait proposées, en secondes. */
export const EXTRACT_OPTIONS: readonly number[] = [10, 15, 20, 30]

/** Modes de jeu proposés, dans l'ordre d'affichage. */
export const MODE_OPTIONS: readonly { value: GameMode, label: string }[] = [
  { value: 'buzzer', label: 'Buzz puis saisie' },
  { value: 'master', label: 'Maître du jeu' },
  { value: 'solo', label: 'Solo' },
]

/** Réglages proposés par défaut. */
export const DEFAULT_SETTINGS: GameSettings = { mode: 'buzzer', rounds: 10, extractSeconds: 20 }

/** Points par manche : 1 pour l'artiste, 1 pour le titre. */
export const POINTS_PER_ROUND = 2

/** Temps laissé au joueur qui a buzzé pour taper sa réponse. */
export const BUZZ_ANSWER_SECONDS = 15
