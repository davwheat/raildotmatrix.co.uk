import type { LedBoardHandle } from './loadLedBoard'

/** Sleep between known board deadlines; feed updates wake the next animation frame. */
export function animateBoard(handle: LedBoardHandle, paint: (pixels: Uint8Array) => void, fail: (error: unknown) => void, surface?: Element) {
  const notifications = 'onUpdate' in handle
  let frame = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let previousTime = 0
  let inViewport = true
  const observer =
    surface && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(
          entries => {
            // One surface is observed; use its latest state if delivery batches transitions.
            const entry = entries[entries.length - 1]
            if (stopped || !entry || entry.isIntersecting === inViewport) return
            inViewport = entry.isIntersecting
            visibilityChanged()
          },
          { rootMargin: '128px' },
        )
      : undefined

  function cancel() {
    cancelAnimationFrame(frame)
    frame = 0
    clearTimeout(timer)
    timer = undefined
  }

  function wake() {
    if (stopped) return
    clearTimeout(timer)
    timer = undefined
    if (!document.hidden && inViewport && !frame) frame = requestAnimationFrame(draw)
  }

  function draw() {
    frame = 0
    if (stopped || document.hidden || !inViewport) return
    try {
      const now = Date.now()
      const due = handle.nextTick
      if ((!due || now >= due || now < previousTime) && handle.tick(now)) paint(handle.pixels)
      previousTime = now
      const remaining = (handle.nextTick ?? 0) - Date.now()
      if (notifications && remaining > 34) {
        // Wake before the deadline so the next display refresh can present it.
        // Check at least once a second for wall-clock corrections.
        timer = setTimeout(wake, Math.min(1000, remaining - 34))
      } else {
        frame = requestAnimationFrame(draw)
      }
    } catch (error) {
      stop()
      fail(error)
    }
  }

  function visibilityChanged() {
    cancel()
    wake()
  }

  function stop() {
    if (stopped) return
    stopped = true
    observer?.disconnect()
    cancel()
    document.removeEventListener('visibilitychange', visibilityChanged)
    if (notifications && handle.onUpdate === wake) handle.onUpdate = null
  }

  if (notifications) handle.onUpdate = wake
  document.addEventListener('visibilitychange', visibilityChanged)
  if (surface) observer?.observe(surface)
  wake()
  return stop
}
