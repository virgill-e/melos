import type { RequestEvent } from 'nuxt/server'
import { createError, useRuntimeConfig } from 'nuxt/server'
import type { SpotifyTokens } from '#shared/types/auth'

const API_BASE = 'https://api.spotify.com/v1'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const REFRESH_MARGIN_MS = 60_000

export const SPOTIFY_SCOPES = [
  // Web Playback SDK
  'streaming',
  'user-read-email',
  'user-read-private',
  // Contrôle de la lecture (démarrage à une position aléatoire, pause)
  'user-read-playback-state',
  'user-modify-playback-state',
  // Source des morceaux
  'playlist-read-private',
  'playlist-read-collaborative',
]

export function toSpotifyTokens(raw: { access_token: string, expires_in: number, refresh_token?: string }, previousRefreshToken?: string): SpotifyTokens {
  const refreshToken = raw.refresh_token ?? previousRefreshToken
  if (!refreshToken) throw createError({ statusCode: 502, statusMessage: 'Spotify n\'a pas renvoyé de refresh token' })
  return {
    accessToken: raw.access_token,
    refreshToken,
    expiresAt: Date.now() + raw.expires_in * 1000,
  }
}

async function refreshAccessToken(event: RequestEvent, refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = useRuntimeConfig().oauth.spotify
  let raw: { access_token: string, expires_in: number, refresh_token?: string }
  try {
    raw = await $fetch(TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    })
  }
  catch {
    // Refresh token révoqué ou app modifiée : on force une reconnexion.
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Session Spotify expirée' })
  }
  const tokens = toSpotifyTokens(raw, refreshToken)
  await setUserSession(event, { secure: { spotify: tokens } })
  return tokens.accessToken
}

export async function getSpotifyAccessToken(event: RequestEvent, { forceRefresh = false } = {}): Promise<string> {
  const session = await requireUserSession(event)
  const tokens = session.secure?.spotify
  if (!tokens) throw createError({ statusCode: 401, statusMessage: 'Session Spotify absente' })
  if (!forceRefresh && tokens.expiresAt - REFRESH_MARGIN_MS > Date.now()) return tokens.accessToken
  return refreshAccessToken(event, tokens.refreshToken)
}

interface SpotifyFetchOptions {
  method?: 'GET' | 'POST' | 'PUT'
  query?: Record<string, string | number>
  body?: Record<string, unknown>
}

export async function spotifyFetch<T>(event: RequestEvent, path: string, options: SpotifyFetchOptions = {}): Promise<T> {
  const call = (token: string) => $fetch<T>(path, {
    baseURL: API_BASE,
    method: options.method ?? 'GET',
    query: options.query,
    body: options.body,
    headers: { Authorization: `Bearer ${token}` },
  })

  try {
    return await call(await getSpotifyAccessToken(event))
  }
  catch (error: any) {
    const status = error?.response?.status ?? error?.statusCode
    if (status === 401) return call(await getSpotifyAccessToken(event, { forceRefresh: true }))
    if (status === 403) throw createError({ statusCode: 403, statusMessage: 'Spotify a refusé la requête : compte non autorisé sur l\'app (User Management) ou sans Premium' })
    if (status === 404 && path.startsWith('/me/player')) throw createError({ statusCode: 404, statusMessage: 'Lecteur Spotify introuvable, recharge la page' })
    if (status === 429) throw createError({ statusCode: 429, statusMessage: 'Quota Spotify atteint, réessaie dans quelques instants' })
    throw error
  }
}
