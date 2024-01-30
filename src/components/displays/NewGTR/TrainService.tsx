import React, { useCallback } from 'react';

import dayjs from 'dayjs';

import './css/trainService.less';

import SwapBetween from './SwapBetween';
import TrainServiceAdditionalInfo from './TrainServiceAdditionalInfo';
import clsx from 'clsx';

import type { IMyTrainService } from '../../../api/ProcessServices';

interface IProps {
  ordinal: string;
  service: IMyTrainService;
  showAdditionalDetails?: boolean;
}

const DESTINATION_MAX_LENGTH = 21;

function getDestinationAsStrings(destination: IMyTrainService['destinations'][number], index: number): string[] {
  const andText = index > 0 ? 'and ' : '';
  const name = `${andText}${destination.name}`;
  const via = destination.via || '';

  if (!via) return [name];

  const whole = `${name} ${via}`.trim();

  if (whole.length <= DESTINATION_MAX_LENGTH) {
    return [whole];
  } else {
    return [name, via];
  }
}

export default function TrainService({ ordinal, service, showAdditionalDetails = false }: IProps) {
  const getDestinationPages = useCallback(
    function getDestinationPages(): string[] {
      return service.destinations.map((d, i) => getDestinationAsStrings(d, i)).flat();
    },
    [service, getDestinationAsStrings]
  );

  const pages = getDestinationPages();
  const etd = service.displayedDepartureTime();
  const isCancelled = service.cancelled;

  return (
    <>
      <div className="trainService">
        <span className="ordinal">{ordinal}</span>
        <span className="std time">
          {dayjs(service.scheduledDeparture)
            .format('HH:mm')
            .split('')
            .map((c) => (
              <span>{c}</span>
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
              {etd.split('').map((c) => (
                <span>{c}</span>
              ))}
            </>
          ) : (
            etd
          )}
        </span>
      </div>
      {showAdditionalDetails && <TrainServiceAdditionalInfo service={service} />}
    </>
  );
}
