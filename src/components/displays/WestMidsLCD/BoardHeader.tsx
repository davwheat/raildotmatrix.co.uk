import React, { useState, useEffect } from 'react'

import dayjs from 'dayjs'

import dayjsUtc from 'dayjs/plugin/utc'
import dayjsTz from 'dayjs/plugin/timezone'

dayjs.extend(dayjsUtc)
dayjs.extend(dayjsTz)

import './css/board/header.less'

export default function BoardHeader({ platformNumber, stationName }: { platformNumber: number | null; stationName: string }) {
  return (
    <header>
      <span className="platform">{typeof platformNumber === 'number' ? `Platform ${platformNumber}` : stationName}</span>

      <Clock />
    </header>
  )
}

function Clock() {
  const [currentTime, setCurrentTime] = useState<Date>(new Date())

  useEffect(() => {
    const key = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => {
      clearInterval(key)
    }
  })

  return <div className="clock tab-nums">{dayjs(currentTime).format('HH:mm:ss')}</div>
}
