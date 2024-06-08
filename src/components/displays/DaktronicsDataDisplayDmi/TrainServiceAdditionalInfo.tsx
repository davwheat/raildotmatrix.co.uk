import React, { useEffect } from 'react';

import SlideyScrollText from './SlideyScrollText';
import clsx from 'clsx';

import { keyframes, css } from '@emotion/react';

import { AssociationCategory } from '../../../../functions/api/getServices';
import { CallingPoint, CallingPoints } from './CallingPoints';

import type { IAssociation, IMyTrainService } from '../../../api/ProcessServices';

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
  height: 80px;
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
  worldlinePowered: boolean;
}

function getServiceInfo(service: IMyTrainService, worldlinePowered: boolean): string {
  const { toc, length } = service;

  if (worldlinePowered) {
    const portions: string[] = [!!length ? `A ${toc} service which has ${length} coaches.` : `A ${toc} service.`];

    if (service.cancelled) {
      if (service.cancelReason) portions.push(service.cancelReason);
    } else if (service.isDelayed()) {
      if (service.delayReason) portions.push(service.delayReason);
    }

    return portions.join(' ');
  } else {
    const portions: string[] = [' service.'];

    if (!!length) portions.push(`Formed of ${length} coaches.`);

    if (service.cancelled) {
      if (service.cancelReason) portions.push(service.cancelReason);
    } else if (service.isDelayed()) {
      if (service.delayReason) portions.push(service.delayReason);
    }

    return portions.join(' ');
  }
}

function getServiceInfoPrefix(service: IMyTrainService, worldlinePowered: boolean): string {
  if (worldlinePowered) return '';

  const { toc } = service;

  return `${toc ? `${toc}` : 'A'}`;
}

interface InfoPage {
  fixedPrefix?: string;
  scrollingPrefix?: string;
  scrollingSuffix?: string;
  callPoints: string[];
}

function _TrainServiceAdditionalInfo({ service, worldlinePowered }: IProps) {
  const associatedServices = React.useMemo(
    () =>
      service.passengerCallPoints
        .map((s) => s.associations)
        .flat(1)
        .filter((a): a is IAssociation<AssociationCategory.Divide> => a.type === AssociationCategory.Divide)
        .map((a) => a.service),
    [JSON.stringify(service)]
  );

  const pageCount = worldlinePowered ? 1 : 2 + associatedServices.length;

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
        scrollingPrefix: `${pos} ${s.length ? `${s.length} ` : ''}coaches calling at${worldlinePowered ? '' : ':'}`,
      };
    });

    if (assocServices.length === 0) {
      // No splits
      return [
        {
          callPoints: ogServicePoints,
          scrollingPrefix: `Calling at${worldlinePowered ? '' : ':'}`,
        },
      ];
    } else {
      const ogLengthEnd = service.passengerCallPoints.at(-1)!!.length;
      return [
        {
          callPoints: ogServicePoints,
          scrollingPrefix: `Front ${ogLengthEnd ? `${ogLengthEnd} ` : ''}coaches calling at${worldlinePowered ? '' : ':'}`,
        },
        ...assocServices,
      ];
    }
  }, [JSON.stringify(service.passengerCallPoints), JSON.stringify(associatedServices.map((a) => a.passengerCallPoints)), worldlinePowered]);

  const serviceInfo = React.useMemo(() => getServiceInfo(service, worldlinePowered), [JSON.stringify(service), worldlinePowered]);
  const serviceInfoPrefix = React.useMemo(() => getServiceInfoPrefix(service, worldlinePowered), [JSON.stringify(service), worldlinePowered]);

  console.log(callingPointPages);
  console.log(service);

  return (
    <div
      css={{
        height: 'var(--row-height)',
        position: 'relative',
        clipPath: 'inset(-1px)',
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
          css={{ minWidth: '100%', whiteSpace: 'preserve' }}
          alwaysScroll
          callCompleteIfNotScrolling={8_000}
          onComplete={() => {
            shownPage === 0 && nextPage();
            // Stop animation
            console.log('next from info');

            return true;
          }}
          slideDownText={serviceInfoPrefix}
        >
          {serviceInfo}
          {worldlinePowered &&
            callingPointPages.map((page, i) => (
              <React.Fragment key={i}>
                {' '}
                <span>
                  {page.scrollingPrefix}{' '}
                  {page.callPoints.map((p, i) => (
                    <CallingPoint key={i} text={p} worldlinePowered />
                  ))}{' '}
                  {page.scrollingSuffix}
                </span>
              </React.Fragment>
            ))}
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

const TrainServiceAdditionalInfo = React.memo(_TrainServiceAdditionalInfo, (prev, next) => {
  console.log('train service additional info changed, but not rerendering');

  return true;
});

export default TrainServiceAdditionalInfo;
