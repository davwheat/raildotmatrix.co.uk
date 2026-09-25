import React, { useEffect, useRef } from 'react'

import { observeScrollContent } from '../observeScrollContent'

interface IProps {
  children: React.ReactNode
  className?: string
  classNameInner?: string
  pauseWhenDone?: false | number
  /**
   * The speed at which the text should scroll in pixels per second.
   */
  scrollSpeed?: number
  alwaysScroll?: boolean
  /**
   * @returns `true` if the animation should be stopped, `false` otherwise.
   */
  onComplete?: () => boolean
  /**
   * @param willScroll `true` if the text will scroll, `false` otherwise.
   */
  onStart?: (willScroll: boolean) => void
  /**
   * The number of milliseconds to wait before calling `onComplete` if the text is not scrolling.
   */
  callCompleteIfNotScrolling?: number
  /**
   * The text to prefix to the text and to slide down before scrolling.
   */
  slideDownText?: string
  /**
   * The number of milliseconds to pause after sliding down the text.
   */
  slideDownPause?: number
  /**
   * The number of milliseconds the slide down animation should take.
   */
  slideDownTime?: number
}

function SlideyScrollText({
  children,
  className,
  classNameInner,
  pauseWhenDone = 750,
  scrollSpeed = 350,
  callCompleteIfNotScrolling = 5_000,
  onStart,
  onComplete,
  alwaysScroll = false,
  slideDownText = undefined,
  slideDownPause = 1_500,
  slideDownTime = 400,
}: IProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  const slideDownRef = useRef<HTMLSpanElement>(null)

  const callbacks = useRef({ onStart, onComplete })
  useEffect(() => {
    callbacks.current = { onStart, onComplete }
  })

  useEffect(() => {
    const outer = outerRef.current!
    const inner = innerRef.current!
    const slideDown = slideDownRef.current
    let widths = { outer: 0, inner: 0, prefix: 0 }
    let step: 'pause-left' | 'scrolling' | 'pause-right' | 'slide-down' = 'pause-left'
    let timer: number | undefined
    const schedule = (callback: () => void, delay: number) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(callback, delay)
    }
    const startScroll = () => {
      step = 'scrolling'
      inner.style.setProperty('--transition-time', `${(widths.inner + widths.outer - widths.prefix) / scrollSpeed}s`)
      inner.style.setProperty('--trans-x', `-${widths.inner}px`)
    }
    const startScrollOrSlideDown = () => {
      if (!slideDown) return startScroll()
      step = 'slide-down'
      schedule(() => {
        inner.style.setProperty('--trans-y', '0')
        inner.style.setProperty('--transition-time', `${slideDownTime}ms`)
      }, 0)
    }
    const transitionEnd = (event: TransitionEvent) => {
      if (event.target !== inner || event.propertyName !== 'transform') return
      if (step === 'pause-left') {
        if (!(callbacks.current.onComplete?.() ?? false)) schedule(startScrollOrSlideDown, pauseWhenDone || 0)
      } else if (step === 'scrolling') {
        step = 'pause-right'
        schedule(() => {
          step = 'pause-left'
          inner.style.setProperty('--transition-time', '0.001ms')
          inner.style.setProperty('--trans-x', `${widths.outer}px`)
        }, 1000)
      } else if (step === 'slide-down') {
        step = 'pause-right'
        schedule(startScroll, slideDownPause)
      }
    }
    const stopObserving = observeScrollContent(outer, inner, slideDown, measured => {
      widths = measured
      window.clearTimeout(timer)
      inner.removeEventListener('transitionend', transitionEnd)
      inner.style.removeProperty('--trans-y')
      inner.style.removeProperty('--transition-time')
      step = 'pause-left'
      const scrolling = alwaysScroll || widths.inner > widths.outer
      if (scrolling) {
        inner.style.setProperty('--trans-x', `${widths.outer - widths.prefix}px`)
        if (slideDown) inner.style.setProperty('--trans-y', '-100%')
        schedule(startScrollOrSlideDown, 1000)
        inner.addEventListener('transitionend', transitionEnd)
      } else {
        inner.style.setProperty('--trans-x', '0')
        schedule(() => callbacks.current.onComplete?.(), callCompleteIfNotScrolling)
      }
      callbacks.current.onStart?.(scrolling)
    })
    return () => {
      stopObserving()
      window.clearTimeout(timer)
      inner.removeEventListener('transitionend', transitionEnd)
    }
  }, [callCompleteIfNotScrolling, pauseWhenDone, scrollSpeed, alwaysScroll, slideDownText, slideDownPause, slideDownTime])

  return (
    <div
      className={className}
      ref={outerRef}
      css={{
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        className={classNameInner}
        ref={innerRef}
        css={{
          '--trans-x': '100%',
          '--opacity': 1,
          '--trans-y': '0',

          display: 'block',
          width: 'max-content',
          opacity: 'var(--opacity)',
          transform: 'translate(var(--trans-x), var(--trans-y))',
          transition: 'transform linear var(--transition-time, 0s), opacity linear 0.5s',
        }}
      >
        {slideDownText && (
          <span
            ref={slideDownRef}
            css={{
              display: 'inline-block',
              width: 'max-content',
              whiteSpace: 'preserve',
            }}
          >
            {slideDownText}
          </span>
        )}
        {children}
      </span>
    </div>
  )
}

export default React.memo(SlideyScrollText)
