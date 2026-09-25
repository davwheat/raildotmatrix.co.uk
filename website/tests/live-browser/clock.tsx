import React from 'react'
import { createRoot } from 'react-dom/client'
import useClock from '../../src/hooks/useClock'

const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

export async function verifyClock() {
  const originalNow = Date.now
  const originalTimeout = window.setTimeout
  const originalClear = window.clearTimeout
  const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden')
  let now = 10_123
  let hidden = false
  let serial = 0
  const timers = new Map<number, { callback: () => void; delay: number }>()
  Date.now = () => now
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  window.setTimeout = ((callback: () => void, delay: number) => {
    timers.set(++serial, { callback, delay })
    return serial
  }) as typeof window.setTimeout
  window.clearTimeout = id => {
    timers.delete(Number(id))
  }
  const element = document.body.appendChild(document.createElement('div'))
  const root = createRoot(element)
  let renders = 0
  let value = -1
  function Probe({ resolution }: { resolution: 1000 | 60000 }) {
    value = useClock(resolution).getTime()
    renders++
    return null
  }
  try {
    root.render(<Probe resolution={60000} />)
    await settle()
    check(value === 0 && timers.size === 1, 'minute clock did not initialise one timer')
    check([...timers.values()][0].delay === 49_877, 'minute timer is not boundary aligned')
    const initialRenders = renders
    now += 1000
    window.dispatchEvent(new Event('pageshow'))
    await settle()
    check(renders === initialRenders, 'minute clock rerendered within the same minute')
    now = 60_000
    ;[...timers.values()][0].callback()
    await settle()
    check(Number(value) === 60_000, 'minute clock missed its boundary')
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    check(Number(timers.size) === 0, 'hidden clock retained a timer')
    now = 180_123
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    check(Number(value) === 180_000 && Number(timers.size) === 1, 'resume left a stale minute')
    now = 15_123
    window.dispatchEvent(new Event('pageshow'))
    await settle()
    check(Number(value) === 0, 'backwards wall-clock adjustment was ignored')
    root.render(<Probe resolution={1000} />)
    await settle()
    check(Number(value) === 15_000 && [...timers.values()][0].delay === 877, 'second clock lost precision')
  } finally {
    root.unmount()
    element.remove()
    const remaining = timers.size
    Date.now = originalNow
    window.setTimeout = originalTimeout
    window.clearTimeout = originalClear
    if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden)
    else Reflect.deleteProperty(document, 'hidden')
    check(remaining === 0, 'unmount retained a clock timer')
  }
}
