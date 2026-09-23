import React from 'react'

import { useBoardOptions } from '../../BoardOptions/context'
import LedBoard from '../LedBoard'
import { ZoomDiv } from '../ZoomDiv'

import { useDataSource } from '../../../live/source'

import BoardAsset from './board-outline.inline.svg'
import boardFill from './board-fill.svg'

interface IProps {
  station: string
  editBoardUrl: string
}

const BoardStyles = {
  Yellow: {
    '--casing-color': '#db9426',
  },
  Blue: {
    '--casing-color': '#11185a',
  },
  'Green/Blue': {
    '--casing-color': '#1b4b47',
  },
} as const

// The web board's layout from before it drew with the Go boards, in px, which the casing SVGs are drawn around: a
// 2250 × 450 board with its text 32 px from the top, drawn in the 40 / 3.5 px dots of its 40 px font.
const DOT = 40 / 3.5
const COLUMNS = 193
const ROWS = 36
const BOARD = { width: 2250, height: 450, top: 32 }
const CASING = { sides: 78, top: 74, bottom: 94 }

const percent = (length: number, of: number) => `${(100 * length) / of}%`

/**
 * The face behind each of the three rows of departures, which the real board's LED modules are mounted on. Rows are 9
 * dots tall, and a face stops 2 dots short of the next row, as the old board's did by 20 px.
 */
const ROW_FACES = [0, 1, 2].map(row => [row * 9, row * 9 + 7])

const faceBackground = `linear-gradient(to bottom, ${ROW_FACES.map(
  ([top, bottom]) =>
    `transparent ${percent(top, ROWS)}, var(--dmi-row-background) ${percent(top, ROWS)} ${percent(bottom, ROWS)}, transparent ${percent(bottom, ROWS)}`,
).join(', ')}), var(--dmi-background)`

export default function DaktronicsDataDisplay({ station, editBoardUrl }: IProps) {
  let searchParams: URLSearchParams | null = null
  if (typeof window !== 'undefined') {
    searchParams = window && new URLSearchParams(window.location.search)
  }

  const { options: customBoardSettings } = useBoardOptions()
  const { baseUrl } = useDataSource()

  const platforms = searchParams?.getAll('platform')
  const { showCasing } = customBoardSettings

  const frame = showCasing
    ? { width: BOARD.width + 2 * CASING.sides, height: BOARD.height + CASING.top + CASING.bottom, left: CASING.sides, top: CASING.top }
    : { width: BOARD.width, height: BOARD.height, left: 0, top: 0 }
  const canvasWidth = COLUMNS * DOT

  return (
    <>
      <ZoomDiv>
        <div
          css={[
            {
              position: 'relative',
              width: `min(100vw, ${(100 * frame.width) / frame.height}vh)`,
              aspectRatio: `${frame.width} / ${frame.height}`,
            },
            !showCasing && { background: 'var(--dmi-background, #000)' },
            BoardStyles[customBoardSettings.boardStyle],
            customBoardSettings.withBackground && {
              '--dmi-row-background': '#35241a',
              '--dmi-background': '#0c0806',
              '--led-board-background': faceBackground,
            },
          ]}
        >
          {showCasing && (
            <div
              css={{
                position: 'absolute',
                inset: 0,
                background: 'var(--dmi-background, #000)',
                maskImage: `url(${boardFill})`,
                maskSize: '100% 100%',
              }}
            />
          )}

          <LedBoard
            css={{
              position: 'absolute',
              left: percent(frame.left + (BOARD.width - canvasWidth) / 2, frame.width),
              top: percent(frame.top + BOARD.top, frame.height),
              width: percent(canvasWidth, frame.width),
            }}
            columns={COLUMNS}
            rows={ROWS}
            board="daktronics"
            crs={station}
            url={baseUrl}
            platforms={platforms}
            showUnconfirmedPlatforms={customBoardSettings.showUnconfirmedPlatforms}
            legacyTocNames={customBoardSettings.useLegacyTocNames}
            worldline={customBoardSettings.worldlinePowered}
            rowPrefix={customBoardSettings.rowPrefix}
            ordinalFormat={customBoardSettings.ordinalFormat}
            warningPlatform={!!customBoardSettings.warningPlatform}
          />

          {showCasing && (
            <BoardAsset
              preserveAspectRatio="none"
              css={{ position: 'absolute', inset: 0, color: 'var(--casing-color)', pointerEvents: 'none' }}
            />
          )}
        </div>
      </ZoomDiv>
    </>
  )
}
