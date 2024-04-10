import React from 'react';

import NoServicesMessage from './NoServicesMessage';
import Clock from './Clock';
import TrainServices from './TrainServices';

// import './css/board.less';
import './css/font.less';

import { css } from '@emotion/react';

import { processServices } from '../../../api/ProcessServices';
import { isValidResponseApi, useServiceInformation } from '../../../hooks/useServiceInformation';

interface IProps {
  platforms?: string[];
  station: string;
  useLegacyTocNames?: boolean;
  showUnconfirmedPlatforms: boolean;
}

const base = css`
  --board-width: 2200px;
  --board-height: 470px;
  --row-height: 120px;

  width: var(--board-width);
  height: var(--board-height);
  background: #000;
  padding: 24px;

  user-select: none;

  font-family: 'DataDisplay';
  color: hsl(39, 100%, 45%);
  font-size: 72px;

  position: relative;

  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  display: flex;
  flex-direction: column;
  gap: var(--gap);
`;

export default function FullBoard({ station, platforms, useLegacyTocNames, showUnconfirmedPlatforms }: IProps) {
  const [trainData] = useServiceInformation(station);

  const services = isValidResponseApi(trainData)
    ? processServices(trainData.trainServices!!, platforms ?? null, !!useLegacyTocNames, station, showUnconfirmedPlatforms).filter(
        (s) => !s.hasDeparted
      )
    : null;

  if (!services || services.length === 0) {
    return (
      <article css={base}>
        <NoServicesMessage />
        <Clock />
      </article>
    );
  }

  return (
    <article css={base}>
      <TrainServices services={services} />
      <Clock />
    </article>
  );
}
