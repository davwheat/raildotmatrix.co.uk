import React, { useEffect, useState } from 'react';
import clsx from 'clsx';

import './css/swapBetween.less';

interface IProps {
  interval: number;
  animate?: boolean;
  children: NonNullable<React.ReactNode>[];
  className?: string;
}

export default function SwapBetween({ interval, animate = true, children, className }: IProps) {
  const [shownChild, setShownChild] = useState(0);

  useEffect(() => {
    const key = setInterval(() => {
      setShownChild((v) => (v + 1) % children.length);
    }, interval);

    return () => {
      clearInterval(key);
    };
  }, [shownChild, setShownChild, interval]);

  return (
    <div data-showing={shownChild} className={clsx('swapBetween', { 'swapBetween--noAnimate': !animate }, className)}>
      {children.map((c, i) => (
        <div
          key={i}
          style={{
            transform: shownChild === i ? 'translateY(0)' : shownChild < i ? 'translateY(105%)' : 'translateY(-105%)',
          }}
        >
          {c}
        </div>
      ))}
    </div>
  );
}
