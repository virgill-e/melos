/** Compte à rebours en secondes, suspendable, calé sur requestAnimationFrame. */
export function useCountdown(onEnd: () => void = () => {}) {
  const remaining = ref(0)
  let frame = 0
  let endsAt = 0

  function tick(now: number) {
    remaining.value = Math.max(0, (endsAt - now) / 1000)
    if (remaining.value <= 0) return onEnd()
    frame = requestAnimationFrame(tick)
  }

  function start(seconds: number) {
    cancelAnimationFrame(frame)
    remaining.value = seconds
    endsAt = performance.now() + seconds * 1000
    frame = requestAnimationFrame(tick)
  }

  function pause() {
    cancelAnimationFrame(frame)
  }

  function resume() {
    if (remaining.value > 0) start(remaining.value)
  }

  function reset(seconds: number) {
    cancelAnimationFrame(frame)
    remaining.value = seconds
  }

  onBeforeUnmount(pause)

  return { remaining, start, pause, resume, reset }
}
