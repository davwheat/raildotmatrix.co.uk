import React from 'react'

import { keyframes } from '@emotion/react'

const flash = keyframes`
  0% {
    opacity: 1;
  }

  50%,
  100% {
    opacity: 0;
  }
`

/** A second lit and a second dark, three times over, which is the six seconds the board holds before it redraws. */
const FLASH_CYCLE = '2s'
const FLASH_CYCLES = 3

export default function PlatformAlterationMessage({ onComplete }: { onComplete: () => void }) {
  return (
    <>
      <div css={{ height: 'var(--row-height)' }} />
      <div
        onAnimationEnd={onComplete}
        css={{
          height: 'var(--row-height)',
          lineHeight: 'var(--row-height)',
          textAlign: 'center',
          animationName: flash,
          animationDuration: FLASH_CYCLE,
          animationIterationCount: FLASH_CYCLES,
          animationTimingFunction: 'step-end',
          animationFillMode: 'forwards',
        }}
      >
        PLATFORM ALTERATION
      </div>
      <div css={{ height: 'var(--row-height)' }} />
    </>
  )
}
