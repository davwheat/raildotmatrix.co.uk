import React, { useState } from 'react';
import useInterval from '../../../hooks/useInterval';
import dayjs from 'dayjs';

import dayjsUtc from 'dayjs/plugin/utc';
import dayjsTz from 'dayjs/plugin/timezone';

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTz);

export default function Time() {
  const [TimeString, setTimeString] = useState(null);

  function updateTime() {
    const time = dayjs().tz('Europe/London');

    setTimeString(
      <>
        <span className="display--time__big">
          {time
            .format('HH')
            .split('')
            .map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          :
          {time
            .format('mm')
            .split('')
            .map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          :
        </span>
        <span className="display--time__small">
          {time
            .format('ss')
            .split('')
            .map((c, i) => (
              <span key={i}>{c}</span>
            ))}
        </span>
      </>
    );
  }

  useInterval(() => {
    updateTime();
  }, 1000);

  return <p className="display--time">{TimeString}</p>;
}
