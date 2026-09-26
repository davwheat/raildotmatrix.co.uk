import React, { useRef } from 'react'

import BoardHeader from './BoardHeader'
import NextTrain from './NextTrainData'
import SecondaryTrainData from './SecondaryTrainData'
import PlatformWarningMessage from './PlatformWarningMessage'
import { useServiceInformation } from '../../../hooks/useServiceInformation'
import { noticeKind } from '../../../live/overrideNotice'

interface IProps {
  station: string
  useLegacyTocNames?: boolean
  platforms?: string[]
  showUnconfirmedPlatforms?: boolean
  hideTerminating?: boolean
}

export default function FullBoard({
  station,
  useLegacyTocNames = false,
  platforms,
  showUnconfirmedPlatforms = false,
  hideTerminating = false,
}: IProps) {
  const boardRef = useRef<HTMLDivElement>(null)

  const { services, overrides, stationName } = useServiceInformation(
    station,
    platforms ?? null,
    !!useLegacyTocNames,
    showUnconfirmedPlatforms,
    hideTerminating,
  )

  const warning = noticeKind(overrides)

  if (warning) {
    return (
      <article className="tfwm-board tfwm-board__notice" ref={boardRef}>
        <BoardHeader platforms={platforms ?? []} stationName={stationName} />

        <PlatformWarningMessage kind={warning} />
      </article>
    )
  }

  if (services === null || services.length === 0) {
    return (
      <article className="tfwm-board tfwm-board__notice" ref={boardRef}>
        <BoardHeader platforms={platforms ?? []} stationName={station} />

        <div className="fullscreenNotice">
          <p>Please listen for announcements or call National&nbsp;Rail&nbsp;Enquiries on 03457 48 49 50</p>
        </div>
      </article>
    )
  }

  const [firstService, secondService, thirdService] = services

  return (
    <article className="tfwm-board" ref={boardRef}>
      <BoardHeader platforms={platforms ?? []} stationName={stationName} />

      {firstService && <NextTrain nextTrain={firstService} />}

      {secondService && <SecondaryTrainData train={secondService} position={2} />}
      {thirdService && <SecondaryTrainData train={thirdService} position={3} />}
    </article>
  )
}
