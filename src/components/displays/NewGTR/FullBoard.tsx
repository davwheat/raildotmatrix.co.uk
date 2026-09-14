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

  if (!services || (services.length === 0 && !warning)) {
    return (
      <article className="dot-matrix">
        <CallNreMessage />
        <Clock animateDigits={animateClockDigits} />
      </article>
    )
  }

  return (
    <article className="dot-matrix">
      {warning ? <PlatformWarningMessage kind={warning} /> : <TrainServices services={services} />}
      <Clock animateDigits={animateClockDigits} />
    </article>
  )
}
