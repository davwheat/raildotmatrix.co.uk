import React, { useState } from 'react';

import dayjs from 'dayjs';

import dayjsUtc from 'dayjs/plugin/utc';
import dayjsTz from 'dayjs/plugin/timezone';

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTz);

import './SmallClock.less';
import useInterval from '../../../../hooks/useInterval';

export default function SmallClock() {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useInterval(() => {
    setCurrentTime(new Date());
  }, 1000);

  return (
    <div className="clock">
      <div className="time">
        <span className="text t900">{dayjs(currentTime).tz('Europe/London').format('HH:mm')}</span>
      </div>
      <div className="date">
        <span className="text t900">{dayjs(currentTime).tz('Europe/London').format('D/M/YYYY')}</span>
      </div>
    </div>
  );
}
