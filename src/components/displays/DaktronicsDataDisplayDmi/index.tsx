import React from 'react'

import BoardSettings from '../../common/BoardSettings'
import LedBoard, { COLUMNS, ROWS } from '../LedBoard'
import { ZoomDiv } from '../ZoomDiv'

import useStateWithLocalStorage from '../../../hooks/useStateWithLocalStorage'
import { useDataSource } from '../../../live/source'

import BoardAsset from './board-outline.inline.svg'
import boardFill from './board-fill.svg'
import ToggleSwitch from '../../common/form/ToggleSwitch'
import { getDisabledPlatforms } from '../../../api/ProcessServices'

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

/** The casing SVGs are drawn in dots, with the board's top-left dot at this offset. */
const CASING_BORDER = 16
const CASING_WIDTH = COLUMNS + 2 * CASING_BORDER
const CASING_HEIGHT = ROWS + 2 * CASING_BORDER

const percent = (dots: number, of: number) => `${(100 * dots) / of}%`

/** The face behind each of the three rows of departures, which the real board's LED modules are mounted on. */
const ROW_FACES = [0, 1, 2].map(row => [row * 16 + 1, row * 16 + 14])

const faceBackground = `linear-gradient(to bottom, ${ROW_FACES.map(
  ([top, bottom]) =>
    `transparent ${percent(top, ROWS)}, var(--dmi-row-background) ${percent(top, ROWS)} ${percent(bottom, ROWS)}, transparent ${percent(bottom, ROWS)}`,
).join(', ')}), var(--dmi-background)`

interface IBoardSettings {
  boardStyle: keyof typeof BoardStyles
  showCasing: boolean
  worldlinePowered: boolean
  withBackground: boolean
}

export default function DaktronicsDataDisplay({ station, editBoardUrl }: IProps) {
  let searchParams: URLSearchParams | null = null
  if (typeof window !== 'undefined') {
    searchParams = window && new URLSearchParams(window.location.search)
  }

  const [customBoardSettings, setCustomBoardSettings] = useStateWithLocalStorage<IBoardSettings>('dataDisplayBoardSettings', {
    boardStyle: 'Yellow',
    showCasing: true,
    worldlinePowered: false,
    withBackground: false,
  })
  const { baseUrl } = useDataSource()

  const platforms = searchParams?.getAll('platform')
  const { showCasing } = customBoardSettings

  return (
    <>
      <BoardSettings editBoardUrl={editBoardUrl}>
        <ToggleSwitch
          checked={customBoardSettings.showCasing}
          label="Show board casing"
          onChange={e => setCustomBoardSettings(s => ({ ...s, showCasing: e.currentTarget.checked }))}
        />

        <ToggleSwitch
          checked={customBoardSettings.worldlinePowered}
          label="Worldline-driven (capitalised locations)"
          onChange={e => setCustomBoardSettings(s => ({ ...s, worldlinePowered: e.currentTarget.checked }))}
        />

        <ToggleSwitch
          checked={!customBoardSettings.withBackground}
          label="Black background"
          onChange={e => setCustomBoardSettings(s => ({ ...s, withBackground: !e.currentTarget.checked }))}
        />

        <label htmlFor="style">Style</label>
        <select
          id="style"
          value={customBoardSettings.boardStyle}
          onChange={e => setCustomBoardSettings(s => ({ ...s, boardStyle: e.currentTarget.value as any }))}
          css={{ marginLeft: 4 }}
        >
          {Object.keys(BoardStyles).map(k => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>

        {!!platforms?.length && <p>Hiding platform(s) {getDisabledPlatforms(platforms).join(', ')}</p>}
      </BoardSettings>

      <ZoomDiv>
        <div
          css={[
            { position: 'relative' },
            showCasing
              ? { width: `min(100vw, ${(100 * CASING_WIDTH) / CASING_HEIGHT}vh)`, aspectRatio: `${CASING_WIDTH} / ${CASING_HEIGHT}` }
              : { width: `min(100vw, ${(100 * COLUMNS) / ROWS}vh)` },
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
            css={
              showCasing && {
                position: 'absolute',
                left: percent(CASING_BORDER, CASING_WIDTH),
                top: percent(CASING_BORDER, CASING_HEIGHT),
                width: percent(COLUMNS, CASING_WIDTH),
              }
            }
            board="daktronics"
            crs={station}
            url={baseUrl}
            platforms={platforms}
            showUnconfirmedPlatforms={!!searchParams?.get('showUnconfirmedPlatforms')}
            legacyTocNames={!!searchParams?.get('useLegacyTocNames')}
            worldline={customBoardSettings.worldlinePowered}
          />

          {showCasing && <BoardAsset css={{ position: 'absolute', inset: 0, color: 'var(--casing-color)', pointerEvents: 'none' }} />}
        </div>
      </ZoomDiv>
    </>
  )
}
