import React from 'react';
import { combineLocations } from './combineLocations';

import ArrowSVG from './css/board/arrow.svg';

import './css/board/secondaryTrainData.less';
import FadeBetween from './FadeBetween';
import SlideyScrollText from './SlideyScrollText';

import dayjs from 'dayjs';
import dayjsUtc from 'dayjs/plugin/utc';
import dayjsTz from 'dayjs/plugin/timezone';

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTz);

import type { IMyTrainService } from '../../../api/ProcessServices';

function ordinal(number: number) {
  const ordinals = ['th', 'st', 'nd', 'rd'];
  const toHundredNum = number % 100;
  const ord = ordinals[(toHundredNum - 20) % 10] || ordinals[toHundredNum] || ordinals[0];

  return (
    <>
      {number}
      <sup>{ord}</sup>
    </>
  );
}

export default function SecondaryTrainData({ train, position }: { train: IMyTrainService; position: number }) {
  const finalColumnElements: React.ReactNode[] = [];

  finalColumnElements.push(<span className={train.cancelled ? 'flash' : ''}>{train.displayedDepartureTime('Exp ')}</span>);

  if ((train.length || 0) > 0 && !train.cancelled) {
    finalColumnElements.push(
      <>
        {train.length}
        {train.length === 1 ? ' carriage' : ' carriages'}
      </>
    );
  }

  return (
    <div className="secondaryTrain">
      <div className="position">{ordinal(position)}</div>

      <div aria-hidden="true" className="arrow">
        &nbsp;
        <img src={ArrowSVG} />
      </div>

      <div className="time">{dayjs(train.scheduledDeparture).format('HH:mm')}</div>

      <SlideyScrollText className="dest" classNameInner="dest-inner">
        {combineLocations(train.destinations)}
      </SlideyScrollText>

      <div className="status" data-on-time={`${!train.isDelayed() && !train.cancelled}`}>
        <FadeBetween elements={finalColumnElements} />
      </div>
    </div>
  );
}
