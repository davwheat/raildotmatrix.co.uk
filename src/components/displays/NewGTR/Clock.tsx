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

function getLastNumber(num: string): string {
  const int = parseInt(num);

  if (int === 0) return '9';
  else return (int - 1).toString();
}

interface IProps {
  animateDigits?: boolean;
}

export default function Clock({ animateDigits = false }: IProps) {
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
        <div className="char" key={i}>
          {!animateDigits && t}
          {animateDigits && (t !== ':' ? <ClockDigit digit={t} /> : t)}
        </div>
      ))}
    </div>
  );
}

function ClockDigit({ digit }: { digit: string }) {
  return (
    <>
      <div key={`${digit}-1`} className="prev">
        {getLastNumber(digit)}
      </div>
      <div key={`${digit}-2`} className="current">
        {digit}
      </div>
    </>
  );
}
