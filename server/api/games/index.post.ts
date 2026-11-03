import { createError, defineEventHandler, readBody } from 'nuxt/server'
import { isUsablePlaylist, type SpotifyPlaylist } from '../../utils/spotify-types'

interface CreateGameBody {
  playlistId?: unknown
  rounds?: unknown
  extractSeconds?: unknown
}

function isOption(options: readonly number[], value: unknown): value is number {
  return typeof value === 'number' && options.includes(value)
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readBody<CreateGameBody>(event)

  if (typeof body?.playlistId !== 'string' || !body.playlistId) {
    throw createError({ statusCode: 400, statusMessage: 'Playlist manquante' })
  }
  if (!isOption(ROUND_OPTIONS, body.rounds) || !isOption(EXTRACT_OPTIONS, body.extractSeconds)) {
    throw createError({ statusCode: 400, statusMessage: 'Réglages de partie invalides' })
  }

  const playlist = await spotifyFetch<SpotifyPlaylist>(event, `/playlists/${encodeURIComponent(body.playlistId)}`)
  if (!isUsablePlaylist(playlist, user.id)) {
    throw createError({ statusCode: 403, statusMessage: 'Spotify ne donne accès qu\'aux playlists dont tu es propriétaire ou collaborateur' })
  }

  const tracks = await fetchPlaylistTracks(event, playlist.id)
  if (!tracks.length) {
    throw createError({ statusCode: 422, statusMessage: 'Aucun morceau jouable dans cette playlist' })
  }

  const game = createGame({
    hostUserId: user.id,
    playlistName: playlist.name,
    settings: { rounds: body.rounds, extractSeconds: body.extractSeconds },
    tracks,
  })
  return toPublicGame(game)
})
