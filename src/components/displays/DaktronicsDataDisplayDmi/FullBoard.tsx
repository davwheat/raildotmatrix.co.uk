import React from 'react';

import NoServicesMessage from './NoServicesMessage';
import Clock from './Clock';
import TrainServices from './TrainServices';

import './css/board.less';

import { processServices } from '../../../api/ProcessServices';
import { isValidResponseApi, useServiceInformation } from '../../../hooks/useServiceInformation';

interface IProps {
  platforms?: string[];
  station: string;
  useLegacyTocNames?: boolean;
  showUnconfirmedPlatforms: boolean;
}

export default function FullBoard({ station, platforms, useLegacyTocNames, showUnconfirmedPlatforms }: IProps) {
  const [trainData] = useServiceInformation(station);

  const services = isValidResponseApi(trainData)
    ? processServices(trainData.trainServices!!, platforms ?? null, !!useLegacyTocNames, station, showUnconfirmedPlatforms).filter(
        (s) => !s.hasDeparted
      )
    : null;

  if (!services || services.length === 0) {
    return (
      <article className="daktronics-data-display-dot-matrix">
        <NoServicesMessage />
        <Clock />
      </article>
    );
  }

  return (
    <article className="daktronics-data-display-dot-matrix">
      <TrainServices services={services} />
      <Clock />
    </article>
  );
}
