import React from 'react'
import { createRoot } from 'react-dom/client'
import WestScroll from '../../src/components/displays/WestMidsLCD/SlideyScrollText'
import ClassScroll from '../../src/components/displays/Class700/SlideyScrollText'

const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame)
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

export async function verifyScroll() {
  const originalTimeout = window.setTimeout
  const originalClear = window.clearTimeout
  const originalStyle = window.getComputedStyle
  let reads = 0
  let serial = 0
  const timers = new Map<number, { callback: () => void; delay: number }>()
  window.setTimeout = ((callback: () => void, delay: number) => {
    timers.set(++serial, { callback, delay })
    return serial
  }) as typeof window.setTimeout
  window.clearTimeout = id => {
    timers.delete(Number(id))
  }
  window.getComputedStyle = (...args) => {
    reads++
    return originalStyle(...args)
  }
  const css = document.head.appendChild(document.createElement('style'))
  css.textContent =
    '.scroll-test{width:120px;overflow:hidden;white-space:nowrap}.scroll-test-inner{display:block;width:max-content;transition:none!important;font:20px monospace}'
  const results = []
  const fire = (delay: number) => {
    check(timers.size === 1, `expected one scroll timer, got ${timers.size}`)
    const [id, task] = [...timers][0]
    check(task.delay === delay, `expected ${delay} ms timer, got ${task.delay}`)
    timers.delete(id)
    task.callback()
  }
  try {
    for (const [name, Component] of [
      ['West Midlands', WestScroll],
      ['Class 700', ClassScroll],
    ] as const) {
      const element = document.body.appendChild(document.createElement('div'))
      const root = createRoot(element)
      let completed = 0
      let started = 0
      const render = (text: string, marker: number) =>
        root.render(
          <Component
            className="scroll-test"
            classNameInner="scroll-test-inner"
            onComplete={() => {
              completed = marker
              return false
            }}
            onStart={() => {
              started++
            }}
          >
            <span>{text}</span>
          </Component>,
        )
      try {
        render('A long destination name needing a scroll', 1)
        await settle()
        const outer = element.querySelector<HTMLElement>('.scroll-test')!
        const inner = element.querySelector<HTMLElement>('.scroll-test-inner')!
        const timer = [...timers.keys()][0]
        const initialReads = reads
        for (let i = 2; i <= 12; i++) {
          render('A long destination name needing a scroll', i)
          await settle()
        }
        check([...timers.keys()][0] === timer, `${name}: parent renders restarted scrolling`)
        check(reads === initialReads, `${name}: unchanged renders reread layout`)
        fire(1000)
        check(inner.style.getPropertyValue('--trans-x').startsWith('-'), `${name}: did not start scrolling`)
        inner.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' }))
        inner.firstElementChild!.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'transform', bubbles: true }))
        check(timers.size === 0, `${name}: unrelated transition scheduled a scroll phase`)
        inner.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'transform' }))
        fire(1000)
        inner.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'transform' }))
        if (name === 'West Midlands') check(completed === 12, 'West Midlands: stale completion callback')
        check(reads === initialReads, `${name}: animation phase reread layout`)
        results.push({ name, unchangedParentRenders: 11, layoutReadsDuringRendersAndScroll: reads - initialReads })

        render('A long destination name needing a stroll', 13) // Same width, new text.
        await settle()
        check([...timers.keys()][0] !== timer, `${name}: changed content was ignored`)
        fire(1000)
        outer.style.width = '5000px'
        await settle()
        check(inner.style.getPropertyValue('--trans-x') === '0', `${name}: resized text kept scrolling`)
        if (name === 'West Midlands') {
          fire(5000)
          check(Number(completed) === 13, 'West Midlands: stationary completion missed latest callback')
          check(started === 3, `West Midlands: unexpected starts (${started})`)
        } else check(timers.size === 0, 'Class 700: stationary text kept a timer')
        outer.style.width = '120px'
        await settle()
        check(Number(timers.size) === 1, `${name}: narrowing the display did not start scrolling`)

        // The board reuses one instance when the next departure changes, so its destination text is swapped in place.
        render('Penarth', 14)
        await settle()
        check(inner.style.getPropertyValue('--trans-x') === '0', `${name}: shorter replacement text kept scrolling`)
        if (name === 'West Midlands') fire(5000)
        else check(timers.size === 0, 'Class 700: shorter replacement text kept a timer')
        render('Manchester Piccadilly via Shrewsbury', 15)
        await settle()
        fire(1000)
        check(inner.style.getPropertyValue('--trans-x').startsWith('-'), `${name}: longer replacement text did not scroll`)
      } finally {
        root.unmount()
        element.remove()
        check(timers.size === 0, `${name}: unmount leaked a timer`)
      }
    }
    const element = document.body.appendChild(document.createElement('div'))
    const root = createRoot(element)
    try {
      root.render(
        <WestScroll className="scroll-test" classNameInner="scroll-test-inner" slideDownText="Calling at: " slideDownTime={777}>
          A long list of calling points
        </WestScroll>,
      )
      await settle()
      fire(1000)
      check(timers.size === 1 && [...timers.values()][0].delay === 0, 'slide-down timer was not scheduled')
      fire(0)
      const inner = element.querySelector<HTMLElement>('.scroll-test-inner')!
      check(inner.style.getPropertyValue('--transition-time') === '777ms', 'slide-down duration was ignored')
      inner.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'transform' }))
      fire(1500)
      check(inner.style.getPropertyValue('--trans-x').startsWith('-'), 'slide-down did not progress to scrolling')
      root.render(
        <WestScroll className="scroll-test" classNameInner="scroll-test-inner" slideDownText="Calling at: " slideDownTime={778}>
          A long list of calling points
        </WestScroll>,
      )
      await settle()
      fire(1000) // Unmount while the deferred slide-down is pending.
    } finally {
      root.unmount()
      element.remove()
      check(timers.size === 0, 'slide-down unmount leaked a timer')
    }
    return results
  } finally {
    window.setTimeout = originalTimeout
    window.clearTimeout = originalClear
    window.getComputedStyle = originalStyle
    css.remove()
  }
}
