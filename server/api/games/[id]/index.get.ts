import { defineEventHandler, getRouterParam } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  return toPublicGame(getHostGame(getRouterParam(event, 'id'), user.id))
})
