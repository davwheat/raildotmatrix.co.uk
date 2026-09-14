export interface Board {
  name: string
  path: string
  /** The element the baseline is cropped to, so board chrome and the settings panel stay out of the image. */
  selector: string
}

export const BOARDS: Board[] = [
  { name: 'infotec-landscape-dmi', path: '/board/infotec-landscape-dmi', selector: 'article.dot-matrix' },
  { name: 'daktronics-data-display-dmi', path: '/board/daktronics-data-display-dmi', selector: '.ZoomDivContainer > div' },
  { name: 'blackbox-landscape-lcd', path: '/board/blackbox-landscape-lcd', selector: 'article.tfwm-board' },
]

/** Wide enough for the largest board at its natural size, since the capture cancels the zoom-to-fit scaling. */
export const VIEWPORT = { width: 2500, height: 1000 }

/**
 * Runs before any page script. Boards read the clock directly and repaint on an interval, so both are pinned: the
 * frozen date fixes every rendered time, and dropping intervals stops row carousels advancing mid-capture.
 */
export function freezeScript(frozenClock: number): string {
  return `
    (() => {
      const RealDate = Date
      function FrozenDate(...args) {
        return args.length === 0 ? new RealDate(${frozenClock}) : new RealDate(...args)
      }
      FrozenDate.prototype = RealDate.prototype
      FrozenDate.now = () => ${frozenClock}
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
 * Pins every animation once the board has settled. CSS alone cannot do this: animation-delay shifts an animation
 * relative to whenever it happened to start, so a looping one lands on an arbitrary frame. Removing animations
 * outright is no better, because several boards advance their own state on animationend.
 *
 * A finite animation is therefore held on its final frame, which is the state the board was heading for anyway. A
 * looping one is dropped so its element falls back to its own styles, which is both stable and the frame that shows
 * the most: parking a flashing cancellation mid-blink would let the text disappear from the baseline entirely.
 */
export const PIN_ANIMATIONS = `
  (() => {
    for (const animation of document.getAnimations()) {
      const endTime = Number(animation.effect?.getComputedTiming?.().endTime)
      if (Number.isFinite(endTime)) {
        animation.currentTime = endTime
        animation.pause()
      } else {
        animation.cancel()
      }
    }
  })()
`
