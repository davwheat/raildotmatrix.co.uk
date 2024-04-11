import React from 'react';

import SlideyScrollText from './SlideyScrollText';

interface ICallingPointsProps {
  pointsText: string[];
  scrollingPrefix?: React.ReactNode;
  scrollingSuffix?: React.ReactNode;
  onComplete?: () => void;
}

function _CallingPoints({ pointsText, scrollingPrefix = null, scrollingSuffix = null, onComplete }: ICallingPointsProps) {
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
    >
      {scrollingPrefix}
      <span>
        {pointsText.map((p, i) => (
          <span
            key={i}
            css={{
              '&:not(:last-child)::after': {
                content: '", "',
              },

              // Only one calling point
              '&:first-child:last-child::after': {
                textTransform: 'unset',
                content: '" only."',
              },

              '&:not(:first-child):last-child::after': {
                content: '"."',
              },

              '&:last-child': {
                textTransform: 'uppercase',
              },
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
