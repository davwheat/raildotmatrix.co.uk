import React from 'react'
import LedBoard from '../LedBoard'
import { useBoardOptions } from '../../BoardOptions/context'
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

  const { options: settings } = useBoardOptions()
  const { baseUrl } = useDataSource()

  const platforms = searchParams?.getAll('platform')

  return (
    <>
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
            showUnconfirmedPlatforms={settings.showUnconfirmedPlatforms}
            legacyTocNames={settings.useLegacyTocNames}
            colour={BoardColors[settings.color]}
            rowPrefix={settings.rowPrefix}
            ordinalFormat={settings.ordinalFormat ?? 'suffix'}
            warningPlatform={!!settings.warningPlatform}
            platformBox={!!settings.platformBox}
            compactLowerRow={settings.compactLowerRow !== false}
            serviceCount={settings.serviceCount ?? 3}
            clockStyle={settings.clockStyle}
            loadingBrightness={settings.loadingBrightness}
            alignPlatformRows={settings.alignPlatformRows !== false}
          />
        </div>
      </ZoomDiv>
    </>
  )
}
