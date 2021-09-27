import React, { useState, useRef, useEffect } from 'react';

import LoadingMessage from './LoadingMessage';
import Train from './Train';

import GetNextTrainsAtStation from '../../../api/GetNextTrainsAtStation';

import './css/board.less';
import NoServicesMessage from './NoServicesMessage';
import Time from './Time';
import ScrollingInfo from './ScrollingInfo';
import ErrorMessage from './ErrorMessage';
import clsx from 'clsx';
import { debounce } from 'throttle-debounce';
import NRCCMessages from './NRCCMessage';

const FullBoard = ({ station, noBg }) => {
  const [TrainData, setTrainData] = useState(null);
  const [shouldShowScrollingInfo, setShouldShowScrollingInfo] = useState(true);

  function updateData() {
    const ac = new AbortController();

    GetNextTrainsAtStation(station, { minOffset: 0 }, ac).then((data) => {
      setTrainData(data);
    });

    return () => {
      ac.abort();
    };
  }

  if (TrainData === null) updateData();

  /**
   * @type {object[] | null}
   */
  const Services = TrainData && TrainData.trainServices ? TrainData.trainServices : null;

  const boardRef = useRef(null);

  function fillDiv(div) {
    const currentWidth = div.offsetWidth;
    const currentHeight = div.offsetHeight;

    const availableHeight = window.innerHeight;
    const availableWidth = window.innerWidth;

    const scale = Math.min(availableWidth / currentWidth, availableHeight / currentHeight);

    div.style.cssText = `
      transform: scale(${scale}) translateZ(0);
      transform-origin: 50% 50%;
    `;
  }

  // do it at least once
  if (boardRef.current) {
    fillDiv(boardRef.current);
  }

  useEffect(() => {
    let abort;

    // update every 30s
    const intKey = setInterval(() => {
      abort = updateData();
    }, 30 * 1000);

    return () => {
      clearInterval(intKey);
      abort && abort();
    };
  });

  useEffect(() => {
    const debouncedScale = debounce(250, () => {
      if (boardRef.current) {
        fillDiv(boardRef.current);
      }
    });

    function scale(e) {
      debouncedScale(e);
    }

    window.addEventListener('resize', scale);

    return () => {
      window.removeEventListener('resize', scale);
    };
  }, [boardRef]);

  function GetTrain(Services, i) {
    const train = Services[i];

    if (!train) return null;

    function leftCallback(left) {
      if (left) setShouldShowScrollingInfo(false);
      else setShouldShowScrollingInfo(true);
    }

    return (
      <Train
        via={train.destination[0].via}
        leftCallback={i === 0 ? leftCallback : () => {}}
        position={i + 1}
        scheduledTime={train.std}
        destination={train.destination[0].locationName}
        isCancelled={train.isCancelled}
        intermediaryStops={
          train.subsequentCallingPoints
            ? train.subsequentCallingPoints[0].callingPoint.reduce((stops, thisStop) => {
                return [
                  ...stops,
                  {
                    location: thisStop.locationName,
                    eta: thisStop.et === 'On time' ? thisStop.st : thisStop.et,
                  },
                ];
              }, [])
            : null
        }
        expectedTime={train.etd || 'Delayed'}
        toc={train.operator}
        coachCount={train.length}
        departureStation={train.origin.locationName}
      />
    );
  }

  return (
    <section ref={boardRef} className={clsx('dot-matrix', { 'dot-matrix--noBg': noBg })}>
      <div className="decoration">
        <span>Num</span>
        <span>Time</span>
        <span>Destination</span>
        <span>Est</span>
      </div>
      {TrainData === null && <LoadingMessage />}
      {TrainData !== null && TrainData.error === true && <ErrorMessage />}
      {TrainData !== null && !Services && !TrainData.error && <NoServicesMessage messages={TrainData.nrccMessages} />}
      {TrainData !== null && Services && !TrainData.error && (
        <>
          {GetTrain(Services, 0)}
          {shouldShowScrollingInfo ? (
            <ScrollingInfo key={Services[0].serviceIdGuid} trainData={Services[0]} />
          ) : (
            <p className="display--no-services"></p>
          )}
          {Services.length > 2 && (
            <div className="train--alternate-between">
              {GetTrain(Services, 1)}
              {GetTrain(Services, 2)}
            </div>
          )}
          {Services.length === 2 && GetTrain(Services, 1)}
          {Services.length === 1 && <NRCCMessages messages={TrainData.nrccMessages} />}
        </>
      )}
      <Time />
    </section>
  );
};

export default FullBoard;
