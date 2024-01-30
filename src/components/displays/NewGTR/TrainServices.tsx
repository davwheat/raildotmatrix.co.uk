import React from 'react';

import TrainService from './TrainService';

import SwapBetween from './SwapBetween';
import Separator from './Separator';

import type { IMyTrainService } from '../../../api/ProcessServices';

interface IProps {
  services: IMyTrainService[];
}

export default function TrainServices({ services }: IProps) {
  return (
    <>
      {services[0] && <TrainService ordinal="1st" service={services[0]} showAdditionalDetails />}

      <Separator />

      {services.length >= 3 ? (
        <SwapBetween interval={12_000}>
          {services[1] && <TrainService ordinal="2nd" service={services[1]} />}
          {services[2] && <TrainService ordinal="3rd" service={services[2]} />}
        </SwapBetween>
      ) : (
        <>{services[1] && <TrainService ordinal="2nd" service={services[1]} />}</>
      )}
    </>
  );
}
