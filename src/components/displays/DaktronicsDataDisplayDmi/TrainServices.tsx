import React, { useEffect, useRef, useState } from 'react';

import TrainService from './TrainService';
import SwapBetween from './SwapBetween';

import { keyframes } from '@emotion/react';

import type { IMyTrainService } from '../../../api/ProcessServices';

interface IProps {
  services: IMyTrainService[];
}

const clipService = keyframes`
  0% {
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
  }

  75%,
  100% {
    clip-path: polygon(
      calc(var(--board-width) - var(--pad-right) - var(--pad-left) + 100px) 0,
      calc(var(--board-width) - var(--pad-right) - var(--pad-left) + 100px) 0,
      calc(var(--board-width) - var(--pad-right) - var(--pad-left) + 100px) 100%,
      calc(var(--board-width) - var(--pad-right) - var(--pad-left) + 100px) 100%
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

export default function TrainServices({ services }: IProps) {
  const firstService: IMyTrainService | undefined = services[0];
  const secondService: IMyTrainService | undefined = services[1];
  const thirdService: IMyTrainService | undefined = services[2];

  const firstServiceLastRender = useRef<IMyTrainService | undefined>(firstService);
  const firstServiceRef = useRef<HTMLDivElement>(null);

  const [animateServiceOut, setAnimateServiceOut] = useState<IMyTrainService | null>(null);

  if (firstService?.id !== firstServiceLastRender.current?.id) {
    console.log('first service changed -- animating last service out');

    firstServiceLastRender.current && setAnimateServiceOut(firstServiceLastRender.current);
    firstServiceLastRender.current = firstService;
  }

  useEffect(() => {
    if (animateServiceOut) {
      const animEnd = () => {
        console.log('slide out animation end');
        setAnimateServiceOut(null);
      };

      firstServiceRef.current?.addEventListener('animationend', animEnd);

      return () => {
        console.log('cleanup');

        firstServiceRef.current?.removeEventListener('animationend', animEnd);
      };
    }
  }, [firstService, firstServiceLastRender, animateServiceOut, setAnimateServiceOut]);

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
            position: 'relative',

            '&, & ~ span': {
              '--animation-duration': '3500ms',
              '--animation-delay': '150ms',
            },
          }}
        />
        <span
          css={{
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 'var(--pad-top)',
              left: 'var(--pad-left)',
              height: 'var(--row-height)',
              zIndex: 1,
              transform: 'translateX(-200%)',
              transformOrigin: 'left',
              animation: `${spinnerText} 300ms step-end infinite, ${spinnerMovement} var(--animation-duration) calc(100ms + var(--animation-delay)) linear infinite`,
            },
          }}
        />
        <div className="trainServiceAdditional" />
      </>
    );
  }

  console.log('services rerendered!');

  const isSecondSplitting = secondService?.destinations.length > 1;
  const isThirdSplitting = thirdService?.destinations.length > 1;

  return (
    <>
      {firstService && <TrainService ordinal="1st" service={firstService} tripleLineIfRequired showAdditionalDetails />}

      {!isSecondSplitting && (
        <>
          {services.length >= 3 && !isThirdSplitting ? (
            <SwapBetween interval={12_000} alwaysSlideUp>
              {secondService && <TrainService ordinal="2nd" service={secondService} />}
              {thirdService && <TrainService ordinal="3rd" service={thirdService} />}
            </SwapBetween>
          ) : (
            !isSecondSplitting && <>{secondService && <TrainService ordinal="2nd" service={secondService} />}</>
          )}
        </>
      )}
    </>
  );
}
