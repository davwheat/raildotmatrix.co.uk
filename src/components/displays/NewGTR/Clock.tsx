import React, { useEffect, useState } from 'react';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

import './css/clock.less';

function getTimeNumerics(): string {
  return dayjs().tz('Europe/London').format('HH:mm:ss');
}

export default function Clock() {
  const [time, setTime] = useState(getTimeNumerics());

  useEffect(() => {
    let key = window.setInterval(() => {
      setTime(getTimeNumerics());
    }, 200);

    return () => {
      window.clearInterval(key);
    };
  }, [setTime]);

  return (
    <div className="row clock">
      {[...time].map((t, i) => (
        <div key={i} className="char">
          {t}
        </div>
      ))}
    </div>
  );
}
