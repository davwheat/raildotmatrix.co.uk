import dayjs from 'dayjs';
import React, { useState } from 'react';
import { useRef } from 'react';
import { useEffect } from 'react';

import './css/board/header.less';

export default function BoardHeader({ platformNumber, stationName }: { platformNumber: number | null; stationName: string }) {
  return (
    <header>
      <span className="platform">{typeof platformNumber === 'number' ? `Platform ${platformNumber}` : stationName}</span>

      <Clock />
    </header>
  );
}

function Clock() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const intervalRef = useRef(-1);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000) as any;

    return () => {
      clearInterval(intervalRef.current);
    };
  });

  return <div className="clock tab-nums">{dayjs(currentTime).format('HH:mm:ss')}</div>;
}
