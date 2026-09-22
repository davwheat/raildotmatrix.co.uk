import React from 'react'

import CallNreMessage from './CallNreMessage'
import PlatformWarningMessage from './PlatformWarningMessage'
import Clock from './Clock'
import TrainServices from './TrainServices'

import { useServiceInformation } from '../../../hooks/useServiceInformation'
import { noticeKind } from '../../../live/overrideNotice'

interface IProps {
  platforms?: string[]
  station: string
  animateClockDigits?: boolean
  useLegacyTocNames?: boolean
  showUnconfirmedPlatforms: boolean
}

export default function FullBoard({ station, animateClockDigits, platforms, useLegacyTocNames, showUnconfirmedPlatforms }: IProps) {
  const { services, overrides } = useServiceInformation(station, platforms ?? null, !!useLegacyTocNames, showUnconfirmedPlatforms)

  const warning = noticeKind(overrides)

  if (!services) {
    return (
      <article className="dot-matrix">
        <CallNreMessage />
        <Clock animateDigits={animateClockDigits} />
      </article>
    )
  }

  // An empty list still goes through TrainServices: the last train has to slide out before the message takes
  // its place, so the component that owns that animation stays mounted.
  return (
    <article className="dot-matrix">
      {warning ? <PlatformWarningMessage kind={warning} /> : <TrainServices services={services} />}
      <Clock animateDigits={animateClockDigits} />
    </article>
  )
}
