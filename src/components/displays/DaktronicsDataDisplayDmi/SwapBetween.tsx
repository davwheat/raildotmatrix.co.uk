import React, { useEffect, useState } from 'react';
import clsx from 'clsx';

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
    <div
      data-showing={shownChild}
      className={className}
      css={{
        position: 'relative',
        overflow: 'hidden',
        height: 'var(--row-height)',
      }}
    >
      {children.map((c, i) => (
        <div
          key={i}
          css={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: '100%',

              transform: 'translateY(0)',
              transition: 'transform 0.25s linear',
            },
            shownChild === i
              ? { transform: 'translateY(0)' }
              : shownChild < i
                ? { transform: 'translateY(105%)' }
                : { transform: 'translateY(-105%)' },
            animate
              ? {}
              : {
                  transition: 'none',
                },
          ]}
        >
          {c}
        </div>
      ))}
    </div>
  );
}
