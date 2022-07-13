import clsx from 'clsx';
import React from 'react';
import { TrainService } from '../../../api/GetNextTrainsAtStation';
import { combineLocations } from './combineLocations';

import './css/board/nextTrain.less';
import generateCallingPointsText from './generateCallingPointsText';
import SlideyScrollText from './SlideyScrollText';

const NextTrainTopRow = React.memo(({ std, sta, currentDestinations, destination, isCancelled, etd }) => {
  const isOnTime = etd === 'On time' || etd === std;

  return (
    <div className="top-row">
      <div className="time">{std ?? sta}</div>

      <SlideyScrollText className="dest" classNameInner="dest-inner" oneWayScroll>
        {combineLocations(currentDestinations ?? destination)}
      </SlideyScrollText>

      <div className="status" data-on-time={isOnTime}>
        <span className={isCancelled ? 'flash' : ''}>
          {isOnTime && 'On time'}
          {!isOnTime && isCancelled && 'Cancelled'}
          {!isOnTime && !isCancelled && `Exp ${etd}`}
        </span>
      </div>
    </div>
  );
});

const NextTrainThirdRow = React.memo(({ callingPointText, extraText }) => {
  return (
    <div className="third-row">
      <SlideyScrollText className="trainInfo" scrollSpeed={350} oneWayScroll>
        {callingPointText}
        {extraText && <>. {extraText.endsWith('.' ? extraText : <>{extraText}.</>)}</>}
      </SlideyScrollText>
    </div>
  );
});

export default function NextTrain({ nextTrain }: { nextTrain: TrainService }) {
  const isOnTime = nextTrain.etd === 'On time' || nextTrain.etd === nextTrain.std;

  return (
    <div className="nextTrain">
      <NextTrainTopRow
        std={nextTrain.std}
        sta={nextTrain.sta}
        currentDestinations={nextTrain.currentDestinations}
        destination={nextTrain.destination}
        isCancelled={nextTrain.isCancelled}
        etd={nextTrain.etd}
      />

      <div className="second-row">
        <div className="toc">{nextTrain.operator}</div>
        <div className="length">
          {(nextTrain.length || 0) === 1 && `1 carriage`}
          {(nextTrain.length || 0) > 1 && `${nextTrain.length} carriages`}

          {/*
            Sometimes data feed issues mean that the train length is 0.
            We should hide the length when this is the case.
           */}
          {/* {(nextTrain.length || 0) === 0 && `? carriages`} */}
        </div>
      </div>

      <NextTrainThirdRow
        callingPointText={generateCallingPointsText(nextTrain)}
        extraText={nextTrain.isCancelled ? nextTrain.cancelReason : isOnTime ? '' : nextTrain.delayReason}
      />
    </div>
  );
}
