import { defineEventHandler, getRouterParam } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const game = getHostGame(getRouterParam(event, 'id'), user.id)
  revealRound(game)
  return toPublicGame(game)
})
