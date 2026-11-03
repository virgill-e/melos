import { defineEventHandler } from 'nuxt/server'

/** Access token pour le Web Playback SDK de l'appareil hôte (le SDK l'exige côté navigateur). */
export default defineEventHandler(async (event) => {
  return { accessToken: await getSpotifyAccessToken(event) }
})
