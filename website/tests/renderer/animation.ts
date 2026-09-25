import { animateBoard } from '../../src/components/displays/LedBoard/animation'

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

/** Exercise scheduling with independent monotonic timers and a correctable wall clock. */
export function verifyAnimation() {
  const original = {
    now: Date.now,
    intersection: window.IntersectionObserver,
    raf: window.requestAnimationFrame,
    cancel: window.cancelAnimationFrame,
    timeout: window.setTimeout,
    clear: window.clearTimeout,
    hidden: Object.getOwnPropertyDescriptor(document, 'hidden'),
  }
  let clock = 0,
    offset = 10_003,
    hidden = false,
    serial = 0,
    framesRun = 0
  const frames = new Map<number, FrameRequestCallback>()
  const timers = new Map<number, { callback: () => void; due: number }>()
  const disposers: (() => void)[] = []
  Date.now = () => clock + offset
  window.requestAnimationFrame = callback => {
    frames.set(++serial, callback)
    return serial
  }
  window.cancelAnimationFrame = id => {
    frames.delete(id)
  }
  window.setTimeout = ((callback: () => void, delay: number) => {
    timers.set(++serial, { callback, due: clock + delay })
    return serial
  }) as typeof window.setTimeout
  window.clearTimeout = id => {
    timers.delete(Number(id))
  }
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  const advance = (milliseconds: number, hz = 60) => {
    const end = clock + milliseconds
    while (clock < end) {
      clock = Math.min(end, clock + 1000 / hz)
      for (const [id, timer] of [...timers])
        if (timer.due <= clock) {
          timers.delete(id)
          timer.callback()
        }
      const pending = [...frames]
      frames.clear()
      for (const [, callback] of pending) {
        framesRun++
        callback(clock)
      }
    }
  }
  const visibility = (value: boolean) => {
    hidden = value
    document.dispatchEvent(new Event('visibilitychange'))
  }
  try {
    let cases = 0
    for (const hz of [30, 60, 90, 120, 144]) {
      let ticks = 0,
        paints = 0
      const handle = {
        width: 1,
        height: 1,
        pixels: new Uint8Array(3),
        nextTick: 0,
        onUpdate: null as (() => void) | null,
        tick(now: number) {
          ticks++
          this.nextTick = Math.floor(now / 1000) * 1000 + 1000
          return true
        },
        close() {},
      }
      const stop = animateBoard(
        handle,
        () => paints++,
        error => {
          throw error
        },
      )
      disposers.push(stop)
      const before = framesRun
      advance(10_000, hz)
      check(ticks >= 10 && ticks <= 11 && paints === ticks, `${hz} Hz: missed a clock deadline`)
      check(framesRun - before < 100, `${hz} Hz: static screen still polls every animation frame`)
      const previousTicks = ticks
      handle.nextTick = 0
      handle.onUpdate!()
      handle.onUpdate!()
      handle.onUpdate!()
      check(Number(frames.size) === 1 && Number(timers.size) === 0, 'feed notifications were not coalesced')
      advance(1000 / hz, hz)
      check(ticks === previousTicks + 1, 'feed did not wake promptly')
      visibility(true)
      handle.nextTick = 0
      handle.onUpdate!()
      check(Number(frames.size) === 0 && Number(timers.size) === 0, 'hidden screen scheduled work')
      advance(5000, hz)
      check(ticks === previousTicks + 1, 'hidden screen ticked')
      visibility(false)
      advance(1000 / hz, hz)
      check(ticks === previousTicks + 2, 'visible screen did not catch up')
      const beforeCorrection = ticks
      offset -= 10_000
      advance(1100, hz)
      check(ticks > beforeCorrection, 'backwards clock correction was postponed')
      stop()
      stop()
      check(handle.onUpdate === null && Number(frames.size) === 0 && Number(timers.size) === 0, 'dispose leaked callbacks')
      cases += 7
    }

    let intersect: (...values: boolean[]) => void = () => {
      throw new Error('Observer not created')
    }
    let disconnected = 0
    window.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = (...values) =>
          callback(
            values.map(isIntersecting => ({ isIntersecting }) as IntersectionObserverEntry),
            this as unknown as IntersectionObserver,
          )
      }
      observe() {}
      disconnect() {
        disconnected++
      }
    } as unknown as typeof IntersectionObserver
    let viewportTicks = 0
    const viewportHandle = {
      width: 1,
      height: 1,
      pixels: new Uint8Array(3),
      nextTick: 0,
      onUpdate: null as (() => void) | null,
      tick() {
        viewportTicks++
        return true
      },
      close() {},
    }
    const stopViewport = animateBoard(
      viewportHandle,
      () => {},
      error => {
        throw error
      },
      document.createElement('div'),
    )
    disposers.push(stopViewport)
    intersect(false)
    viewportHandle.onUpdate!()
    advance(1000)
    check(viewportTicks === 0 && frames.size === 0 && timers.size === 0, 'offscreen board scheduled work')
    intersect(true)
    advance(20)
    check(viewportTicks > 0, 'viewport entry did not resume drawing')
    const visibleTicks = viewportTicks
    visibility(true)
    intersect(false)
    intersect(true)
    advance(1000)
    check(viewportTicks === visibleTicks && frames.size === 0, 'viewport observer woke a hidden page')
    intersect(false)
    visibility(false)
    advance(1000)
    check(viewportTicks === visibleTicks && frames.size === 0, 'visible document woke an offscreen board')
    intersect(true)
    advance(20)
    check(viewportTicks > visibleTicks, 'returning board did not catch up')
    const beforeBatch = viewportTicks
    intersect(true, false)
    advance(1000)
    check(viewportTicks === beforeBatch && frames.size === 0, 'batched exit used a stale visible entry')
    intersect(false, true)
    advance(20)
    check(viewportTicks > beforeBatch, 'batched entry used a stale offscreen entry')
    const beforeEmpty = viewportTicks
    intersect()
    advance(20)
    check(viewportTicks > beforeEmpty, 'empty observer delivery stopped animation')
    cases += 3
    stopViewport()
    const stoppedTicks = viewportTicks
    intersect(false)
    intersect(true)
    advance(1000)
    check(viewportTicks === stoppedTicks && disconnected === 1 && frames.size === 0 && timers.size === 0, 'viewport disposal leaked work')
    cases += 6
    const legacyViewport = {
      width: 1,
      height: 1,
      pixels: new Uint8Array(3),
      tick() {
        viewportTicks++
        return false
      },
      close() {},
    }
    const stopLegacyViewport = animateBoard(
      legacyViewport,
      () => {},
      error => {
        throw error
      },
      document.createElement('div'),
    )
    disposers.push(stopLegacyViewport)
    const legacyTicks = viewportTicks
    intersect(false)
    advance(1000)
    check(viewportTicks === legacyTicks, 'older bundle polled offscreen')
    intersect(true)
    advance(1000)
    check(viewportTicks >= legacyTicks + 59, 'older bundle did not resume polling')
    stopLegacyViewport()
    cases++
    window.IntersectionObserver = undefined as unknown as typeof IntersectionObserver
    const beforeFallback = viewportTicks
    const stopUnsupported = animateBoard(
      legacyViewport,
      () => {},
      error => {
        throw error
      },
      document.createElement('div'),
    )
    disposers.push(stopUnsupported)
    advance(1000)
    check(viewportTicks >= beforeFallback + 59, 'missing IntersectionObserver stopped the board')
    stopUnsupported()
    cases++
    window.IntersectionObserver = original.intersection

    // A mixed-version deployment must keep polling an older WASM bundle.
    const old = { width: 1, height: 1, pixels: new Uint8Array(3), nextTick: Date.now() + 60_000, tick: () => false, close() {} }
    const stopOld = animateBoard(
      old,
      () => {},
      error => {
        throw error
      },
    )
    disposers.push(stopOld)
    const before = framesRun
    advance(1000)
    check(framesRun - before >= 59, 'older bundle lost its polling fallback')
    stopOld()
    cases++

    let failures = 0
    const broken = {
      ...old,
      nextTick: 0,
      onUpdate: null as (() => void) | null,
      tick() {
        throw new Error('test failure')
      },
    }
    disposers.push(
      animateBoard(
        broken,
        () => {},
        () => failures++,
      ),
    )
    advance(1000)
    check(failures === 1 && Number(frames.size) === 0 && Number(timers.size) === 0 && broken.onUpdate === null, 'failed animation kept running')
    cases++
    return `${cases} animation scheduling checks passed.`
  } finally {
    disposers.forEach(stop => stop())
    window.IntersectionObserver = original.intersection
    Date.now = original.now
    window.requestAnimationFrame = original.raf
    window.cancelAnimationFrame = original.cancel
    window.setTimeout = original.timeout
    window.clearTimeout = original.clear
    if (original.hidden) Object.defineProperty(document, 'hidden', original.hidden)
    else delete (document as unknown as { hidden?: boolean }).hidden
  }
}
