import React, { useRef, useEffect, useCallback } from 'react'
import LedBoard from '../LedBoard'
import PlatformSettings, { defaultPlatformSettings } from '../LedBoard/PlatformSettings'
import ToggleSwitch from '../../common/form/ToggleSwitch'
import useStateWithLocalStorage from '../../../hooks/useStateWithLocalStorage'
import { debounce } from 'throttle-debounce'

import PageLink from '../../common/PageLink'
import { ZoomDiv } from '../ZoomDiv'
import { useDataSource } from '../../../live/source'

// The web board's 2000 × 550 px layout, in the 7.17 px dots of its 86 px font: its text area and the padding around it.
const COLUMNS = 272
const ROWS = 70
const PADDING = 24 / (86 / 12)
const WIDTH = COLUMNS + 2 * PADDING
const HEIGHT = ROWS + 2 * PADDING

const percent = (dots: number, of: number) => `${(100 * dots) / of}%`

interface IProps {
  station: string
  editBoardUrl: string
}

const BoardColors = {
  orange: 'amber',
  white: 'white',
} as const

export default function NewGTR({ station, editBoardUrl }: IProps) {
  let searchParams: URLSearchParams | null = null

  if (typeof window !== 'undefined') {
    searchParams = window && new URLSearchParams(window.location.search)
  }

  const hideSettings = searchParams?.get('hideSettings')
  const color: keyof typeof BoardColors = Object.keys(BoardColors).includes(searchParams?.get('color') || '')
    ? (searchParams!!.get('color')!! as keyof typeof BoardColors)
    : 'orange'

  const [settings, setSettings] = useStateWithLocalStorage('newGtrBoardSettings', {
    hideSettings: !!hideSettings,
    color,
    ...defaultPlatformSettings,
  })
  const { baseUrl } = useDataSource()

  const settingsRef = useRef<HTMLDivElement>(null)
  const hideRef = useRef<HTMLInputElement>(null)
  const colorRef = useRef<HTMLSelectElement>(null)

  function updateState() {
    setSettings({
      ...settings,
      hideSettings: !!hideRef.current?.checked,
      color: colorRef.current?.value as keyof typeof BoardColors,
    })

    if (!hideRef.current?.checked) {
      settingsRef.current?.classList.remove('hide')
    }
  }

  const updateHidden = useCallback(() => {
    settingsRef.current!.classList[settings.hideSettings ? 'add' : 'remove']('hide')
  }, [settings.hideSettings])

  const debouncedHide = debounce(1000, updateHidden)

  useEffect(() => {
    updateHidden()

    if (!settings.hideSettings) {
      return
    }

    function handler() {
      settingsRef.current?.classList.remove('hide')

      debouncedHide()
    }

    const events = ['click', 'mousemove', 'mouseover', 'mousemove', 'touchmove', 'touchstart', 'touchend', 'focus']

    events.forEach(e => window.addEventListener(e, handler))

    return () => {
      debouncedHide.cancel()
      events.forEach(e => window.removeEventListener(e, handler))
    }
  }, [settings.hideSettings])

  const platforms = searchParams?.getAll('platform')

  return (
    <>
      <div className="board-settings" ref={settingsRef}>
        {!searchParams?.get('from-railannouncements.co.uk') && (
          <>
            <PageLink
              to={editBoardUrl}
              style={{
                cursor: 'pointer',
                zIndex: 1000,
              }}
            >
              Edit board
            </PageLink>
            <br />
          </>
        )}
        <ToggleSwitch checked={settings.hideSettings} ref={hideRef} label="Hide this panel when idle" onChange={updateState} />
        <br />
        <label htmlFor="color-select">Color</label>
        <select
          id="color-select"
          ref={colorRef}
          value={settings.color}
          onChange={updateState}
          style={{ textTransform: 'capitalize', marginLeft: 4 }}
        >
          {Object.entries(BoardColors).map(([color]) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
        <br />
        <PlatformSettings settings={settings} onChange={change => setSettings(s => ({ ...s, ...change }))} />
        {(platforms?.length ?? 0) > 0 && <p>Showing only platform(s) {platforms!.join(', ')}</p>}
      </div>
      <ZoomDiv>
        <div
          css={{
            position: 'relative',
            width: `min(100vw, ${(100 * WIDTH) / HEIGHT}vh)`,
            aspectRatio: `${WIDTH} / ${HEIGHT}`,
            background: '#000',
          }}
        >
          <LedBoard
            css={{ position: 'absolute', left: percent(PADDING, WIDTH), top: percent(PADDING, HEIGHT), width: percent(COLUMNS, WIDTH) }}
            columns={COLUMNS}
            rows={ROWS}
            board="infotec"
            crs={station}
            url={baseUrl}
            platforms={platforms}
            showUnconfirmedPlatforms={!!searchParams?.get('showUnconfirmedPlatforms')}
            legacyTocNames={!!searchParams?.get('useLegacyTocNames')}
            colour={BoardColors[settings.color]}
            platformPosition={settings.platformPosition ?? defaultPlatformSettings.platformPosition}
            warningPlatform={!!settings.warningPlatform}
          />
        </div>
      </ZoomDiv>
    </>
  )
}
