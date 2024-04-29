import React, { useEffect, useRef, useState } from 'react';

import TrainService from './TrainService';
import SwapBetween from './SwapBetween';

import { keyframes } from '@emotion/react';

import type { IMyTrainService } from '../../../api/ProcessServices';

interface IProps {
  services: IMyTrainService[];
}

const slideOut = keyframes`
  0% {
    transform: translateX(0);
  }

  28.57%,
  100% {
    transform: translateX(var(--board-width));
  }
`;

export default function TrainServices({ services }: IProps) {
  const firstService: IMyTrainService | undefined = services[0];
  const secondService: IMyTrainService | undefined = services[1];
  const thirdService: IMyTrainService | undefined = services[2];

  const firstServiceLastRender = useRef<IMyTrainService | undefined>(firstService);
  const firstServiceRef = useRef<HTMLDivElement>(null);

  const [animateServiceOut, setAnimateServiceOut] = useState<IMyTrainService | null>(null);

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

    if (firstService?.id !== firstServiceLastRender.current?.id) {
      console.log('first service changed -- animating last service out');

      firstServiceLastRender.current && setAnimateServiceOut(firstServiceLastRender.current);
      firstServiceLastRender.current = firstService;
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
          css={{ animationName: slideOut, animationDuration: '1400ms', animationDelay: '150ms', animationTimingFunction: 'linear' }}
        />
        <div className="trainServiceAdditional" />
      </>
    );
  }

  console.log('services rerendered!');

  const isFirstSplitting = firstService?.destinations.length > 1;
  const isSecondSplitting = secondService?.destinations.length > 1;
  const isThirdSplitting = thirdService?.destinations.length > 1;

  return (
    <>
      {firstService && <TrainService ordinal="1st" service={firstService} tripleLine={isFirstSplitting} showAdditionalDetails />}

      {!isFirstSplitting && (
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
