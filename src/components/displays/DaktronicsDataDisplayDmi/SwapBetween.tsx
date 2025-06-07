import React, { useEffect, useState } from 'react'

interface IProps {
  interval: number
  animate?: boolean
  children: NonNullable<React.ReactNode>[]
  className?: string
  alwaysSlideUp?: boolean
}

function getStyle(i: number, shownChild: number, alwaysSlideUp: boolean) {
  if (i === shownChild) {
    return { transform: 'translateY(0)' }
  }

  if (alwaysSlideUp) {
    if (i < shownChild) {
      return { opacity: 0, transform: 'translateY(105%)' }
    } else {
      return { opacity: 0, transform: 'translateY(105%)' }
    }
  }

  if (i < shownChild) {
    return { transform: 'translateY(105%)' }
  } else {
    return { transform: 'translateY(-105%)' }
  }
}

export default function SwapBetween({ interval, animate = true, children, className, alwaysSlideUp = false }: IProps) {
  const [shownChild, setShownChild] = useState(-1)

  useEffect(() => {
    setTimeout(() => setShownChild(0))
  }, [])

  useEffect(() => {
    const key = setInterval(() => {
      setShownChild(v => (v + 1) % children.length)
    }, interval)

    return () => {
      clearInterval(key)
    }
  }, [shownChild, setShownChild, interval])

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
              transition: 'transform 400ms linear',
            },
            getStyle(i, shownChild, alwaysSlideUp),
            !animate && {
              transition: 'none',
            },
          ]}
        >
          {c}
        </div>
      ))}
    </div>
  )
}
