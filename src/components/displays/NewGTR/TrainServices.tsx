import React, { useEffect, useRef, useState } from 'react';

import TrainService from './TrainService';

import SwapBetween from './SwapBetween';
import Separator from './Separator';

import type { IMyTrainService } from '../../../api/ProcessServices';

interface IProps {
  services: IMyTrainService[];
}

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

        window.setTimeout(() => setAnimateServiceOut(null), 250);
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
        <TrainService ref={firstServiceRef} ordinal="1st" service={animateServiceOut} className="slide-out-to-right" />
        <div className="trainServiceAdditional" />
        <Separator />
      </>
    );
  }

  console.log('services rerendered!');

  return (
    <>
      {firstService && <TrainService ordinal="1st" service={firstService} showAdditionalDetails />}

      <Separator />

      {services.length >= 3 ? (
        <SwapBetween interval={12_000}>
          {secondService && <TrainService ordinal="2nd" service={secondService} />}
          {thirdService && <TrainService ordinal="3rd" service={thirdService} />}
        </SwapBetween>
      ) : (
        <>{secondService && <TrainService ordinal="2nd" service={secondService} />}</>
      )}
    </>
  );
}
