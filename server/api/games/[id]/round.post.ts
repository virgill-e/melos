import { createError, defineEventHandler, getRouterParam, readBody } from 'nuxt/server'

/** Démarre l'extrait de la manche courante sur le lecteur Web Playback SDK de l'hôte. */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const game = getHostGame(getRouterParam(event, 'id'), user.id)
  const body = await readBody<{ deviceId?: unknown }>(event)
  if (typeof body?.deviceId !== 'string' || !body.deviceId) {
    throw createError({ statusCode: 400, statusMessage: 'Lecteur Spotify manquant' })
  }

  const round = startRound(game)
  try {
    await spotifyFetch(event, '/me/player/play', {
      method: 'PUT',
      query: { device_id: body.deviceId },
      body: { uris: [round.uri], position_ms: round.startMs },
    })
  }
  catch (error) {
    cancelRoundStart(game)
    throw error
  }
  return toPublicGame(game)
})
