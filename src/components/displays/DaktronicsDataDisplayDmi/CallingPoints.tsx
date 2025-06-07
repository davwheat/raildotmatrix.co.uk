import React from 'react'

import SlideyScrollText from './SlideyScrollText'

interface ICallingPointsProps {
  pointsText: string[]
  scrollingPrefix?: string
  scrollingSuffix?: React.ReactNode
  onComplete?: () => void
}

function _CallingPoints({ pointsText, scrollingPrefix = undefined, scrollingSuffix = null, onComplete }: ICallingPointsProps) {
  console.log('calling points rendered')

  return (
    <SlideyScrollText
      css={{ minWidth: '100%' }}
      alwaysScroll
      onComplete={() => {
        onComplete?.()

        // Stop animation
        return true
      }}
      slideDownText={scrollingPrefix}
    >
      <span>
        {' '}
        {pointsText.map((p, i) => (
          <CallingPoint key={i} text={p} />
        ))}
      </span>
      {scrollingSuffix}
    </SlideyScrollText>
  )
}

interface ICallingPointProps {
  text: string
  worldlinePowered?: boolean
}

export function CallingPoint({ text, worldlinePowered }: ICallingPointProps) {
  return (
    <span
      css={[
        {
          textTransform: 'var(--calling-points-text-transform)' as any,
        },
        !worldlinePowered && {
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
        },
        worldlinePowered && {
          '&:not(:last-child)::after': {
            content: '", "',
          },

          '&:nth-last-child(2)::after': {
            content: '" and "',
          },

          // Last calling point
          '&:last-child::after': {
            content: '"."',
          },
        },
      ]}
    >
      {text}
    </span>
  )
}

export const CallingPoints = React.memo(_CallingPoints, (prev, next) => {
  console.log('calling points props changed, but not rerendering')

  return true
})
