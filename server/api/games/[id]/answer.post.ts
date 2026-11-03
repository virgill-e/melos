import { createError, defineEventHandler, getRouterParam, readBody } from 'nuxt/server'

const MAX_ANSWER_LENGTH = 200

export default defineEventHandler(async (event): Promise<AnswerResult> => {
  const { user } = await requireUserSession(event)
  const game = getHostGame(getRouterParam(event, 'id'), user.id)
  const body = await readBody<{ text?: unknown }>(event)
  if (typeof body?.text !== 'string' || !body.text.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Réponse vide' })
  }

  const { found, gained } = submitSoloAnswer(game, body.text.slice(0, MAX_ANSWER_LENGTH))
  return { found, gained, game: toPublicGame(game) }
})
