import React from 'react'

import { combineLocations } from './combineLocations'
import SlideyScrollText from './SlideyScrollText'

import './css/board/nextTrain.less'

import { AssociationCategory } from '../../../../functions/api/getServices'
import dayjs from 'dayjs'
import dayjsUtc from 'dayjs/plugin/utc'
import dayjsTz from 'dayjs/plugin/timezone'

dayjs.extend(dayjsUtc)
dayjs.extend(dayjsTz)

import type { IAssociation, IMyTrainService } from '../../../api/ProcessServices'

const NextTrainTopRow = React.memo(({ service }: { service: IMyTrainService }) => {
  return (
    <div className="top-row">
      <div className="time">{dayjs(service.scheduledDeparture).format('HH:mm')}</div>

      <SlideyScrollText className="dest" classNameInner="dest-inner">
        {combineLocations(service.destinations)}
      </SlideyScrollText>

      <div className="status" data-on-time={`${!service.isDelayed() && !service.cancelled}`}>
        <span className={service.cancelled ? 'flash' : ''}>{service.displayedDepartureTime('Exp ')}</span>
      </div>
    </div>
  )
})

interface ThirdRowProps {
  callingPointText: string
  extraText: string | null
}

function pluralise(strings: string[]): string {
  if (strings.length === 1) return strings[0]

  const last = strings.pop()!!
  return `${strings.join(', ')} and ${last}`
}

const NextTrainThirdRow = React.memo(({ callingPointText, extraText }: ThirdRowProps) => {
  return (
    <div className="third-row">
      <SlideyScrollText className="trainInfo" scrollSpeed={350}>
        {callingPointText}
        {extraText && <>. {extraText.endsWith('.') ? extraText : <>{extraText}.</>}</>}
      </SlideyScrollText>
    </div>
  )
})

export default function NextTrain({ nextTrain }: { nextTrain: IMyTrainService }) {
  const associatedServices = React.useMemo(
    () =>
      nextTrain.passengerCallPoints
        .map(s => s.associations)
        .flat(1)
        .filter((a): a is IAssociation<AssociationCategory.Divide> => a.type === AssociationCategory.Divide)
        .map(a => a.service),
    [JSON.stringify(nextTrain.passengerCallPoints.map(p => p.associations))],
  )

  // Memoise to prevent early animation end
  const callingPointText: string = React.useMemo(() => {
    const ogServicePoints = nextTrain.passengerCallPoints.map(p => {
      const aTime = p.displayedArrivalTime()
      return `${p.name}${aTime ? ` (${aTime})` : ''}`
    })

    const assocCount = associatedServices.length

    const assocServices = associatedServices.map((s, i): string => {
      const [stop1, ...stops] = s.passengerCallPoints

      const ogServiceDivideIndex = nextTrain.passengerCallPoints.findIndex(p => p.name === stop1.name)
      const pointsToDivide = ogServicePoints.slice(0, ogServiceDivideIndex + 1)

      const pos = i + 1 === assocCount ? 'Rear' : 'Middle'

      return `Join the ${pos} ${s.length ? `${s.length} ` : ''}coaches for ${pluralise([
        ...pointsToDivide,
        ...stops.map(p => {
          const aTime = p.displayedArrivalTime()
          return `${p.name}${aTime ? ` (${aTime})` : ''}`
        }),
      ])}.`
    })

    if (assocServices.length === 0) {
      // No splits
      return `Calling at ${pluralise(ogServicePoints)}.`
    } else {
      const ogLengthEnd = nextTrain.passengerCallPoints.at(-1)!!.length
      return [`Join the front ${ogLengthEnd ? `${ogLengthEnd} ` : ''}coaches for ${pluralise(ogServicePoints)}.`, ...assocServices].join(' ')
    }
  }, [JSON.stringify(nextTrain.passengerCallPoints), JSON.stringify(associatedServices.map(a => a.passengerCallPoints))])

  return (
    <div className="nextTrain">
      <NextTrainTopRow service={nextTrain} />

      <div className="second-row">
        <div className="toc">{nextTrain.toc}</div>
        <div className="length">
          {(nextTrain.length || 0) === 1 && `1 carriage`}
          {(nextTrain.length || 0) > 1 && `${nextTrain.length} carriages`}

          {/*
            Sometimes data feed issues mean that the train length is 0.
            We should hide the length when this is the case.
           */}
          {/* {(nextTrain.length || 0) === 0 && `? carriages`} */}
        </div>
      </div>

      <NextTrainThirdRow
        callingPointText={callingPointText}
        extraText={nextTrain.cancelled ? nextTrain.cancelReason : !nextTrain.isDelayed() ? '' : nextTrain.delayReason}
      />
    </div>
  )
}
