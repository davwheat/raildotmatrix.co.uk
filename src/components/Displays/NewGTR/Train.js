import React, { useState } from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';

function Train(props) {
  const {
    position,
    scheduledTime,
    destination,
    intermediaryStops,
    expectedTime,
    status,
    betweenStations,
    leftCallback,
    isCancelled,
    via: destVia,
  } = props;

  let currentStatus = '',
    posStr = '';

  const [shouldLeave, setShouldLeave] = useState(false);
  const [detailsOnLastRender, setDetailsOnLastRender] = useState(props);

  if (detailsOnLastRender !== props) {
    setShouldLeave(false);
    setDetailsOnLastRender(props);
    leftCallback(false);
  }

  if (intermediaryStops && intermediaryStops[0].eta === null && !shouldLeave) {
    setShouldLeave(true);
    leftCallback(true);
  }

  if (status) {
    currentStatus = status;
  } else {
    if (shouldLeave) {
      currentStatus = 'Arrived';
    } else if (expectedTime === scheduledTime) {
      currentStatus = 'On time';
    } else if (isCancelled) {
      currentStatus = 'Cancelled';
    } else if (expectedTime === 'Delayed') {
      currentStatus = 'Delayed';
    } else {
      currentStatus = expectedTime === 'On time' ? 'On time' : 'Expt ' + expectedTime.replace(':', '');
    }
  }

  switch (position) {
    case 1:
      posStr = '1st';
      break;
    case 2:
      posStr = '2nd';
      break;
    case 3:
      posStr = '3rd';
      break;

    default:
      posStr = '???';
      break;
  }

  return (
    <>
      <div className={`train ${position > 1 && `swap-out`}`}>
        {shouldLeave && (
          <div className="train--spinner">
            <span>l</span>
          </div>
        )}
        <span className="train--position">{posStr}</span>
        <span className="train--scheduled-time">{scheduledTime.replace(':', '')}</span>
        <span
          className={clsx('train--destination', {
            'train--destination__with-via': !!destVia,
          })}
        >
          <span
            className={clsx('train--destination__actual', {
              'swap-out': !!destVia,
            })}
          >
            {destVia ? destination + ' via' : destination}
          </span>
          {destVia && <span className="train--destination__via swap-out">{destVia}</span>}
        </span>
        <span className="train--status">{currentStatus}</span>
      </div>
    </>
  );
}

Train.propTypes = {
  position: PropTypes.number.isRequired,
  scheduledTime: PropTypes.string.isRequired,
  destination: PropTypes.string.isRequired,
  intermediaryStops: PropTypes.arrayOf(
    PropTypes.shape({
      location: PropTypes.string.isRequired,
      eta: PropTypes.string,
    })
  ),
  expectedTime: PropTypes.string.isRequired,
  status: PropTypes.string,
  otherMessages: PropTypes.string,
  toc: PropTypes.string.isRequired,
  coachCount: PropTypes.number,
  departureStation: PropTypes.string,
};

export default React.memo(Train);
