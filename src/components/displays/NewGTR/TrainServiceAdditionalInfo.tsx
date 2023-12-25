import React from 'react';

import SlideyScrollText from './SlideyScrollText';
import dayjs from 'dayjs';

import type { IMyTrainService } from './TrainServices';

interface IProps {
  service: IMyTrainService;
}

export default function TrainServiceAdditionalInfo({ service }: IProps) {
  const callingPoints = service.passengerCallPoints.map(
    (p, i): React.ReactNode => (
      <span key={i} className="callingAtPoint">
        <span className="name">{p.name}</span>
        <span className="time"> ({p.estimatedArrival ? dayjs(p.estimatedArrival).format('HH:mm') : dayjs(p.scheduledArrival).format('HH:mm')})</span>
      </span>
    )
  );

  return (
    <div className="trainServiceAdditional">
      <div className="callingAt">Calling at:</div>
      <SlideyScrollText>{callingPoints}</SlideyScrollText>
    </div>
  );
}
