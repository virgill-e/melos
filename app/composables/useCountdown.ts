/** Compte à rebours en secondes, suspendable, calé sur requestAnimationFrame. */
export function useCountdown(onEnd: () => void = () => {}) {
  const remaining = ref(0)
  let frame = 0
  let endsAt = 0

  // `reset` peut être appelé pendant le rendu serveur, où requestAnimationFrame n'existe pas :
  // on n'annule une frame que si on en a réellement programmé une (donc côté navigateur).
  function cancelFrame() {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  function tick(now: number) {
    remaining.value = Math.max(0, (endsAt - now) / 1000)
    if (remaining.value <= 0) {
      frame = 0
      return onEnd()
    }
    frame = requestAnimationFrame(tick)
  }

  function start(seconds: number) {
    cancelFrame()
    remaining.value = seconds
    endsAt = performance.now() + seconds * 1000
    frame = requestAnimationFrame(tick)
  }

  function pause() {
    cancelFrame()
  }

  function resume() {
    if (remaining.value > 0) start(remaining.value)
  }

  function reset(seconds: number) {
    cancelFrame()
    remaining.value = seconds
  }

  onBeforeUnmount(pause)

  return { remaining, start, pause, resume, reset }
}
