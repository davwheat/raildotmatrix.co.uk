import React, { useEffect } from 'react';

import SlideyScrollText from './SlideyScrollText';
import clsx from 'clsx';

import { keyframes, css } from '@emotion/react';

import { AssociationCategory } from '../../../../functions/api/getServices';
import type { IAssociation, IMyTrainService } from '../../../api/ProcessServices';
import { CallingPoints } from './CallingPoints';

const infoIn = keyframes`
  0% {
    opacity: 1;
    transform: translateY(110%);
  }

  100% {
    opacity: 1;
    transform: translateY(0);
  }
`;

const infoOut = keyframes`
  0% {
    opacity: 1;
    transform: translateY(0);
  }

  100% {
    opacity: 0;
    transform: translateY(0);
  }
`;

const infoPage = css`
  position: absolute;
  height: 1.3em;
  display: flex;
  top: 0;
  left: 0;
  right: 0;

  min-width: 100%;

  opacity: 0;
  transition: opacity 0.2s linear 0.5s;

  &.shown {
    opacity: 1;
  }

  &:not(.shown) {
    transition-delay: 0s;
  }
`;

interface IProps {
  service: IMyTrainService;
}

function getServiceInfo(service: IMyTrainService): string {
  const { toc, length } = service;

  const portions: string[] = [];

  portions.push(`${toc ? ` ${toc}` : ''} service.`);

  if (!!length) portions.push(`Formed of ${length} coaches.`);

  if (service.cancelled) {
    if (service.cancelReason) portions.push(service.cancelReason);
  } else if (service.isDelayed()) {
    if (service.delayReason) portions.push(service.delayReason);
  }

  return portions.join(' ');
}

interface InfoPage {
  fixedPrefix?: string;
  scrollingPrefix?: string;
  scrollingSuffix?: string;
  callPoints: string[];
}

export default function TrainServiceAdditionalInfo({ service }: IProps) {
  const associatedServices = React.useMemo(
    () =>
      service.passengerCallPoints
        .map((s) => s.associations)
        .flat(1)
        .filter((a): a is IAssociation<AssociationCategory.Divide> => a.type === AssociationCategory.Divide)
        .map((a) => a.service),
    [JSON.stringify(service)]
  );

  const pageCount = 2 + associatedServices.length;

  const [shownPage, setShownPage] = React.useState(0);

  const nextPage = React.useCallback(() => {
    setShownPage((p) => {
      if (p + 1 >= pageCount) return 0;
      return p + 1;
    });
  }, [pageCount]);

  useEffect(() => {
    if (shownPage >= pageCount) setShownPage(0);
  }, [shownPage, pageCount]);

  // Memoise to prevent early animation end
  const callingPointPages: InfoPage[] = React.useMemo(() => {
    const ogServicePoints = service.passengerCallPoints.map((p) => p.name);

    const assocCount = associatedServices.length;

    const assocServices = associatedServices.map((s, i): InfoPage => {
      const [stop1, ...stops] = s.passengerCallPoints;

      const ogServiceDivideIndex = service.passengerCallPoints.findIndex((p) => p.name === stop1.name);
      const pointsToDivide = ogServicePoints.slice(0, ogServiceDivideIndex + 1);

      const pos = i + 1 === assocCount ? 'Rear' : 'Middle';

      return {
        callPoints: [...pointsToDivide, ...stops.map((p) => p.name)],
        scrollingPrefix: `${pos} ${s.length ? `${s.length} ` : ''}coaches: `,
      };
    });

    if (assocServices.length === 0) {
      // No splits
      return [
        {
          callPoints: ogServicePoints,
          scrollingPrefix: 'Calling at ',
        },
      ];
    } else {
      const ogLengthEnd = service.passengerCallPoints.at(-1)!!.length;
      return [{ callPoints: ogServicePoints, scrollingPrefix: `Front ${ogLengthEnd ? `${ogLengthEnd} ` : ''}coaches: ` }, ...assocServices];
    }
  }, [JSON.stringify(service.passengerCallPoints), JSON.stringify(associatedServices.map((a) => a.passengerCallPoints))]);

  const serviceInfo = React.useMemo(() => getServiceInfo(service), [JSON.stringify(service)]);

  console.log(callingPointPages);
  console.log(service);

  return (
    <div
      css={{
        height: 'var(--row-height)',
        position: 'relative',
        clipPath: 'inset(0)',
      }}
    >
      <div
        className={clsx({ shown: shownPage === 0 })}
        css={[
          infoPage,
          shownPage === 0
            ? {
                opacity: 1,
                transform: 'translateY(110%)',
                animationName: infoIn,
                animationDuration: '0.2s',
                animationFillMode: 'forwards',
                animationTimingFunction: 'linear',
                animationDelay: '0.5s',
              }
            : {
                animationName: infoOut,
                animationDuration: '0.2s',
                animationFillMode: 'forwards',
                animationTimingFunction: 'linear',
              },
        ]}
      >
        <SlideyScrollText
          css={{ minWidth: '100%' }}
          alwaysScroll
          callCompleteIfNotScrolling={8_000}
          onComplete={() => {
            shownPage === 0 && nextPage();
            // Stop animation
            console.log('next from info');

            return true;
          }}
        >
          {serviceInfo}
        </SlideyScrollText>
      </div>

      {callingPointPages.map((page, i) => (
        <div key={i} className={clsx({ shown: shownPage === i + 1 })} css={infoPage}>
          {page.fixedPrefix && (
            <div
              css={{
                minWidth: 'calc(var(--ordinal-width) + var(--std-width) + var(--gap) * 2)',
                paddingRight: 16,
                flexShrink: 0,
              }}
            >
              {page.fixedPrefix}
            </div>
          )}
          {shownPage === i + 1 && (
            <CallingPoints
              pointsText={page.callPoints}
              scrollingPrefix={page.scrollingPrefix}
              scrollingSuffix={page.scrollingSuffix}
              onComplete={() => {
                console.log('next from call p', i + 1);
                nextPage();
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
