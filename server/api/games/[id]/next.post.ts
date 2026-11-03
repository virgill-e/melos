import { defineEventHandler, getRouterParam } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const game = getHostGame(getRouterParam(event, 'id'), user.id)
  nextRound(game)
  return toPublicGame(game)
})
