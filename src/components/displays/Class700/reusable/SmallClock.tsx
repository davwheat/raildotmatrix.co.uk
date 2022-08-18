import React from 'react';

import dayjs from 'dayjs';

import './SmallClock.less';

export default function SmallClock() {
  return (
    <div className="clock">
      <div className="time">
        <span className="text t900">{dayjs().format('HH:mm')}</span>
      </div>
      <div className="date">
        <span className="text t900">{dayjs().format('D/M/YYYY')}</span>
      </div>
    </div>
  );
}
