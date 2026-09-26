import React, { useEffect, useRef, useState } from 'react'

import { createDotPainter, type DotPainter } from './DotPainter'
import { animateBoard } from './animation'
import { MIN_DOT_PITCH } from './dotMask'
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
  hideTerminating,
  legacyTocNames,
  worldline,
  rowPrefix,
  ordinalFormat,
  serviceCount,
  clockStyle,
  loadingBrightness,
  formationCount,
  formationIcons,
  coachLetterTocs,
  warningPlatform,
  platformBox,
  compactLowerRow,
  smallScrollingText,
  alignPlatformRows,
  colour,
}: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null)
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
    hideTerminating,
    legacyTocNames,
    worldline,
    rowPrefix,
    ordinalFormat,
    serviceCount,
    clockStyle,
    loadingBrightness,
    formationCount,
    formationIcons,
    coachLetterTocs,
    warningPlatform,
    platformBox,
    compactLowerRow,
    smallScrollingText,
    alignPlatformRows,
    colour,
  })

  useEffect(() => {
    const surface = surfaceRef.current!
    const painter = createDotPainter(columns, rows)
    surface.appendChild(painter.canvas)
    const observer = observeDevicePixelSize(surface, (width, height, cssPerDevicePixel) =>
      fitCanvas(painter, columns, rows, width, height, cssPerDevicePixel),
    )
    let handle: LedBoardHandle | undefined
    let stopAnimation: (() => void) | undefined
    let stopped = false

    function fail(error: unknown) {
      if (stopped) return
      console.error('The departure board failed', error)
      setStatus('failed')
    }

    setStatus('loading')
    loadLedBoard()
      .then(api => {
        if (stopped) return
        const created = api.create({ ...JSON.parse(key), width: columns, height: rows })
        if (created instanceof Error) throw created
        handle = created
        setStatus('running')
        stopAnimation = animateBoard(handle, pixels => painter.paint(pixels), fail, surface)
      })
      .catch(fail)

    return () => {
      stopped = true
      stopAnimation?.()
      observer.disconnect()
      handle?.close()
      painter.dispose()
      painter.canvas.remove()
    }
  }, [key])

  return (
    <div className={className} css={{ position: 'relative' }} aria-busy={status === 'loading'}>
      <div
        ref={surfaceRef}
        css={{
          width: '100%',
          aspectRatio: `${columns} / ${rows}`,
          background: 'var(--led-board-background, #000)',
          position: 'relative',
          '& canvas': { display: 'block', position: 'absolute' },
        }}
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

/**
 * Sizes the canvas to a whole number of device pixels per dot, centred in the surface. A fractional pitch would make
 * some cells a pixel wider than others, which shows as a wider gap between dots at a regular interval.
 */
function fitCanvas(painter: DotPainter, columns: number, rows: number, width: number, height: number, cssPerDevicePixel: number) {
  const pitch = Math.floor(Math.min(width / columns, height / rows))
  // Below this pitch the board is drawn as square pixels, so snapping would only shrink it.
  const snap = pitch >= MIN_DOT_PITCH
  const canvasWidth = snap ? columns * pitch : width
  const canvasHeight = snap ? rows * pitch : height
  // Whole device-pixel offsets keep the canvas on the device grid, where it isn't resampled.
  const left = Math.floor((width - canvasWidth) / 2)
  const top = Math.floor((height - canvasHeight) / 2)

  const { style } = painter.canvas
  style.left = `${left * cssPerDevicePixel}px`
  style.top = `${top * cssPerDevicePixel}px`
  style.width = `${canvasWidth * cssPerDevicePixel}px`
  style.height = `${canvasHeight * cssPerDevicePixel}px`
  painter.resize(canvasWidth, canvasHeight)
}

function observeDevicePixelSize(
  element: HTMLElement,
  onResize: (width: number, height: number, cssPerDevicePixel: number) => void,
): ResizeObserver {
  const observer = new ResizeObserver(([entry]) => {
    const device = entry.devicePixelContentBoxSize?.[0]
    if (device && device.inlineSize > 0) {
      onResize(device.inlineSize, device.blockSize, entry.contentRect.width / device.inlineSize)
    } else {
      onResize(
        Math.round(entry.contentRect.width * devicePixelRatio),
        Math.round(entry.contentRect.height * devicePixelRatio),
        1 / devicePixelRatio,
      )
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
