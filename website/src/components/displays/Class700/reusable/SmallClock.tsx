import React from 'react'

import dayjs from 'dayjs'

import dayjsUtc from 'dayjs/plugin/utc'
import dayjsTz from 'dayjs/plugin/timezone'

dayjs.extend(dayjsUtc)
dayjs.extend(dayjsTz)

dayjs.tz.setDefault('Europe/London')

import useClock from '../../../../hooks/useClock'

export default function SmallClock() {
  const currentTime = useClock(60000)

  return (
    <div className="clock">
      <div className="time">
        <span className="text t900">{dayjs.tz(currentTime).format('HH:mm')}</span>
      </div>
      <div className="date">
        <span className="text t900">{dayjs.tz(currentTime).format('D/M/YYYY')}</span>
      </div>
    </div>
  )
}
