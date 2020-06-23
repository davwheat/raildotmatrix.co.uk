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
  const [shouldShowScrollingInfo, setShouldShowScrollingInfo] = useState(true)

  async function updateData() {
    GetNextTrainsAtStation(station, { minOffset: 0 }).then(res => {
      setTrainData(res)
    })
  }

  // update every 30s
  useInterval(() => {
    updateData()
  }, 4500 * 1000)

  if (TrainData === null) updateData()

  const Services = TrainData ? TrainData.trainServices : null

  function GetTrain(Services, i) {
    const train = Services[i]

    if (!train) return null

    function leftCallback(left) {
      if (left) setShouldShowScrollingInfo(false)
      else setShouldShowScrollingInfo(true)
    }

    return (
      <Train
        leftCallback={i === 0 ? leftCallback : () => {}}
        position={i + 1}
        scheduledTime={train.std}
        destination={train.destination[0].locationName}
        isCancelled={train.isCancelled}
        intermediaryStops={
          train.subsequentCallingPointsList
            ? train.subsequentCallingPointsList[0].subsequentCallingPoints.reduce(
                (stops, thisStop) => {
                  return [
                    ...stops,
                    {
                      location: thisStop.locationName,
                      eta:
                        thisStop.et === "On time" ? thisStop.st : thisStop.et,
                    },
                  ]
                },
                []
              )
            : null
        }
        expectedTime={train.etd || "Delayed"}
        toc={train.operator}
        coachCount={train.length}
        departureStation={train.origin.locationName}
      />
    )
  }

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
          {shouldShowScrollingInfo && <ScrollingInfo trainData={Services[0]} />}
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
