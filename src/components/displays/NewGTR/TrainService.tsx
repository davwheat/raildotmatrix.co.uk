import React, { useCallback } from 'react';

import dayjs from 'dayjs';

import './css/trainService.less';

import type { IMyTrainService } from './TrainServices';
import SwapBetween from './SwapBetween';
import TrainServiceAdditionalInfo from './TrainServiceAdditionalInfo';

interface IProps {
  ordinal: string;
  service: IMyTrainService;
  showAdditionalDetails?: boolean;
}

const DESTINATION_MAX_LENGTH = 21;

function getDestinationAsStrings(destination: IMyTrainService['destinations'][number]): string[] {
  const name = destination.name;
  const via = destination.via || '';

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
      return service.destinations.map((d) => getDestinationAsStrings(d)).flat();
    },
    [service, getDestinationAsStrings]
  );

  const etd = service.displayedDepartureTime();

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
          <SwapBetween animate={false} interval={3_000}>
            {getDestinationPages().map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </SwapBetween>
        </span>
        <span className="etd time">
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
