import React, { useCallback, useEffect } from 'react';

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
  tripleLineIfRequired?: boolean;
  clipToFirstLine?: boolean;
  className?: string;
  worldlinePowered: boolean;
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
  --row-count: 1;

  display: grid;
  grid-template-columns: var(--ordinal-width) var(--std-width) 1fr var(--etd-width);
  grid-template-rows: repeat(var(--row-count), var(--row-height));
  column-gap: var(--gap);

  clip-path: polygon(
    0 0,
    100% 0,
    100% calc(var(--row-height) - var(--background-row-y-offset)),
    0 calc(var(--row-height) - var(--background-row-y-offset))
  );

  & > * {
    min-width: 0;
  }

  &[data-triple-line='true'] {
    --row-count: 2;
  }

  &[data-triple-line='true'] ~ :has(&),
  &[data-triple-line='true'] ~ &,
  &[data-triple-line='true'] ~ #space-filler {
    display: none;
  }
`;

const destinationBase = css`
  display: inline;
  overflow: hidden;
  text-transform: var(--destination-text-transform, none);
`;

const destinationContainer = css`
  grid-row: 1 / span var(--row-count);
  grid-column: 3 / span 2;
  position: relative;
  line-height: var(--row-height);
  transform: translateY(-9.5px);
  clip-path: inset(0);
`;

const destinationTextBlocker = css`
  width: calc(var(--gap) + var(--etd-width));
  height: var(--row-height);
  float: right;
`;

function TrainService(
  { ordinal, service, showAdditionalDetails = false, tripleLineIfRequired = false, clipToFirstLine = false, className, worldlinePowered }: IProps,
  ref: React.Ref<HTMLDivElement>
) {
  const [requiresTripleLine, setRequiresTripleLine] = React.useState(tripleLineIfRequired);
  const getDestinationPages = useCallback(
    function getDestinationPages(): string[] {
      return service.destinations.map((d, i, arr) => getDestinationAsStrings(d, i, arr.length)).flat();
    },
    [service, getDestinationAsStrings]
  );

  const destinationRef = React.useRef<HTMLSpanElement>(null);
  const cellRef = React.useRef<HTMLSpanElement>(null);

  console.log(`Requires triple line: ${requiresTripleLine}`);

  useEffect(() => {
    if (!destinationRef.current || !cellRef.current) return;

    const rowHeight = cellRef.current.offsetHeight;
    const textHeight = destinationRef.current.offsetHeight;

    const _requiresTripleLine = textHeight > rowHeight;

    if (_requiresTripleLine !== requiresTripleLine) setRequiresTripleLine(_requiresTripleLine);
  }, [JSON.stringify(service.destinations), requiresTripleLine, tripleLineIfRequired]);

  const pages = getDestinationPages();
  const etd = service.displayedDepartureTime(undefined, 'HHmm', null);

  return (
    <>
      <div
        ref={ref}
        className={className}
        css={serviceBase}
        data-triple-line={requiresTripleLine}
        style={{
          ...(!clipToFirstLine && !requiresTripleLine
            ? {}
            : {
                clipPath: !clipToFirstLine
                  ? `polygon(
                  0 0, 100% 0, 100% calc(100% - var(--background-row-y-offset)), 0 calc(100% - var(--background-row-y-offset)),
                  0 100%, 100% 100%, 100% calc(200% - var(--background-row-y-offset)), 0 calc(200% - var(--background-row-y-offset)),
                  0 200%, 100% 200%, 100% calc(300% - var(--background-row-y-offset)), 0 calc(300% - var(--background-row-y-offset))
                )`
                  : 'polygon(0 0, 100% 0, 100% var(--row-height), 0 var(--row-height))',
              }),
        }}
      >
        <span ref={cellRef}>{ordinal}</span>
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
        <span css={destinationContainer}>
          {tripleLineIfRequired ? (
            <span css={destinationBase} ref={destinationRef}>
              <span css={destinationTextBlocker} />
              {pages.join('')}
            </span>
          ) : (
            <SwapBetween key={pages.length} animate={false} interval={3_000} css={{ height: '100%' }}>
              {pages.map((d, i) => (
                <span key={`${i}__${d}`} css={destinationBase}>
                  {d}
                </span>
              ))}
            </SwapBetween>
          )}
        </span>
        <span css={{ textAlign: 'right', marginRight: -4, gridColumn: '4 / span 1', gridRow: '1 / span 1' }}>
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

      {showAdditionalDetails && <TrainServiceAdditionalInfo worldlinePowered={worldlinePowered} service={service} />}
    </>
  );
}
