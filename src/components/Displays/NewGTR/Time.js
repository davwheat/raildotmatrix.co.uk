import React, { useState } from 'react'
import useInterval from '../../../hooks/useInterval'

export default function Time() {
  const [TimeString, setTimeString] = useState(null)

  function padZero(input) {
    if (input < 10) {
      return `0${input}`
    } else {
      return `${input}`
    }
  }

  function updateTime() {
    const time = new Date()

    setTimeString(
      <>
        <span className="display--time__big">
          {padZero(time.getHours())
            .split('')
            .map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          :
          {padZero(time.getMinutes())
            .split('')
            .map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          :
        </span>
        <span className="display--time__small">
          {padZero(time.getSeconds())
            .split('')
            .map((c, i) => (
              <span key={i}>{c}</span>
            ))}
        </span>
      </>,
    )
  }

  useInterval(() => {
    updateTime()
  }, 1000)

  return <p className="display--time">{TimeString}</p>
}
