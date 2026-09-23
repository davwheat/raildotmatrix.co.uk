import React from 'react'
import FullBoard from './FullBoard'
import { ZoomDiv } from '../ZoomDiv'
import { useBoardOptions } from '../../BoardOptions/context'

export default function BlackboxLandscapeLcd({ station }: { station: string }) {
  const { options } = useBoardOptions()
  const platforms = new URLSearchParams(window.location.search).getAll('platform')
  return (
    <ZoomDiv>
      <FullBoard
        station={station}
        platforms={platforms}
        useLegacyTocNames={options.useLegacyTocNames}
        showUnconfirmedPlatforms={options.showUnconfirmedPlatforms}
      />
    </ZoomDiv>
  )
}
