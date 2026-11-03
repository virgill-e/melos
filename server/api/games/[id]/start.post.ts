import { defineEventHandler, getRouterParam } from 'nuxt/server'

/** Fin de l'écran d'attente : passe à la première manche. */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const game = getHostGame(getRouterParam(event, 'id'), user.id)
  startGame(game)
  return toPublicGame(game)
})
