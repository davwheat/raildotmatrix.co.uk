import React, { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

import TrainService from './TrainService'

import SwapBetween from './SwapBetween'
import Separator from './Separator'
import CallNreMessage from './CallNreMessage'

import type { IMyTrainService } from '../../../api/ProcessServices'

interface IProps {
  services: IMyTrainService[]
}

export default function TrainServices({ services }: IProps) {
  const firstService: IMyTrainService | undefined = services[0]
  const secondService: IMyTrainService | undefined = services[1]
  const thirdService: IMyTrainService | undefined = services[2]

  const firstServiceLastRender = useRef<IMyTrainService | undefined>(firstService)
  const firstServiceRef = useRef<HTMLDivElement>(null)

  const [animateServiceOut, setAnimateServiceOut] = useState<IMyTrainService | null>(null)
  const [fadingIn, setFadingIn] = useState(false)

  if (firstService?.id !== firstServiceLastRender.current?.id) {
    console.log('first service changed -- animating last service out')

    // A departure under way plays out in full, and whatever list is current when it ends is the one that fades in.
    firstServiceLastRender.current && !animateServiceOut && !fadingIn && setAnimateServiceOut(firstServiceLastRender.current)
    firstServiceLastRender.current = firstService
  }

  useEffect(() => {
    if (animateServiceOut) {
      const animEnd = () => {
        console.log('slide out animation end')
        setAnimateServiceOut(null)
        setFadingIn(true)
      }

      firstServiceRef.current?.addEventListener('animationend', animEnd)

      return () => {
        console.log('cleanup')

        firstServiceRef.current?.removeEventListener('animationend', animEnd)
      }
    }
  }, [firstService, firstServiceLastRender, animateServiceOut, setAnimateServiceOut, setFadingIn])

  let rows: React.ReactNode

  if (animateServiceOut) {
    console.log('rendering animating service out')

    rows = (
      <>
        <TrainService ref={firstServiceRef} ordinal="1st" service={animateServiceOut} className="slide-out-to-right" />
        <div className="trainServiceAdditional" />
        <Separator />
      </>
    )
  } else if (!firstService) {
    rows = <CallNreMessage />
  } else {
    console.log('services rerendered!')

    rows = (
      <>
        {firstService && <TrainService ordinal="1st" service={firstService} showAdditionalDetails />}

        <Separator />

        {services.length >= 3 ? (
          <SwapBetween interval={12_000}>
            {secondService && <TrainService ordinal="2nd" service={secondService} />}
            {thirdService && <TrainService ordinal="3rd" service={thirdService} />}
          </SwapBetween>
        ) : (
          <>{secondService && <TrainService ordinal="2nd" service={secondService} />}</>
        )}
      </>
    )
  }

  // Every row fades in together, so any one of them finishing ends the fade for all.
  return (
    <div className={clsx('trainServices', { fadingIn })} onAnimationEnd={e => e.animationName === 'fade-in' && setFadingIn(false)}>
      {rows}
    </div>
  )
}
