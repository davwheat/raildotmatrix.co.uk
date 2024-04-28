import React from 'react';

import NoServicesMessage from './NoServicesMessage';
import Clock from './Clock';
import TrainServices from './TrainServices';

import './css/font.less';

import { css } from '@emotion/react';

import { processServices } from '../../../api/ProcessServices';
import { isValidResponseApi, useServiceInformation } from '../../../hooks/useServiceInformation';

const BOARD_WIDTH = 2250;
const BOARD_HEIGHT = 470;

const X_PAD = 24;
const Y_PAD_TOP = 32;
const Y_PAD_BOTTOM = 16;

const X_PAD_CASING = X_PAD + 78;
const Y_PAD_TOP_CASING = Y_PAD_TOP + 74;
const Y_PAD_BOTTOM_CASING = Y_PAD_BOTTOM + 74;

interface IProps {
  platforms?: string[];
  station: string;
  useLegacyTocNames?: boolean;
  showUnconfirmedPlatforms: boolean;
  hasCasing: boolean;
}

const base = css`
  --board-width: ${BOARD_WIDTH}px;
  --board-height: ${BOARD_HEIGHT}px;

  --board-height-inner: ${BOARD_HEIGHT - Y_PAD_TOP - Y_PAD_BOTTOM}px;
  --row-height: calc(var(--board-height-inner) / 4);

  width: var(--board-width);
  height: var(--board-height);
  background: #000;
  padding: ${Y_PAD_TOP}px ${X_PAD}px ${Y_PAD_BOTTOM}px ${X_PAD}px;

  user-select: none;

  font-family: 'DataDisplay';
  color: hsl(39, 100%, 45%);
  font-size: 40px;

  position: relative;

  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  display: flex;
  flex-direction: column;
`;

export default function FullBoard({ station, platforms, useLegacyTocNames, showUnconfirmedPlatforms, hasCasing }: IProps) {
  const [trainData] = useServiceInformation(station);

  const services = isValidResponseApi(trainData)
    ? processServices(trainData.trainServices!!, platforms ?? null, !!useLegacyTocNames, station, showUnconfirmedPlatforms).filter(
        (s) => !s.hasDeparted
      )
    : null;

  const css = [
    base,
    hasCasing && {
      '--board-width': `${BOARD_WIDTH + 2 * (X_PAD_CASING - X_PAD)}px`,
      '--board-height': `${BOARD_HEIGHT + Y_PAD_TOP_CASING + Y_PAD_BOTTOM_CASING - Y_PAD_TOP - Y_PAD_BOTTOM}px`,
      padding: `${Y_PAD_TOP_CASING}px ${X_PAD_CASING}px ${Y_PAD_BOTTOM_CASING}px ${X_PAD_CASING}px`,
    },
  ];

  if (!services || services.length === 0) {
    return (
      <article css={css}>
        <NoServicesMessage />
        <Clock />
      </article>
    );
  }

  return (
    <article css={css}>
      <TrainServices services={services} />
      <Clock />
    </article>
  );
}
