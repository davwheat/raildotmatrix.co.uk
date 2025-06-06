import React from 'react'

import BoardSettings from '../../common/BoardSettings'
import FullBoard from './FullBoard'
import { ZoomDiv } from '../ZoomDiv'

import useStateWithLocalStorage from '../../../hooks/useStateWithLocalStorage'

import BoardAsset from './board-outline.inline.svg'
import ToggleSwitch from '../../common/form/ToggleSwitch'

interface IProps {
  station: string
  editBoardCallback: () => void
}

const BoardStyles = {
  Yellow: {
    '--calling-points-text-transform': 'none',
    '--casing-color': '#db9426',
  },
  Blue: {
    '--calling-points-text-transform': 'none',
    '--casing-color': '#11185a',
  },
  'Green/Blue': {
    '--calling-points-text-transform': 'none',
    '--casing-color': '#1b4b47',
  },
} as const

interface IBoardSettings {
  boardStyle: keyof typeof BoardStyles
  showCasing: boolean
  worldlinePowered: boolean
  withBackground: boolean
}

export default function DaktronicsDataDisplay({ station }: IProps) {
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

  const platforms = searchParams?.getAll('platform')

  return (
    <>
      <BoardSettings>
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

        {!!platforms?.length && <p>Only showing platform(s) {platforms.join(',')}</p>}
      </BoardSettings>

      <ZoomDiv>
        <div
          css={[
            { position: 'relative' },
            BoardStyles[customBoardSettings.boardStyle],
            customBoardSettings.worldlinePowered && {
              '--calling-points-text-transform': 'none',
              '--destination-text-transform': 'uppercase',
            },
            customBoardSettings.withBackground && {
              '--dmi-row-background': '#35241a',
              '--dmi-background': '#0c0806',
            },
          ]}
        >
          {customBoardSettings.showCasing && (
            <BoardAsset css={{ position: 'absolute', inset: 0, zIndex: 2, color: 'var(--casing-color)', pointerEvents: 'none' }} />
          )}

          <FullBoard
            // Force re-render as text-transform can affect scrolling calling points
            key={`${customBoardSettings.boardStyle}.${customBoardSettings.worldlinePowered}`}
            hasCasing={customBoardSettings.showCasing}
            station={station}
            platforms={platforms}
            useLegacyTocNames={!!searchParams?.get('useLegacyTocNames')}
            showUnconfirmedPlatforms={!!searchParams?.get('showUnconfirmedPlatforms')}
            worldlinePowered={customBoardSettings.worldlinePowered}
          />
        </div>
      </ZoomDiv>
    </>
  )
}
