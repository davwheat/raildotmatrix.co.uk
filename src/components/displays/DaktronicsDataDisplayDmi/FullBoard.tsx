import React from 'react';

import NoServicesMessage from './NoServicesMessage';
import Clock from './Clock';
import TrainServices from './TrainServices';

import './css/font.less';
import boardFill from './board-fill.svg';

import { css } from '@emotion/react';

import { processServices } from '../../../api/ProcessServices';
import { isValidResponseApi, useServiceInformation } from '../../../hooks/useServiceInformation';

const BOARD_WIDTH = 2250;
const BOARD_HEIGHT = 450;

const X_PAD = 24;
const Y_PAD_TOP = 32;
const Y_PAD_BOTTOM = 16;

const X_PAD_CASING = X_PAD + 78;
const Y_PAD_TOP_CASING = Y_PAD_TOP + 74;
const Y_PAD_BOTTOM_CASING = Y_PAD_BOTTOM + 94;

interface IProps {
  platforms?: string[];
  station: string;
  useLegacyTocNames?: boolean;
  showUnconfirmedPlatforms: boolean;
  hasCasing: boolean;
  worldlinePowered: boolean;
}

const base = css`
  --board-width: ${BOARD_WIDTH}px;
  --board-height: ${BOARD_HEIGHT}px;

  --board-height-inner: ${BOARD_HEIGHT - Y_PAD_TOP - Y_PAD_BOTTOM}px;
  --board-width-inner: ${BOARD_WIDTH - X_PAD - X_PAD}px;
  --row-height: calc(var(--board-height-inner) / 4);

  width: var(--board-width-inner);
  height: var(--board-height-inner);
  background: #000;
  box-sizing: content-box;

  --background-row-y-offset: 20px;

  background: linear-gradient(
      to bottom,
      transparent calc(var(--pad-top)),
      var(--dmi-row-background) calc(var(--pad-top) + 0.00001px),
      var(--dmi-row-background) calc(var(--pad-top) + var(--row-height) - var(--background-row-y-offset)),
      transparent calc(var(--pad-top) + 0.00001px + var(--row-height) - var(--background-row-y-offset)),
      transparent calc(var(--pad-top) + var(--row-height)),
      var(--dmi-row-background) calc(var(--pad-top) + 0.00001px + var(--row-height)),
      var(--dmi-row-background) calc(var(--pad-top) + (2 * var(--row-height)) - var(--background-row-y-offset)),
      transparent calc(var(--pad-top) + 0.00001px + (2 * var(--row-height)) - var(--background-row-y-offset)),
      transparent calc(var(--pad-top) + (2 * var(--row-height))),
      var(--dmi-row-background) calc(var(--pad-top) + 0.00001px + (2 * var(--row-height))),
      var(--dmi-row-background) calc(var(--pad-top) + (3 * var(--row-height)) - var(--background-row-y-offset)),
      transparent calc(var(--pad-top) + 0.00001px + (3 * var(--row-height)) - var(--background-row-y-offset))
    ),
    var(--dmi-background);

  --pad-top: ${Y_PAD_TOP}px;
  --pad-bottom: ${Y_PAD_BOTTOM}px;
  --pad-left: ${X_PAD}px;
  --pad-right: ${X_PAD}px;
  padding: var(--pad-top) var(--pad-right) var(--pad-bottom) var(--pad-left);

  user-select: none;

  font-family: 'DataDisplay';
  color: hsl(39, 100%, 45%);
  font-size: 40px;

  position: relative;

  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  display: flex;
  flex-direction: column;
`;

export default function FullBoard({ station, platforms, useLegacyTocNames, showUnconfirmedPlatforms, hasCasing, worldlinePowered }: IProps) {
  const [trainData] = useServiceInformation(station);

  const services = isValidResponseApi(trainData)
    ? processServices(trainData.trainServices!!, platforms ?? null, !!useLegacyTocNames, station, showUnconfirmedPlatforms).filter(
        (s) => !s.hasDeparted
      )
    : null;

  const css = [
    base,
    hasCasing && {
      'mask-image': `url(${boardFill})`,

      '--board-width': `${BOARD_WIDTH + 2 * (X_PAD_CASING - X_PAD)}px`,
      '--board-height': `${BOARD_HEIGHT + Y_PAD_TOP_CASING + Y_PAD_BOTTOM_CASING - Y_PAD_TOP - Y_PAD_BOTTOM}px`,
      '--pad-top': `${Y_PAD_TOP_CASING}px`,
      '--pad-bottom': `${Y_PAD_BOTTOM_CASING}px`,
      '--pad-left': `${X_PAD_CASING}px`,
      '--pad-right': `${X_PAD_CASING}px`,
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
      <TrainServices services={services} worldlinePowered={worldlinePowered} />
      <Clock />
    </article>
  );
}
