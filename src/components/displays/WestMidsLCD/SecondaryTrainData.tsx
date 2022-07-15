import React from 'react';
import { TrainService } from '../../../api/GetNextTrainsAtStation';
import { combineLocations } from './combineLocations';

import ArrowSVG from './css/board/arrow.svg';

import './css/board/secondaryTrainData.less';
import FadeBetween from './FadeBetween';
import SlideyScrollText from './SlideyScrollText';

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

export default function SecondaryTrainData({ train, position }: { train: TrainService; position: number }) {
  const { etd, std, sta } = train;
  const isOnTime = train.etd === 'On time' || etd === std;
  const isCancelled = train.isCancelled;

  const finalColumnElements: React.ReactNode[] = [];

  finalColumnElements.push(
    <span className={isCancelled ? 'flash' : ''}>
      {isOnTime && 'On time'}
      {!isOnTime && isCancelled && 'Cancelled'}
      {!isOnTime && !isCancelled && etd === 'Delayed' && etd}
      {!isOnTime && !isCancelled && etd !== 'Delayed' && `Exp ${etd}`}
    </span>
  );

  if ((train.length || 0) > 0 && !isCancelled) {
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

      <div className="time">{std ?? sta}</div>

      <SlideyScrollText className="dest" classNameInner="dest-inner" oneWayScroll>
        {combineLocations(train.currentDestinations ?? train.destination)}
      </SlideyScrollText>

      <div className="status" data-on-time={isOnTime && !isCancelled}>
        <FadeBetween elements={finalColumnElements} />
      </div>
    </div>
  );
}
