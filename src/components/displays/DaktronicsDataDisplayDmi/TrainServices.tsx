import React, { useEffect, useRef, useState } from 'react';

import TrainService from './TrainService';
import SwapBetween from './SwapBetween';

import { keyframes } from '@emotion/react';

import type { IMyTrainService } from '../../../api/ProcessServices';

interface IProps {
  services: IMyTrainService[];
  worldlinePowered: boolean;
}

const clipService = keyframes`
  0% {
    clip-path: polygon(0 0, 100% 0, 100% var(--row-height), 0 var(--row-height));
  }

  75%,
  100% {
    clip-path: polygon(
      calc(var(--board-width) - var(--pad-right) - var(--pad-left) + 100px) 0,
      calc(var(--board-width) - var(--pad-right) - var(--pad-left) + 100px) 0,
      calc(var(--board-width) - var(--pad-right) - var(--pad-left) + 100px) var(--row-height),
      calc(var(--board-width) - var(--pad-right) - var(--pad-left) + 100px) var(--row-height)
    )
  }
`;

const spinnerMovement = keyframes`
  0% {
    transform: translateX(0);
  }

  75%,
  100% {
    transform: translateX(calc(var(--board-width) - var(--pad-right) - var(--pad-left) + 100px));
  }
`;

// Custom font chars for the clear-down
const spinnerText = keyframes`
  0% {
    content: '×';
  }

  50%,
  100% {
    content: '÷';
  }
`;

const slideUpFromBottom = keyframes`
  0% {
    transform: translateY(calc(3 * var(--row-height)));
  }

  100% {
    transform: translateY(0);
  }
`;

const slideUpFromCurrentRow = keyframes`
  0% {
    transform: translateY(var(--row-height));
  }

  100% {
    transform: translateY(0);
  }
`;

export default function TrainServices({ services, worldlinePowered }: IProps) {
  const firstService: IMyTrainService | undefined = services[0];
  const secondService: IMyTrainService | undefined = services[1];
  const thirdService: IMyTrainService | undefined = services[2];

  const firstServiceLastRender = useRef<IMyTrainService | undefined>(firstService);
  const firstServiceRef = useRef<HTMLDivElement>(null);

  const [animateServiceOut, setAnimateServiceOut] = useState<IMyTrainService | null>(null);
  const [animateServiceIn, setAnimateServiceIn] = useState<boolean>(true);

  if (firstService?.id !== firstServiceLastRender.current?.id) {
    console.log('first service changed -- animating last service out');

    firstServiceLastRender.current && setAnimateServiceOut(firstServiceLastRender.current);
    firstServiceLastRender.current = firstService;
  }

  useEffect(() => {
    if (animateServiceOut) {
      const animEnd = () => {
        console.log('clear down animation end');
        if (firstService) setAnimateServiceIn(true);
        setAnimateServiceOut(null);
      };

      firstServiceRef.current?.addEventListener('animationend', animEnd);

      return () => {
        console.log('clear down cleanup');

        firstServiceRef.current?.removeEventListener('animationend', animEnd);
      };
    } else if (animateServiceIn) {
      const animEnd = () => {
        console.log('post clear down slide in animation end');
        setAnimateServiceIn(false);
      };

      firstServiceRef.current?.addEventListener('animationend', animEnd);

      return () => {
        console.log('post clear down slide in cleanup');
        firstServiceRef.current?.removeEventListener('animationend', animEnd);
      };
    }
  }, [firstService, firstServiceLastRender, animateServiceIn, animateServiceOut, setAnimateServiceOut, setAnimateServiceIn]);

  if (animateServiceOut) {
    console.log('rendering animating service out');

    return (
      <>
        <TrainService
          ref={firstServiceRef}
          ordinal="1st"
          service={animateServiceOut}
          tripleLineIfRequired
          clipToFirstLine
          css={{
            animationName: clipService,
            animationDuration: 'var(--animation-duration)',
            animationDelay: 'var(--animation-delay)',
            animationTimingFunction: 'linear',
            animationFillMode: 'forwards',
            position: 'relative',

            '&, & ~ span': {
              '--animation-duration': '3500ms',
              '--animation-delay': '150ms',
            },
          }}
          worldlinePowered={worldlinePowered}
        />
        <span
          css={{
            height: 'var(--row-height)',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 'var(--pad-top)',
              left: 'var(--pad-left)',
              height: 'var(--row-height)',
              zIndex: 1,
              transform: 'translateX(-200%)',
              transformOrigin: 'left',
              animation: `${spinnerText} 200ms step-end infinite, ${spinnerMovement} var(--animation-duration) calc(100ms + var(--animation-delay)) linear infinite`,
            },
          }}
        />
        <div
          className="trainServiceAdditional"
          css={{
            height: 'var(--row-height)',
          }}
        />
      </>
    );
  } else if (animateServiceIn) {
    console.log('rendering animating service out');

    return (
      <>
        <div
          css={{
            position: 'relative',
            clipPath: `polygon(
              0 0,                            100% 0,                           100% calc(var(--row-height) - var(--background-row-y-offset)),      0 calc(var(--row-height) - var(--background-row-y-offset)),
              0 var(--row-height),            100% var(--row-height),           100% calc(2 * var(--row-height) - var(--background-row-y-offset)),  0 calc(2 * var(--row-height) - var(--background-row-y-offset)),
              0 calc(2 * var(--row-height)),  100% calc(2 * var(--row-height)), 100% calc(3 * var(--row-height) - var(--background-row-y-offset)),  0 calc(3 * var(--row-height) - var(--background-row-y-offset))
            )`,
          }}
        >
          <TrainService
            ref={firstServiceRef}
            ordinal="1st"
            service={firstService}
            tripleLineIfRequired
            clipToFirstLine
            css={{
              animationName: slideUpFromBottom,
              animationDuration: '1.6s',
              animationTimingFunction: 'linear',
              animationFillMode: 'forwards',

              position: 'relative',
            }}
            worldlinePowered={worldlinePowered}
          />
        </div>
        <span css={{ height: 'var(--row-height)' }} />
        <div className="trainServiceAdditional" css={{ height: 'var(--row-height)' }} />
      </>
    );
  }

  console.log('services rerendered!');

  const isSecondSplitting = secondService?.destinations.length > 1;
  const isThirdSplitting = thirdService?.destinations.length > 1;

  console.log(firstService);
  console.log(secondService);
  console.log(thirdService);

  return (
    <>
      {firstService && (
        <TrainService ordinal="1st" service={firstService} tripleLineIfRequired showAdditionalDetails worldlinePowered={worldlinePowered} />
      )}

      {!isSecondSplitting ? (
        <>
          {services.length >= 3 && !isThirdSplitting ? (
            <SwapBetween
              interval={12_000}
              alwaysSlideUp
              css={{
                clipPath: `polygon(0 0, 100% 0, 100% calc(var(--row-height) - var(--background-row-y-offset)), 0 calc(var(--row-height) - var(--background-row-y-offset)))`,
              }}
            >
              {secondService && <TrainService ordinal="2nd" service={secondService} worldlinePowered={worldlinePowered} />}
              {thirdService && <TrainService ordinal="3rd" service={thirdService} worldlinePowered={worldlinePowered} />}
            </SwapBetween>
          ) : (
            <>
              {secondService ? (
                <TrainService
                  style={{
                    animationName: slideUpFromCurrentRow,
                    animationDelay: '100ms',
                    animationDuration: '400ms',
                    animationFillMode: 'forwards',
                    animationTimingFunction: 'linear',
                  }}
                  ordinal="2nd"
                  service={secondService}
                  worldlinePowered={worldlinePowered}
                />
              ) : (
                // Spacer row
                <div id="space-filler" css={{ height: 'var(--row-height)' }} />
              )}
            </>
          )}
        </>
      ) : (
        // Spacer row
        <div id="space-filler" css={{ height: 'var(--row-height)' }} />
      )}
    </>
  );
}
