declare module '#auth-utils' {
  interface User {
    id: string
    name: string
    avatar: string | null
  }

  // Jamais exposé au client : uniquement lisible côté serveur.
  interface SecureSessionData {
    spotify: SpotifyTokens
  }
}

export interface SpotifyTokens {
  accessToken: string
  refreshToken: string
  /** Timestamp (ms) d'expiration de l'access token. */
  expiresAt: number
}
