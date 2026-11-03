import type { Game } from './games'

// Diffusion de l'état des parties aux écrans connectés en WebSocket : l'écran principal reçoit
// la vue hôte, chaque téléphone sa vue personnalisée.

interface PeerLike {
  id: string
  send: (data: string) => unknown
}

interface Subscriber {
  peer: PeerLike
  gameId: string
  kind: 'host' | 'player'
  playerId?: string
}

const subscribers = new Map<string, Subscriber>()

export function sendMessage(peer: PeerLike, message: ServerMessage) {
  peer.send(JSON.stringify(message))
}

function sendState(subscriber: Subscriber, game: Game) {
  if (subscriber.kind === 'host') sendMessage(subscriber.peer, { type: 'host-state', game: toPublicGame(game) })
  else sendMessage(subscriber.peer, { type: 'player-state', view: toPlayerView(game, subscriber.playerId!) })
}

export function subscribe(subscriber: Subscriber, game: Game) {
  subscribers.set(subscriber.peer.id, subscriber)
  sendState(subscriber, game)
}

export function unsubscribe(peer: PeerLike): Subscriber | undefined {
  const subscriber = subscribers.get(peer.id)
  subscribers.delete(peer.id)
  return subscriber
}

export function getSubscriber(peer: PeerLike): Subscriber | undefined {
  return subscribers.get(peer.id)
}

onGameChange((game) => {
  for (const subscriber of subscribers.values()) {
    if (subscriber.gameId === game.id) sendState(subscriber, game)
  }
})
