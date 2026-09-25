import React from 'react'
import useClock from '../../../hooks/useClock'

import dayjs from 'dayjs'

import dayjsUtc from 'dayjs/plugin/utc'
import dayjsTz from 'dayjs/plugin/timezone'

dayjs.extend(dayjsUtc)
dayjs.extend(dayjsTz)

dayjs.tz.setDefault('Europe/London')

export default function BoardHeader({ platformNumber, stationName }: { platformNumber: number | null; stationName: string }) {
  return (
    <header>
      <span className="platform">{typeof platformNumber === 'number' ? `Platform ${platformNumber}` : stationName}</span>

      <Clock />
    </header>
  )
}

function Clock() {
  const currentTime = useClock(1000)

  return <div className="clock tab-nums">{dayjs.tz(currentTime).format('HH:mm:ss')}</div>
}
