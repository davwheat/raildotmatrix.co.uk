import React, { useCallback, useEffect, useState } from 'react';

import GetNextTrainsAtStationStaff from '../../../api/GetNextTrainsAtStationStaff';
import CallNreMessage from './CallNreMessage';
import Clock from './Clock';
import TrainServices from './TrainServices';

import './css/board.less';

import { processServices } from '../../../api/ProcessServices';
import { isValidResponseApi, useServiceInformation } from '../../../hooks/useServiceInformation';

interface IProps {
  platforms?: string[];
  station: string;
  animateClockDigits?: boolean;
  useLegacyTocNames?: boolean;
}

export default function FullBoard({ station, animateClockDigits, platforms, useLegacyTocNames }: IProps) {
  const [trainData] = useServiceInformation(station);

  const services = isValidResponseApi(trainData)
    ? processServices(trainData.trainServices!!, platforms ?? null, !!useLegacyTocNames, station).filter((s) => !s.hasDeparted)
    : null;

  if (!services || services.length === 0) {
    return (
      <article className="dot-matrix">
        <CallNreMessage />
        <Clock animateDigits={animateClockDigits} />
      </article>
    );
  }

  return (
    <article className="dot-matrix">
      <TrainServices services={services} />
      <Clock animateDigits={animateClockDigits} />
    </article>
  );
}
