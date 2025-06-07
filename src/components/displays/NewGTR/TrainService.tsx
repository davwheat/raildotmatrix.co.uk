import React, { useCallback } from 'react'

import dayjs from 'dayjs'
import dayjsUtc from 'dayjs/plugin/utc'
import dayjsTz from 'dayjs/plugin/timezone'

dayjs.extend(dayjsUtc)
dayjs.extend(dayjsTz)

dayjs.tz.setDefault('Europe/London')

import './css/trainService.less'

import SwapBetween from './SwapBetween'
import TrainServiceAdditionalInfo from './TrainServiceAdditionalInfo'
import clsx from 'clsx'

import type { IMyTrainService } from '../../../api/ProcessServices'

interface IProps {
  ordinal: string
  service: IMyTrainService
  showAdditionalDetails?: boolean
  className?: string
}

const DESTINATION_MAX_LENGTH = 21

function getDestinationAsStrings(destination: IMyTrainService['destinations'][number], index: number): string[] {
  const andText = index > 0 ? 'and ' : ''
  const name = `${andText}${destination.name}`
  const via = destination.via || ''

  if (!via) return [name]

  const whole = `${name} ${via}`.trim()

  if (whole.length <= DESTINATION_MAX_LENGTH) {
    return [whole]
  } else {
    return [name, via]
  }
}

export default React.forwardRef(TrainService)

function TrainService({ ordinal, service, showAdditionalDetails = false, className }: IProps, ref: React.Ref<HTMLDivElement>) {
  const getDestinationPages = useCallback(
    function getDestinationPages(): string[] {
      return service.destinations.map((d, i) => getDestinationAsStrings(d, i)).flat()
    },
    [service, getDestinationAsStrings],
  )

  const pages = getDestinationPages()
  const etd = service.displayedDepartureTime()
  const isCancelled = service.cancelled

  return (
    <>
      <div ref={ref} className={clsx('trainService', className)}>
        <span className="ordinal">{ordinal}</span>
        <span className="std time">
          {dayjs
            .tz(service.scheduledDeparture)
            .format('HH:mm')
            .split('')
            .map((c, i) => (
              <span key={i}>{c}</span>
            ))}
        </span>
        <span className="destination">
          <SwapBetween key={pages.length} animate={false} interval={3_000}>
            {pages.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </SwapBetween>
        </span>
        <span className={clsx('etd time', { flash: isCancelled })}>
          {etd.includes(':') ? (
            <>
              Expt{' '}
              {etd.split('').map((c, i) => (
                <span key={i}>{c}</span>
              ))}
            </>
          ) : (
            etd
          )}
        </span>
      </div>
      {showAdditionalDetails && <TrainServiceAdditionalInfo service={service} />}
    </>
  )
}
