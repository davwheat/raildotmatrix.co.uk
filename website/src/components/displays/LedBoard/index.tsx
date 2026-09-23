import React, { useEffect, useRef, useState } from 'react'

import { DotPainter } from './DotPainter'
import { loadLedBoard, type LedBoardHandle, type LedBoardOptions } from './loadLedBoard'

type Props = Omit<LedBoardOptions, 'width' | 'height'> & {
  className?: string
  /** The board's size in dots, which sets how big its text is against the board. */
  columns: number
  rows: number
}

/**
 * A departure board drawn by the WebAssembly build of the Go program in led-board, which also drives the physical LED
 * panel. It fills the width its parent gives it, at the aspect ratio of its dots.
 */
export default function LedBoard({
  className,
  columns,
  rows,
  board,
  crs,
  url,
  platforms,
  showUnconfirmedPlatforms,
  legacyTocNames,
  worldline,
  rowPrefix,
  warningPlatform,
  platformBox,
  alignPlatformRows,
  colour,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'running' | 'failed'>('loading')

  // A key rather than the options themselves, so that a parent passing an equal array every render doesn't restart
  // the board and its live stream.
  const key = JSON.stringify({
    columns,
    rows,
    board,
    crs,
    url,
    platforms,
    showUnconfirmedPlatforms,
    legacyTocNames,
    worldline,
    rowPrefix,
    warningPlatform,
    platformBox,
    alignPlatformRows,
    colour,
  })

  useEffect(() => {
    const canvas = canvasRef.current!
    const painter = new DotPainter(canvas, columns, rows)
    const observer = observeDevicePixelSize(canvas, (width, height) => painter.resize(width, height))
    let handle: LedBoardHandle | undefined
    let frame = 0
    let stopped = false

    function fail(error: unknown) {
      if (stopped) return
      console.error('The departure board failed', error)
      setStatus('failed')
    }

    function draw() {
      try {
        if (handle!.tick(Date.now())) painter.paint(handle!.pixels)
        frame = requestAnimationFrame(draw)
      } catch (error) {
        fail(error)
      }
    }

    setStatus('loading')
    loadLedBoard()
      .then(api => {
        if (stopped) return
        const created = api.create({ ...JSON.parse(key), width: columns, height: rows })
        if (created instanceof Error) throw created
        handle = created
        setStatus('running')
        draw()
      })
      .catch(fail)

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      handle?.close()
    }
  }, [key])

  return (
    <div className={className} css={{ position: 'relative' }} aria-busy={status === 'loading'}>
      <canvas
        ref={canvasRef}
        css={{ display: 'block', width: '100%', aspectRatio: `${columns} / ${rows}`, background: 'var(--led-board-background, #000)' }}
      />
      {status === 'failed' && (
        <p
          role="alert"
          css={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            textAlign: 'center',
            color: '#fff',
            fontSize: 'clamp(14px, 2vw, 24px)',
          }}
        >
          The departure board couldn't load. Check your connection, then reload the page.
        </p>
      )}
    </div>
  )
}

function observeDevicePixelSize(element: HTMLElement, onResize: (width: number, height: number) => void): ResizeObserver {
  const observer = new ResizeObserver(([entry]) => {
    const device = entry.devicePixelContentBoxSize?.[0]
    if (device) {
      onResize(device.inlineSize, device.blockSize)
    } else {
      onResize(Math.round(entry.contentRect.width * devicePixelRatio), Math.round(entry.contentRect.height * devicePixelRatio))
    }
  })

  try {
    observer.observe(element, { box: 'device-pixel-content-box' })
  } catch {
    // Safari can't report device pixels, so their count is estimated from CSS pixels, which can blur the dots slightly.
    observer.observe(element)
  }
  return observer
}
