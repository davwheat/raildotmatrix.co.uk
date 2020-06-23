import React, { useState, useRef } from "react"

import useInterval from "../../../hooks/useInterval"

export default function ScrollingInfo({ trainData: train }) {
  const [activeAnimation, setActiveAnimation] = useState(null)
  const [shouldLeave, setShouldLeave] = useState(false)

  const intermediaryStopsRef = useRef(null)
  const trainInfoScrollerRef = useRef(null)

  const { operator: toc, length: coachCount, betweenStations } = train

  let departureStation = "",
    location = null,
    otherMessages = null,
    status = null

  train.origin.forEach((origin, i) => {
    if (i) departureStation += ` and ${origin.locationName}`
    else departureStation += origin.locationName
  })

  const intermediaryStops = train.subsequentCallingPointsList
    ? train.subsequentCallingPointsList[0].subsequentCallingPoints.reduce(
        (stops, thisStop) => {
          return [
            ...stops,
            {
              location: thisStop.locationName,
              eta: thisStop.et === "On time" ? thisStop.st : thisStop.et,
            },
          ]
        },
        []
      )
    : null

  if (intermediaryStops[0].eta === null && !shouldLeave) setShouldLeave(true)

  if (betweenStations && !shouldLeave) {
    if (betweenStations.length > 1)
      location = `This train is currently between ${betweenStations[0]} and ${betweenStations[1]}.`
    else if (betweenStations.length === 1)
      location = `This train is currently at ${betweenStations[0]}.`
  }

  const callingAtScrollDelay = 750

  let callingAtScrollTime = 0,
    trainInfoScrollTime = 0

  if (intermediaryStopsRef.current && !shouldLeave) {
    callingAtScrollTime = Math.ceil(
      (intermediaryStopsRef.current.offsetWidth + window.innerWidth) / 400
    )
  }

  if (trainInfoScrollerRef.current && !shouldLeave) {
    trainInfoScrollTime = Math.ceil(
      (trainInfoScrollerRef.current.offsetWidth + window.innerWidth) / 400
    )
  }

  useInterval(() => {
    setActiveAnimation("trainInfo__scroll")
    console.log("Scrolling train details... Time: ", trainInfoScrollTime)

    setTimeout(() => {
      setActiveAnimation("callingAt__intro")

      console.log(
        "Performing intro to 'calling at'. Time: ",
        callingAtScrollDelay / 1000
      )

      setTimeout(() => {
        setActiveAnimation("callingAt__scroll")

        console.log("Scrolling stopping points... Time: ", callingAtScrollTime)
      }, callingAtScrollDelay)
    }, trainInfoScrollTime * 1000)
  }, callingAtScrollTime * 1000 + callingAtScrollDelay + trainInfoScrollTime * 1000)

  if (train.isCancelled || train.cancelReason) {
    status = "Cancelled"
    otherMessages = train.cancelReason

    if (otherMessages && !otherMessages.endsWith(".")) otherMessages += "."
  } else if (train.delayReason) {
    otherMessages = train.delayReason

    if (otherMessages && !otherMessages.endsWith(".")) otherMessages += "."
  }

  console.log(activeAnimation === "trainInfo__scroll" ? "scrollByWidth1" : "")

  return (
    <div className="train--details">
      <p
        className="train--details__scroller"
        ref={trainInfoScrollerRef}
        style={{
          animationName:
            activeAnimation === "trainInfo__scroll" ? "scrollByWidth1" : "",
          animationDuration:
            activeAnimation === "trainInfo__scroll"
              ? `${trainInfoScrollTime}s`
              : "0s",
        }}
      >
        This is a {toc} service
        {coachCount && ` formed of ${coachCount} coaches`}.{location}{" "}
        {otherMessages}{" "}
        {departureStation && `This is the service from ${departureStation}.`}
      </p>
      {intermediaryStops && (
        <p
          ref={intermediaryStopsRef}
          className="train--details__intermediary-stops"
          style={{
            animationName:
              activeAnimation === "callingAt__scroll" ? "scrollByWidth2" : "",
            animationDuration:
              activeAnimation === "callingAt__scroll"
                ? `${callingAtScrollTime}s`
                : `0s`,
            transform:
              activeAnimation === "callingAt__intro"
                ? `translateX(calc(100vw - 48px - 9.75ch))`
                : null,
          }}
        >
          <span className="train--details__calling-at">Calling at:</span>
          <span className="train--details__intermediary-stop-list">
            {intermediaryStops.length > 1 ? (
              <>
                {intermediaryStops
                  .slice(0, intermediaryStops.length - 1)
                  .map(stop => `${stop.location} (${stop.eta}), `)}{" "}
                and{" "}
                {intermediaryStops[
                  intermediaryStops.length - 1
                ].location.toUpperCase()}{" "}
                ({intermediaryStops[intermediaryStops.length - 1].eta})
              </>
            ) : (
              `${intermediaryStops[
                intermediaryStops.length - 1
              ].location.toUpperCase()} ONLY (${
                intermediaryStops[intermediaryStops.length - 1].eta
              })`
            )}
          </span>
        </p>
      )}
    </div>
  )
}
