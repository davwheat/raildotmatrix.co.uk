import React from 'react'

import { combineLocations } from './combineLocations'
import SlideyScrollText from './SlideyScrollText'

import { AssociationCategory } from '../../../api-types/get-services-types'
import dayjs from 'dayjs'
import dayjsUtc from 'dayjs/plugin/utc'
import dayjsTz from 'dayjs/plugin/timezone'

dayjs.extend(dayjsUtc)
dayjs.extend(dayjsTz)

dayjs.tz.setDefault('Europe/London')

import type { IAssociation, IMyTrainService } from '../../../api/ProcessServices'

const NextTrainTopRow = React.memo(({ service }: { service: IMyTrainService }) => {
  return (
    <div className="top-row">
      <div className="time">{dayjs.tz(service.scheduledDeparture).format('HH:mm')}</div>

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
      <SlideyScrollText className="trainInfo">
        {callingPointText}
        {extraText && <>. {extraText.endsWith('.') ? extraText : <>{extraText}.</>}</>}
      </SlideyScrollText>
    </div>
  )
})

export default function NextTrain({ nextTrain }: { nextTrain: IMyTrainService }) {
  // Each portion with the index of the calling point it divides at.
  const associatedServices = React.useMemo(
    () =>
      nextTrain.passengerCallPoints.flatMap((point, divideIndex) =>
        point.associations
          .filter((a): a is IAssociation<AssociationCategory.Divide> => a.type === AssociationCategory.Divide)
          .map(a => ({ service: a.service, position: a.position, divideIndex })),
      ),
    [nextTrain.passengerCallPoints],
  )

  // Feed projections replace these arrays when their contents change.
  const callingPointText: string = React.useMemo(() => {
    // A terminating service has nowhere left to call, so where it came from is the useful thing to say.
    if (nextTrain.terminatesHere) return `This is the service from ${pluralise(nextTrain.origins.map(origin => origin.name))}.`

    const ogServicePoints = nextTrain.passengerCallPoints.map(p => {
      const aTime = p.displayedArrivalTime()
      return `${p.name}${aTime ? ` (${aTime})` : ''}`
    })

    const assocCount = associatedServices.length

    // The train's own part is the front unless a portion is known to be there. A portion at an unknown end is
    // taken to be behind the ones before it: the last one is the rear and the others the middle.
    const takesFront = associatedServices.some(a => a.position === 'front')
    const takesRear = associatedServices.some(a => a.position === 'rear')
    const ownPart = takesFront && takesRear ? 'middle' : takesFront ? 'rear' : 'front'
    const rank = (part: string) => ['front', 'middle', 'rear'].indexOf(part.toLowerCase())

    const assocServices = associatedServices.map(({ service: s, position, divideIndex }, i) => {
      // A portion's calls can open with the call it divides at, which the train's own list already has. They
      // needn't: a sleeper sets nobody down there, and a station can be called at twice.
      const dividesAt = nextTrain.passengerCallPoints[divideIndex].name
      const stops = s.passengerCallPoints.filter((p, stop) => stop > 0 || p.name !== dividesAt)
      const pointsToDivide = ogServicePoints.slice(0, divideIndex + 1)

      const pos =
        position === 'front'
          ? 'Front'
          : position === 'rear'
            ? 'Rear'
            : position === 'middle' || i + 1 < assocCount || takesRear || ownPart === 'rear'
              ? 'Middle'
              : 'Rear'

      return {
        part: pos,
        text: `Join the ${pos} ${s.length ? `${s.length} ` : ''}coaches for ${pluralise([
          ...pointsToDivide,
          ...stops.map(p => {
            const aTime = p.displayedArrivalTime()
            return `${p.name}${aTime ? ` (${aTime})` : ''}`
          }),
        ])}.`,
      }
    })

    if (assocServices.length === 0) {
      // No splits
      return `Calling at ${pluralise(ogServicePoints)}.`
    } else {
      const ogLengthEnd = nextTrain.passengerCallPoints.at(-1)!!.length
      const own = {
        part: ownPart,
        text: `Join the ${ownPart} ${ogLengthEnd ? `${ogLengthEnd} ` : ''}coaches for ${pluralise(ogServicePoints)}.`,
      }
      // From the front of the train to the rear. The sort is stable, so parts at one place keep their order.
      return [own, ...assocServices]
        .sort((a, b) => rank(a.part) - rank(b.part))
        .map(part => part.text)
        .join(' ')
    }
  }, [nextTrain.terminatesHere, nextTrain.origins, nextTrain.passengerCallPoints, associatedServices])

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
