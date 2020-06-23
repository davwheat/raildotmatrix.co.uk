import React, { useState } from "react"
import useInterval from "../../../hooks/useInterval"

import LoadingMessage from "./LoadingMessage"
import Train from "./Train"

import GetNextTrainsAtStation from "../../../Api/GetNextTrainsAtStation"

import "./css/board.css"
import NoServicesMessage from "./NoServicesMessage"
import Time from "./Time"
import ScrollingInfo from "./ScrollingInfo"

export default function NewGTR({ station }) {
  const [TrainData, setTrainData] = useState(null)

  async function updateData() {
    GetNextTrainsAtStation(station, { minOffset: 0 }).then(res => {
      setTrainData(res)
    })
  }

  // update every 30s
  useInterval(() => {
    updateData()
  }, 45 * 1000)

  if (TrainData === null) updateData()

  const Services = TrainData ? TrainData.trainServices : null

  return (
    <section className="dot-matrix">
      <div className="decoration">
        <span>Num</span>
        <span>Time</span>
        <span>Destination</span>
        <span>Est</span>
      </div>
      {TrainData === null && <LoadingMessage />}
      {!Services && (
        <NoServicesMessage messages={TrainData && TrainData.nrccMessages} />
      )}
      {Services && (
        <>
          {GetTrain(Services, 0)}
          <ScrollingInfo trainData={Services[0]} />
          <div className="train--alternate-between">
            {GetTrain(Services, 1)}
            {GetTrain(Services, 2)}
          </div>
        </>
      )}
      <Time />
    </section>
  )
}

function GetTrain(Services, i) {
  const train = Services[i]

  if (!train) return null

  let status = null,
    otherMessages = null

  if (train.isCancelled || train.cancelReason) {
    status = "Cancelled"
    otherMessages = train.cancelReason

    if (otherMessages && !otherMessages.endsWith(".")) otherMessages += "."
  } else if (train.delayReason) {
    otherMessages = train.delayReason

    if (otherMessages && !otherMessages.endsWith(".")) otherMessages += "."
  }
  return (
    <Train
      position={i + 1}
      scheduledTime={train.std}
      destination={train.destination[0].locationName}
      intermediaryStops={
        train.subsequentCallingPointsList
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
      }
      expectedTime={train.etd || "Delayed"}
      toc={train.operator}
      otherMessages={otherMessages}
      coachCount={train.length}
      departureStation={train.origin.locationName}
    />
  )
}
