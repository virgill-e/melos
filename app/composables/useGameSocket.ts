const MAX_RETRY_DELAY_MS = 5_000

/**
 * Connexion WebSocket au serveur local, avec reconnexion automatique (téléphone mis en veille,
 * Wi-Fi qui décroche). `onOpen` est rappelé à chaque reconnexion pour se réidentifier.
 */
export function useGameSocket(handlers: { onOpen: () => void, onMessage: (message: ServerMessage) => void }) {
  const status = ref<'connecting' | 'open' | 'closed'>('connecting')
  let socket: WebSocket | null = null
  let retries = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  function connect() {
    clearTimeout(retryTimer)
    status.value = 'connecting'
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/_ws`)
    socket.onopen = () => {
      status.value = 'open'
      retries = 0
      handlers.onOpen()
    }
    socket.onmessage = event => handlers.onMessage(JSON.parse(event.data))
    socket.onclose = () => {
      status.value = 'closed'
      if (!stopped) retryTimer = setTimeout(connect, Math.min(MAX_RETRY_DELAY_MS, 500 * 2 ** retries++))
    }
  }

  function send(message: ClientMessage) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }

  // Au réveil du téléphone, on n'attend pas la prochaine tentative programmée.
  function onVisible() {
    if (document.visibilityState === 'visible' && socket?.readyState === WebSocket.CLOSED) connect()
  }

  onMounted(() => {
    connect()
    document.addEventListener('visibilitychange', onVisible)
  })
  onBeforeUnmount(() => {
    stopped = true
    clearTimeout(retryTimer)
    document.removeEventListener('visibilitychange', onVisible)
    socket?.close()
  })

  return { status, send }
}
