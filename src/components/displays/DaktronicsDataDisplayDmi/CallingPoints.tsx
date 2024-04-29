import React from 'react';

import SlideyScrollText from './SlideyScrollText';

interface ICallingPointsProps {
  pointsText: string[];
  scrollingPrefix?: string;
  scrollingSuffix?: React.ReactNode;
  onComplete?: () => void;
}

function _CallingPoints({ pointsText, scrollingPrefix = undefined, scrollingSuffix = null, onComplete }: ICallingPointsProps) {
  console.log('calling points rendered');

  return (
    <SlideyScrollText
      css={{ minWidth: '100%' }}
      alwaysScroll
      onComplete={() => {
        onComplete?.();

        // Stop animation
        return true;
      }}
      slideDownText={scrollingPrefix}
    >
      <span>
        {' '}
        {pointsText.map((p, i) => (
          <span
            key={i}
            css={{
              '&:not(:last-child)::after': {
                content: '", "',
              },

              // Last calling point
              '&:last-child::after': {
                content: '"."',
              },

              '&:last-child': {
                textTransform: 'uppercase',
              },

              textTransform: 'var(--calling-points-text-transform)' as any,
            }}
          >
            {p}
          </span>
        ))}
      </span>
      {scrollingSuffix}
    </SlideyScrollText>
  );
}

export const CallingPoints = React.memo(_CallingPoints, (prev, next) => {
  console.log('calling points props changed, but not rerendering');

  return true;
});
