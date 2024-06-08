import React, { useEffect, useState } from 'react';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.tz.setDefault('Europe/London');

import { css, keyframes } from '@emotion/react';

function getTimeNumerics(): string {
  return dayjs.tz().format('HH:mm:ss');
}

function getLastNumber(num: string, maxNum: number): string {
  const int = parseInt(num);

  if (int === 0) return `${maxNum}`;
  else return (int - 1).toString();
}

interface IProps {}

const hideThenShow = keyframes`
  0% {
    opacity: 0;
  }

  100% {
    opacity: 1;
  }
`;

export default function Clock({}: IProps) {
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
    <div
      css={{
        background: 'var(--dmi-row-background)',
        backgroundClip: 'padding-box',
        padding: '4px 8px',
        paddingRight: 0,

        width: 'max-content',
        margin: 'auto',

        display: 'flex',
        alignItems: 'flex-start',

        fontFamily: 'DataDisplay Clock',
        justifyContent: 'center',
        marginTop: 'auto',
      }}
    >
      {[...time].map((t, i) => (
        <div
          key={i}
          css={{
            '--width': '1ch',
            '--flip-duration': '0.25s',
            '--step-count': 5,

            width: 'var(--width)',
            textAlign: 'center',
            position: 'relative',
            lineHeight: '2em',

            // Handle colons
            '&:nth-of-type(3n)': {
              opacity: '1 !important',
            },
          }}
        >
          {t !== ':' ? (
            <ClockDigit digit={t} pos={i} />
          ) : (
            <span
              css={{ animation: hideThenShow, animationDuration: '250ms', animationTimingFunction: 'step-end', animationFillMode: 'none' }}
              key={`${time}-${i}`}
            >
              {t}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

const digitBase = css`
  --dot-height: calc(100% / 9);
  --dot-width: calc(100% / 8);

  width: var(--width);
  position: absolute;
  top: 0;

  will-change: transform;

  animation-duration: var(--flip-duration);
  animation-timing-function: steps(var(--step-count), start);
  animation-fill-mode: forwards;
`;

const squashOut = keyframes`
  0% {
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0% 100%);
    opacity: 1;
  }
  80% {
    clip-path: polygon(
      calc(var(--dot-width) * 4) 0,
      calc(var(--dot-width) * 4) 0,
      calc(var(--dot-width) * 4) 100%,
      calc(var(--dot-width) * 4) 100%
    );
    opacity: 1;
  }
  100% {
    clip-path: polygon(
      calc(var(--dot-width) * 4) 0,
      calc(var(--dot-width) * 4) 0,
      calc(var(--dot-width) * 4) 100%,
      calc(var(--dot-width) * 4) 100%
    );
    opacity: 0;
  }
`;

const squashIn = keyframes`
  0% {
    clip-path: polygon(
      calc(var(--dot-width) * 4) 0,
      calc(var(--dot-width) * 4) 0,
      calc(var(--dot-width) * 4) 100%,
      calc(var(--dot-width) * 4) 100%
    );
    opacity: 0;
  }
  20% {
    clip-path: polygon(
      calc(var(--dot-width) * 4) 0,
      calc(var(--dot-width) * 4) 0,
      calc(var(--dot-width) * 4) 100%,
      calc(var(--dot-width) * 4) 100%
    );
    opacity: 1;
  }
  100% {
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0% 100%);
    opacity: 1;
  }
`;

function ClockDigit({ digit, pos }: { digit: string; pos: number }) {
  let maxNum = 9;

  // Hour digit 1
  if (pos === 0) maxNum = 2;
  // Min/Second digit 1
  if (pos === 3 || pos === 6) maxNum = 5;

  return (
    <>
      <div
        key={`${digit}-1`}
        css={[
          digitBase,
          {
            animationName: squashOut,
          },
        ]}
      >
        {getLastNumber(digit, maxNum)}
      </div>
      <div
        key={`${digit}-2`}
        css={[
          digitBase,
          {
            clipPath: `polygon(
              0 calc(var(--dot-height) * 4),
              100% calc(var(--dot-height) * 4),
              100% calc(var(--dot-height) * 5),
              0% calc(var(--dot-height) * 5)
            )`,
            opacity: 0,
            animationName: squashIn,
            animationDelay: 'var(--flip-duration)',
          },
        ]}
      >
        {digit}
      </div>
    </>
  );
}
