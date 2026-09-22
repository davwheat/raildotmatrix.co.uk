export interface Board {
  name: string
  path: string
  /** The element the baseline is cropped to, so board chrome and the settings panel stay out of the image. */
  selector: string
  /**
   * How far the frozen clock runs before the capture, in milliseconds. The LED boards animate by the time the page
   * gives them rather than with CSS, so a stopped clock holds them on the first frame of their entrance. A state can
   * set its own time, to catch a screen that the board has left by the default.
   */
  runClock?: { ms: number; states?: Record<string, number> }
  /**
   * The fixtures to capture, when not all of them. The LED boards are drawn by the Go program in led-board, whose own
   * golden images cover every fixture and option at both sizes, so here they only prove that the WebAssembly build
   * reaches the page.
   */
  states?: string[]
}

export const BOARDS: Board[] = [
  {
    name: 'infotec-landscape-dmi',
    path: '/board/infotec-landscape-dmi',
    selector: '.ZoomDivContainer > div',
    runClock: { ms: 4_600 },
    states: ['busy-board'],
  },
  {
    name: 'daktronics-data-display-dmi',
    path: '/board/daktronics-data-display-dmi',
    selector: '.ZoomDivContainer > div',
    runClock: { ms: 8_600 },
    states: ['busy-board'],
  },
  { name: 'blackbox-landscape-lcd', path: '/board/blackbox-landscape-lcd', selector: 'article.tfwm-board' },
]

/** Wide enough for the largest board at its natural size, since the capture cancels the zoom-to-fit scaling. */
export const VIEWPORT = { width: 2500, height: 1000 }

/**
 * Runs before any page script. Boards read the clock directly and repaint on an interval, so both are pinned: the
 * frozen date fixes every rendered time, and dropping intervals stops row carousels advancing mid-capture.
 *
 * The clock moves only when the capture calls `__runClock`, which plays a board that animates by the clock up to a
 * chosen frame. It moves one fixed step per animation frame rather than jumping: a board times some animations from
 * the frame in which it notices a change, so it has to see the time pass to end up where it would in real life.
 */
export function freezeScript(frozenClock: number): string {
  return `
    (() => {
      const RealDate = Date
      const STEP = 50
      let now = ${frozenClock}
      window.__runClock = ms =>
        new Promise(resolve => {
          const end = now + ms
          const step = () => {
            if (now >= end) return resolve()
            now = Math.min(end, now + STEP)
            requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        })
      function FrozenDate(...args) {
        return args.length === 0 ? new RealDate(now) : new RealDate(...args)
      }
      FrozenDate.prototype = RealDate.prototype
      FrozenDate.now = () => now
      FrozenDate.parse = RealDate.parse
      FrozenDate.UTC = RealDate.UTC
      window.Date = FrozenDate
      window.setInterval = () => 0
    })()
  `
}

/**
 * Applied once the board has settled. Transitions are removed rather than waited out, scrolling text is returned to
 * its resting position by neutralising the custom properties its timeout chain writes, and zoom-to-fit is cancelled
 * so baselines sit at the board's own resolution rather than one derived from the viewport.
 */
export const FREEZE_STYLES = `
  *, *::before, *::after {
    transition: none !important;
    --trans-x: 0px !important;
    --trans-y: 0px !important;
    --transition-time: 0s !important;
    --opacity: 1 !important;
  }

  .ZoomDivContainer {
    transform: none !important;
  }
`

/**
 * An animation with no frame the board is heading towards: one that loops, or blinks a fixed number of times before
 * the board moves on. Parking either on a frame of its own would let the text disappear from the baseline entirely,
 * and a platform alteration blinks for six seconds and is then gone, which is far too short to wait out.
 */
export const BLINKING_ANIMATION = `(animation => {
  const timing = animation.effect?.getComputedTiming?.()
  return !timing || !Number.isFinite(Number(timing.endTime)) || Number(timing.iterations) > 1
})`

/**
 * Pins every animation once the board has settled. CSS alone cannot do this: animation-delay shifts an animation
 * relative to whenever it happened to start, so a looping one lands on an arbitrary frame. Removing animations
 * outright is no better, because several boards advance their own state on animationend.
 *
 * An animation that plays once is therefore held on its final frame, which is the state the board was heading for
 * anyway. A blink is dropped instead, so its element falls back to its own styles: that is both stable and the frame
 * that shows the most, and it leaves the board on the screen the blink belongs to, because cancelling an animation
 * never fires the animationend the board would advance on.
 */
export const PIN_ANIMATIONS = `
  (() => {
    const blinks = ${BLINKING_ANIMATION}
    for (const animation of document.getAnimations()) {
      if (blinks(animation)) {
        animation.cancel()
      } else {
        animation.currentTime = Number(animation.effect.getComputedTiming().endTime)
        animation.pause()
      }
    }
  })()
`
