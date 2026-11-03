import type { GameSettings } from '../types/game'

/** Nombres de manches proposés. */
export const ROUND_OPTIONS: readonly number[] = [5, 10, 15, 20]

/** Durées d'extrait proposées, en secondes. */
export const EXTRACT_OPTIONS: readonly number[] = [10, 15, 20, 30]

/** Réglages proposés par défaut. */
export const DEFAULT_SETTINGS: GameSettings = { rounds: 10, extractSeconds: 20 }

/** Points par manche : 1 pour l'artiste, 1 pour le titre. */
export const POINTS_PER_ROUND = 2
