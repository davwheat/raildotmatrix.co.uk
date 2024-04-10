import React, { useCallback } from 'react';

import dayjs from 'dayjs';
import dayjsUtc from 'dayjs/plugin/utc';
import dayjsTz from 'dayjs/plugin/timezone';

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTz);

dayjs.tz.setDefault('Europe/London');

import SwapBetween from './SwapBetween';
import TrainServiceAdditionalInfo from './TrainServiceAdditionalInfo';
import clsx from 'clsx';

import type { IMyTrainService } from '../../../api/ProcessServices';

interface IProps {
  ordinal: string;
  service: IMyTrainService;
  showAdditionalDetails?: boolean;
  className?: string;
}

const DESTINATION_MAX_LENGTH = 21;

function getDestinationAsStrings(destination: IMyTrainService['destinations'][number], index: number): string[] {
  const andText = index > 0 ? '& ' : '';
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

export default React.forwardRef(TrainService);

function TrainService({ ordinal, service, showAdditionalDetails = false, className }: IProps, ref: React.Ref<HTMLDivElement>) {
  const getDestinationPages = useCallback(
    function getDestinationPages(): string[] {
      return service.destinations.map((d, i) => getDestinationAsStrings(d, i)).flat();
    },
    [service, getDestinationAsStrings]
  );

  const pages = getDestinationPages();
  const etd = service.displayedDepartureTime(undefined, 'HHmm');
  const isCancelled = service.cancelled;

  return (
    <>
      <div
        ref={ref}
        className={className}
        css={{
          '--gap': 'calc(1em / 7 * 2.5)',
          '--ordinal-width': '3ch',
          '--std-width': '4.5ch',
          '--etd-width': '8.2ch',

          display: 'grid',
          gridTemplateColumns: 'var(--ordinal-width) var(--std-width) 1fr var(--etd-width)',
          gap: 'var(--gap)',
        }}
      >
        <span className="ordinal">{ordinal}</span>
        <span>
          {dayjs
            .tz(service.scheduledDeparture)
            .format('HHmm')
            .split('')
            .map((c, i) => (
              <span
                key={i}
                css={{
                  display: 'inline-block',
                  width: '1ch',
                  textAlign: 'center',
                }}
              >
                {c}
              </span>
            ))}
        </span>
        <span className="destination">
          <SwapBetween key={pages.length} animate={false} interval={3_000} css={{ height: '100%' }}>
            {pages.map((d, i) => (
              <span
                key={i}
                css={{
                  display: 'inline-block',
                  width: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {d}
              </span>
            ))}
          </SwapBetween>
        </span>
        <span css={{ textAlign: 'right', marginRight: -4 }}>
          {etd.match(/\d{4}/) ? (
            <>
              {etd.split('').map((c, i) => (
                <span
                  key={i}
                  css={{
                    display: 'inline-block',
                    width: '1ch',
                    textAlign: 'center',
                  }}
                >
                  {c}
                </span>
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