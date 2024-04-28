import React, { useCallback } from 'react';

import { css } from '@emotion/react';

import dayjs from 'dayjs';
import dayjsUtc from 'dayjs/plugin/utc';
import dayjsTz from 'dayjs/plugin/timezone';

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTz);

dayjs.tz.setDefault('Europe/London');

import SwapBetween from './SwapBetween';
import TrainServiceAdditionalInfo from './TrainServiceAdditionalInfo';

import { getStationWithOverride } from './abbreviatedStations';

import type { IMyTrainService } from '../../../api/ProcessServices';

interface IProps {
  ordinal: string;
  service: IMyTrainService;
  showAdditionalDetails?: boolean;
  tripleLine?: boolean;
  className?: string;
}

function getDestinationAsStrings(destination: IMyTrainService['destinations'][number], index: number, count: number): string[] {
  const stnName = getStationWithOverride(destination.crs, destination.name);

  let suffix = '';
  if (count > 1) {
    if (count - index === 2) suffix = ' & ';
    if (count - index > 2) suffix = ', ';
  }

  const name = `${stnName}${suffix}`;

  return [name];
}

export default React.forwardRef(TrainService);

const serviceBase = css`
  --gap: calc(1em / 7 * 2.5);
  --ordinal-width: 3.25ch;
  --std-width: 4.5ch;
  --etd-width: 8.2ch;

  display: grid;
  grid-template-columns: var(--ordinal-width) var(--std-width) 1fr var(--etd-width);
  gap: var(--gap);
  height: var(--row-height);
`;

const destinationBase = css`
  display: inline-block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-transform: var(--destination-text-transform, none);
`;

function TrainService({ ordinal, service, showAdditionalDetails = false, tripleLine = false, className }: IProps, ref: React.Ref<HTMLDivElement>) {
  const getDestinationPages = useCallback(
    function getDestinationPages(): string[] {
      return service.destinations.map((d, i, arr) => getDestinationAsStrings(d, i, arr.length)).flat();
    },
    [service, getDestinationAsStrings]
  );

  const pages = getDestinationPages();
  const etd = service.displayedDepartureTime(undefined, 'HHmm');

  return (
    <>
      <div ref={ref} className={className} css={serviceBase}>
        <span>{ordinal}</span>
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
        <span>
          {tripleLine ? (
            <span css={destinationBase}>{pages[0]}</span>
          ) : (
            <SwapBetween key={pages.length} animate={false} interval={3_000} css={{ height: '100%' }}>
              {pages.map((d, i) => (
                <span key={i} css={destinationBase}>
                  {d}
                </span>
              ))}
            </SwapBetween>
          )}
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

      {tripleLine && (
        <div css={serviceBase}>
          <span />
          <span />
          <span css={{ gridColumn: 'span 2' }}>
            <span css={destinationBase}>{pages.slice(1).join('')}</span>
          </span>
        </div>
      )}

      {showAdditionalDetails && <TrainServiceAdditionalInfo service={service} />}
    </>
  );
}
