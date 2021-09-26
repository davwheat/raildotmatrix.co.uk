import React, { useState, useRef, useEffect } from 'react';

import useInterval from '../../../hooks/useInterval';

const UseCallingAtFixed = false;

export default function ScrollingInfo({ trainData: train }) {
  const [activeAnimation, setActiveAnimation] = useState(null);
  const [shouldLeave, setShouldLeave] = useState(false);

  const intermediaryStopsRef = useRef(null);
  const trainInfoScrollerRef = useRef(null);
  const callingAtTextRef = useRef(null);

  useInterval(() => {
    if (activeAnimation === 'callingAt__scroll' && UseCallingAtFixed) {
      if (intermediaryStopsRef.current.getBoundingClientRect().left < 0 + 48) {
        callingAtTextRef.current.style.position = 'fixed';
        callingAtTextRef.current.style.left = `${48 - 4 - intermediaryStopsRef.current.getBoundingClientRect().left}px`;
        callingAtTextRef.current.style.background = '#030303';
        callingAtTextRef.current.style.zIndex = '100';
        callingAtTextRef.current.style.paddingLeft = '48px';
        callingAtTextRef.current.style.paddingRight = '16px';
      } else {
        callingAtTextRef.current.style.position = null;
        callingAtTextRef.current.style.left = null;
        callingAtTextRef.current.style.background = null;
        callingAtTextRef.current.style.zIndex = null;
      }
    }
  }, 15);

  const IS_OR_WAS = train.isCancelled ? 'was' : 'is';

  const { operator: toc, length: coachCount, betweenStations } = train;

  let departureStation = '',
    location = null,
    otherMessages = null;

  train.origin.forEach((origin, i) => {
    if (i) departureStation += ` and ${origin.locationName}`;
    else departureStation += origin.locationName;
  });

  const intermediaryStops = train.subsequentCallingPoints
    ? train.subsequentCallingPoints[0].callingPoint.reduce((stops, thisStop) => {
        return [
          ...stops,
          {
            location: thisStop.locationName,
            eta: thisStop.et === 'On time' ? thisStop.st : thisStop.et,
          },
        ];
      }, [])
    : null;

  if (intermediaryStops && intermediaryStops[0].eta === null && !shouldLeave) setShouldLeave(true);

  if (betweenStations && !shouldLeave) {
    if (betweenStations.length > 1) location = `This train ${IS_OR_WAS} currently between ${betweenStations[0]} and ${betweenStations[1]}.`;
    else if (betweenStations.length === 1) location = `This train is currently at ${betweenStations[0]}.`;
  }

  const callingAtScrollDelay = 750;

  let callingAtScrollTime = 0,
    trainInfoScrollTime = 0;

  if (intermediaryStopsRef.current && !shouldLeave) {
    callingAtScrollTime = Math.ceil((intermediaryStopsRef.current.offsetWidth + window.innerWidth) / 525);
  }

  if (trainInfoScrollerRef.current && !shouldLeave) {
    trainInfoScrollTime = Math.ceil((trainInfoScrollerRef.current.offsetWidth + window.innerWidth) / 475);
  }

  const beginTimeouts = React.useCallback(() => {
    setActiveAnimation('trainInfo__scroll');
    console.log('Scrolling train details... Time: ', trainInfoScrollTime);

    const x = setTimeout(() => {
      setActiveAnimation('callingAt__intro');

      console.log("Performing intro to 'calling at'. Time: ", callingAtScrollDelay / 1000);
    }, trainInfoScrollTime * 1000);

    const y = setTimeout(() => {
      setActiveAnimation('callingAt__scroll');

      console.log('Scrolling stopping points... Time: ', callingAtScrollTime);
    }, trainInfoScrollTime * 1000 + callingAtScrollDelay);

    return () => {
      clearTimeout(x);
      clearTimeout(y);
    };
  }, [trainInfoScrollTime, callingAtScrollDelay, callingAtScrollTime]);

  if (train.isCancelled) {
    if (train.cancelReason) otherMessages = train.cancelReason;

    if (otherMessages && !otherMessages.endsWith('.')) otherMessages += '.';
  } else if (train.delayReason && train.etd !== 'On time') {
    otherMessages = train.delayReason;

    if (!otherMessages.endsWith('.')) otherMessages += '.';
  }

  useEffect(() => {
    const clearTs = beginTimeouts();

    const key = setInterval(beginTimeouts, callingAtScrollTime * 1000 + callingAtScrollDelay + trainInfoScrollTime * 1000);

    return () => {
      clearInterval(key);
      clearTs();
    };
  }, [beginTimeouts]);

  return (
    <div className="train--details">
      <p
        className="train--details__scroller"
        ref={trainInfoScrollerRef}
        style={{
          animationName: activeAnimation === 'trainInfo__scroll' ? 'scrollByWidth1' : '',
          animationDuration: activeAnimation === 'trainInfo__scroll' ? `${trainInfoScrollTime}s` : '0s',
        }}
      >
        This {IS_OR_WAS} {toc ? `a ${toc}` : `the`} service
        {coachCount ? ` formed of ${coachCount} coaches` : ''}.{location ? ` ${location}` : ''}
        {otherMessages ? ` ${otherMessages}` : ''}
        {departureStation ? ` This ${IS_OR_WAS} the service from ${departureStation}.` : ''}
      </p>

      {intermediaryStops && (
        <p
          ref={intermediaryStopsRef}
          className="train--details__intermediary-stops"
          data-cancelled={train.isCancelled}
          style={{
            animationName: activeAnimation === 'callingAt__scroll' ? (train.isCancelled ? 'scrollByWidth2cancelled' : 'scrollByWidth2') : '',
            animationDuration: activeAnimation === 'callingAt__scroll' ? `${callingAtScrollTime}s` : `0s`,
            transform: activeAnimation === 'callingAt__intro' ? `translateX(calc(1920px - 48px - ${train.isCancelled ? `14.5ch` : `11ch`}))` : null,
          }}
        >
          <span className="train--details__calling-at" ref={callingAtTextRef}>
            {train.isCancelled ? `Was calling at:` : `Calling at:`}
          </span>
          <IntermediaryStops intermediaryStops={intermediaryStops} train={train} />
        </p>
      )}
    </div>
  );
}

function getStopTime(intermediaryStop, isCancelled) {
  if (isCancelled || intermediaryStop.eta === 'Delayed') return '';

  return ` (${intermediaryStop.eta})`;
}

function createStop(intermediaryStop, isCancelled, stopIndex, totalStops) {
  if (totalStops === 1) {
    return `${intermediaryStop.location} only${getStopTime(intermediaryStop, isCancelled)}`;
  }

  // No comma if 2nd to last
  if (stopIndex + 2 === totalStops) return `${intermediaryStop.location}${getStopTime(intermediaryStop, isCancelled)} `;

  // No comma, and prepend and if last
  if (stopIndex + 1 === totalStops) return `and ${intermediaryStop.location}${getStopTime(intermediaryStop, isCancelled)}.`;

  return `${intermediaryStop.location}${getStopTime(intermediaryStop, isCancelled)}, `;
}

const IntermediaryStops = ({ intermediaryStops, train }) => {
  const isCancelled = train.isCancelled;

  let stopsText = '';

  if (intermediaryStops.length === 1) {
    return <span className="train--details__intermediary-stop-list">{createStop(intermediaryStops[0], isCancelled, 0, 1)}</span>;
  }

  const length = intermediaryStops.length;

  stopsText = intermediaryStops.reduce((prev, curr, i) => {
    return `${prev}${createStop(curr, isCancelled, i, length)}`;
  }, '');

  return <span className="train--details__intermediary-stop-list">{stopsText}</span>;
};
