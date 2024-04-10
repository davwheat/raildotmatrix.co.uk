import React, { useEffect } from 'react';

import SlideyScrollText from './SlideyScrollText';
import clsx from 'clsx';

import { keyframes, css } from '@emotion/react';

import { AssociationCategory } from '../../../../functions/api/getServices';
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
  height: 1.3em;
  display: flex;
  top: 0;
  left: 0;
  right: 0;

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

  if (service.cancelled) {
    if (service.cancelReason) portions.push(service.cancelReason);
  } else if (service.isDelayed()) {
    if (service.delayReason) portions.push(service.delayReason);
  }

  return portions.join(' ');
}

interface InfoPage {
  prefix?: string;
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
        callPoints: [`${pos} ${s.length ? `${s.length} ` : ''}coaches: `, ...pointsToDivide, ...stops.map((p) => p.name)],
      };
    });

    if (assocServices.length === 0) {
      // No splits
      return [
        {
          callPoints: ['Calling at ', ...ogServicePoints, !!service.length ? `Formed of ${length} coaches.` : ''],
        },
      ];
    } else {
      const ogLengthEnd = service.passengerCallPoints.at(-1)!!.length;
      return [{ callPoints: [`Front ${ogLengthEnd ? `${ogLengthEnd} ` : ''}coaches: `, ...ogServicePoints] }, ...assocServices];
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
          {page.prefix && (
            <div
              css={{
                minWidth: 'calc(var(--ordinal-width) + var(--std-width) + var(--gap) * 2)',
                paddingRight: 16,
                flexShrink: 0,
              }}
            >
              {page.prefix}
            </div>
          )}
          {shownPage === i + 1 && (
            <CallingPoints
              pointsText={page.callPoints}
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

function _CallingPoints({ pointsText, onComplete }: { pointsText: string[]; onComplete?: () => void }) {
  console.log('calling points rendered');
  return (
    <SlideyScrollText
      onComplete={() => {
        onComplete?.();

        // Stop animation
        return true;
      }}
    >
      {pointsText.map((p, i) => (
        <span
          key={i}
          css={{
            // First child is always the "Calling at" text

            '&:not(:last-child):not(:first-child)::after': {
              content: '", "',
            },

            // Only one calling point
            '&:nth-child(2):last-child::after': {
              textTransform: 'unset',
              content: '" only."',
            },

            '&:not(:nth-child(2)):last-child::after': {
              content: '"."',
            },

            '&:last-child': {
              textTransform: 'uppercase',
            },
          }}
        >
          {p}
        </span>
      ))}
    </SlideyScrollText>
  );
}

const CallingPoints = React.memo(_CallingPoints, (prev, next) => {
  console.log('calling points props changed, but not rerendering');

  return true;
});
