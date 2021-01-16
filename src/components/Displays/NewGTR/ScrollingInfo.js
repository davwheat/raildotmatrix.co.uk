import React, { useState, useRef } from 'react'

import useInterval from '../../../hooks/useInterval'

const UseCallingAtFixed = false

export default function ScrollingInfo({ trainData: train }) {
  const [activeAnimation, setActiveAnimation] = useState(null)
  const [shouldLeave, setShouldLeave] = useState(false)

  const intermediaryStopsRef = useRef(null)
  const trainInfoScrollerRef = useRef(null)
  const callingAtTextRef = useRef(null)

  useInterval(() => {
    if (activeAnimation === 'callingAt__scroll' && UseCallingAtFixed) {
      if (intermediaryStopsRef.current.getBoundingClientRect().left < 0 + 48) {
        callingAtTextRef.current.style.position = 'fixed'
        callingAtTextRef.current.style.left = `${48 - 4 - intermediaryStopsRef.current.getBoundingClientRect().left}px`
        callingAtTextRef.current.style.background = '#030303'
        callingAtTextRef.current.style.zIndex = '100'
        callingAtTextRef.current.style.paddingLeft = '48px'
        callingAtTextRef.current.style.paddingRight = '16px'
      } else {
        callingAtTextRef.current.style.position = null
        callingAtTextRef.current.style.left = null
        callingAtTextRef.current.style.background = null
        callingAtTextRef.current.style.zIndex = null
      }
    }
  }, 15)

  const { operator: toc, length: coachCount, betweenStations } = train

  let departureStation = '',
    location = null,
    otherMessages = null

  train.origin.forEach((origin, i) => {
    if (i) departureStation += ` and ${origin.locationName}`
    else departureStation += origin.locationName
  })

  const intermediaryStops = train.subsequentCallingPoints
    ? train.subsequentCallingPoints[0].callingPoint.reduce((stops, thisStop) => {
        return [
          ...stops,
          {
            location: thisStop.locationName,
            eta: thisStop.et === 'On time' ? thisStop.st : thisStop.et,
          },
        ]
      }, [])
    : null

  if (intermediaryStops && intermediaryStops[0].eta === null && !shouldLeave) setShouldLeave(true)

  if (betweenStations && !shouldLeave) {
    if (betweenStations.length > 1)
      location = `This train ${train.isCancelled ? 'was' : 'is'} currently between ${betweenStations[0]} and ${betweenStations[1]}.`
    else if (betweenStations.length === 1) location = `This train is currently at ${betweenStations[0]}.`
  }

  const callingAtScrollDelay = 750

  let callingAtScrollTime = 0,
    trainInfoScrollTime = 0

  if (intermediaryStopsRef.current && !shouldLeave) {
    callingAtScrollTime = Math.ceil((intermediaryStopsRef.current.offsetWidth + window.innerWidth) / 525)
  }

  if (trainInfoScrollerRef.current && !shouldLeave) {
    trainInfoScrollTime = Math.ceil((trainInfoScrollerRef.current.offsetWidth + window.innerWidth) / 475)
  }

  useInterval(() => {
    setActiveAnimation('trainInfo__scroll')
    console.log('Scrolling train details... Time: ', trainInfoScrollTime)

    setTimeout(() => {
      setActiveAnimation('callingAt__intro')

      console.log("Performing intro to 'calling at'. Time: ", callingAtScrollDelay / 1000)

      setTimeout(() => {
        setActiveAnimation('callingAt__scroll')

        console.log('Scrolling stopping points... Time: ', callingAtScrollTime)
      }, callingAtScrollDelay)
    }, trainInfoScrollTime * 1000)
  }, callingAtScrollTime * 1000 + callingAtScrollDelay + trainInfoScrollTime * 1000)

  if (train.isCancelled) {
    if (train.cancelReason) otherMessages = train.cancelReason

    if (otherMessages && !otherMessages.endsWith('.')) otherMessages += '.'
  } else if (train.delayReason && train.etd !== 'On time') {
    otherMessages = train.delayReason

    if (otherMessages && !otherMessages.endsWith('.')) otherMessages += '.'
  }

  return (
    <div className="train--details">
      <p
        className="train--details__scroller"
        ref={trainInfoScrollerRef}
        style={{
          animationName: activeAnimation === 'trainInfo__scroll' ? 'scrollByWidth1' : '',
          animationDuration: activeAnimation === 'trainInfo__scroll' ? `${trainInfoScrollTime}s` : '0s',
        }}
      >
        This {train.isCancelled ? 'was' : 'is'} {toc ? `a ${toc}` : `the`} service
        {coachCount ? ` formed of ${coachCount} coaches` : ''}.{location ? ` ${location}` : ''}
        {otherMessages ? ` ${otherMessages}` : ''}
        {train.isCancelled && departureStation ? ` This is the service from ${departureStation}.` : ''}
      </p>
      {intermediaryStops && (
        <p
          ref={intermediaryStopsRef}
          className="train--details__intermediary-stops"
          style={{
            animationName: activeAnimation === 'callingAt__scroll' ? 'scrollByWidth2' : '',
            animationDuration: activeAnimation === 'callingAt__scroll' ? `${callingAtScrollTime}s` : `0s`,
            transform:
              activeAnimation === 'callingAt__intro' ? `translateX(calc(1920px - 48px - ${train.isCancelled ? `13.75ch` : `9.75ch`}))` : null,
          }}
        >
          <span className="train--details__calling-at" ref={callingAtTextRef}>
            {train.isCancelled ? `Was calling at:` : `Calling at:`}
          </span>
          <span className="train--details__intermediary-stop-list">
            {intermediaryStops.length > 1 ? (
              <>
                {intermediaryStops
                  .slice(0, intermediaryStops.length - 1)
                  .map(stop => `${stop.location}${train.isCancelled ? '' : ` (${stop.eta})`}, `)}{' '}
                and {intermediaryStops[intermediaryStops.length - 1].location}{' '}
                {train.isCancelled ? '' : ` (${intermediaryStops[intermediaryStops.length - 1].eta})`}
              </>
            ) : (
              `${intermediaryStops[intermediaryStops.length - 1].location} only ${
                train.isCancelled ? '' : ` (${intermediaryStops[intermediaryStops.length - 1].eta})`
              }`
            )}
          </span>
        </p>
      )}
    </div>
  )
}
