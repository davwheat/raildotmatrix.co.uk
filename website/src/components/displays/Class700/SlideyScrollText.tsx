import React, { useEffect, useRef } from 'react'

import clsx from 'clsx'
import { observeScrollContent } from '../observeScrollContent'

interface IProps {
  children: React.ReactNode
  className?: string
  classNameInner?: string
  pauseWhenDone?: false | number
  scrollSpeed?: number
}

function SlideyScrollText({ children, className, classNameInner, pauseWhenDone = 5000, scrollSpeed = 150 }: IProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const outer = outerRef.current!
    const inner = innerRef.current!
    let widths = { outer: 0, inner: 0, prefix: 0 }
    let step: 'pause-left' | 'scrolling' | 'pause-right' = 'pause-left'
    let timer: number | undefined
    const schedule = (callback: () => void, delay: number) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(callback, delay)
    }
    const startScroll = () => {
      step = 'scrolling'
      inner.style.setProperty('--transition-time', `${(widths.inner + widths.outer) / scrollSpeed}s`)
      inner.style.setProperty('--trans-x', `-${widths.inner}px`)
    }
    const transitionEnd = (event: TransitionEvent) => {
      if (event.target !== inner || event.propertyName !== 'transform') return
      if (step === 'pause-left') {
        schedule(startScroll, pauseWhenDone || 0)
      } else if (step === 'scrolling') {
        step = 'pause-right'
        schedule(() => {
          step = 'pause-left'
          inner.style.setProperty('--transition-time', '0.001ms')
          inner.style.setProperty('--trans-x', `${widths.outer}px`)
        }, 1000)
      }
    }
    const stopObserving = observeScrollContent(outer, inner, null, measured => {
      widths = measured
      window.clearTimeout(timer)
      inner.removeEventListener('transitionend', transitionEnd)
      inner.style.removeProperty('--transition-time')
      step = 'pause-left'
      if (widths.inner > widths.outer) {
        inner.style.setProperty('--trans-x', `${widths.outer}px`)
        schedule(startScroll, 1000)
        inner.addEventListener('transitionend', transitionEnd)
      } else {
        inner.style.setProperty('--trans-x', '0')
      }
    })
    return () => {
      stopObserving()
      window.clearTimeout(timer)
      inner.removeEventListener('transitionend', transitionEnd)
    }
  }, [pauseWhenDone, scrollSpeed])

  return (
    <div className={clsx('slidey-scroll-text', className)} ref={outerRef}>
      <span className={clsx('slidey-scroll-text-inner', classNameInner)} ref={innerRef}>
        {children}
      </span>
    </div>
  )
}

export default React.memo(SlideyScrollText)
