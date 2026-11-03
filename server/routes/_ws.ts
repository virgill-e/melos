const MAX_ANSWER_LENGTH = 200

function errorMessage(error: unknown): string {
  const e = error as { statusMessage?: string, message?: string }
  return e?.statusMessage ?? e?.message ?? 'Erreur inattendue'
}

export default defineWebSocketHandler({
  async message(peer, raw) {
    let message: ClientMessage
    try {
      message = JSON.parse(raw.text())
    }
    catch {
      return sendMessage(peer, { type: 'error', message: 'Message illisible' })
    }

    try {
      switch (message.type) {
        case 'host': {
          // L'écran principal s'authentifie avec le cookie de session de l'hôte.
          const session = await getUserSession(peer)
          const game = getHostGame(message.gameId, session.user?.id)
          subscribe({ peer, gameId: game.id, kind: 'host' }, game)
          return
        }
        case 'join': {
          const game = getGameByCode(message.code)
          const player = joinGame(game, { name: String(message.name ?? ''), role: message.role === 'master' ? 'master' : 'player', token: message.token })
          sendMessage(peer, { type: 'joined', playerId: player.id, token: player.token })
          subscribe({ peer, gameId: game.id, kind: 'player', playerId: player.id }, game)
          return
        }
      }

      const subscriber = getSubscriber(peer)
      if (subscriber?.kind !== 'player' || !subscriber.playerId) {
        return sendMessage(peer, { type: 'error', message: 'Rejoins d\'abord une partie' })
      }
      const game = getGame(subscriber.gameId)
      switch (message.type) {
        case 'buzz':
          return buzz(game, subscriber.playerId)
        case 'answer':
          return answerBuzz(game, subscriber.playerId, String(message.text ?? '').slice(0, MAX_ANSWER_LENGTH))
        case 'judge':
          return judgeBuzz(game, subscriber.playerId, { title: !!message.found?.title, artist: !!message.found?.artist })
      }
    }
    catch (error) {
      const fatal = message.type === 'join' || message.type === 'host'
      sendMessage(peer, { type: 'error', message: errorMessage(error), fatal })
    }
  },

  close(peer) {
    const subscriber = unsubscribe(peer)
    if (subscriber?.kind !== 'player' || !subscriber.playerId) return
    try {
      setPlayerConnected(getGame(subscriber.gameId), subscriber.playerId, false)
    }
    catch {
      // Partie expirée entre-temps.
    }
  },
})
