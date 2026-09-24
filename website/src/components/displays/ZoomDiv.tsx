import React from 'react'

import { useEffect, useRef } from 'react'

function fillDiv(div: HTMLDivElement) {
  const currentWidth = div.offsetWidth
  const currentHeight = div.offsetHeight

  if (!currentWidth || !currentHeight) return

  const availableHeight = window.innerHeight
  const availableWidth = window.innerWidth

  const scale = Math.min(availableWidth / currentWidth, availableHeight / currentHeight)

  div.style.cssText = `
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform: scale(${scale}) translateZ(0);
    transform-origin: 50% 50%;
  `
}

export function ZoomDiv({ children }: { children: React.ReactNode }) {
  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const div = boardRef.current
    if (!div) return
    let pending = 0
    const scale = () => {
      cancelAnimationFrame(pending)
      pending = requestAnimationFrame(() => fillDiv(div))
    }
    const observer = new ResizeObserver(scale)
    observer.observe(div)
    window.addEventListener('resize', scale)
    scale()

    return () => {
      cancelAnimationFrame(pending)
      observer.disconnect()
      window.removeEventListener('resize', scale)
    }
  }, [])

  return (
    <div ref={boardRef} className="ZoomDivContainer">
      {children}
    </div>
  )
}
