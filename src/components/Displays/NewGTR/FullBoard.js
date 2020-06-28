import React, { useState, useRef, useEffect } from 'react'
import useInterval from '../../../hooks/useInterval'

import LoadingMessage from './LoadingMessage'
import Train from './Train'

import GetNextTrainsAtStation from '../../../Api/GetNextTrainsAtStation'

import './css/board.css'
import NoServicesMessage from './NoServicesMessage'
import Time from './Time'
import ScrollingInfo from './ScrollingInfo'
import ErrorMessage from './ErrorMessage'
import clsx from 'clsx'

const FullBoard = React.forwardRef(({ station, noBg }, ref) => {
  const [TrainData, setTrainData] = useState(null)
  const [shouldShowScrollingInfo, setShouldShowScrollingInfo] = useState(true)

  async function updateData() {
    GetNextTrainsAtStation(station, { minOffset: 0 }).then(res => {
      setTrainData(res)
    })
  }

  // update every 5s
  useInterval(() => {
    updateData()
  }, 5 * 1000)

  if (TrainData === null) updateData()

  const Services = TrainData ? TrainData.trainServices : null

  const boardRef = useRef(null)

  function fillDiv(div) {
    const currentWidth = div.offsetWidth
    const currentHeight = div.offsetHeight

    const availableHeight = window.innerHeight
    const availableWidth = window.innerWidth

    const scale = Math.min(availableWidth / currentWidth, availableHeight / currentHeight)

    div.style.cssText = `
      transform: scale(${scale}) translateZ(0);
      transform-origin: 50% 50%;
    `
  }

  useEffect(() => {
    function scale() {
      if (boardRef.current) {
        fillDiv(boardRef.current, true)
      }
    }

    window.addEventListener('resize', scale)

    return () => {
      window.removeEventListener('resize', scale)
    }
  }, [boardRef])

  function GetTrain(Services, i) {
    const train = Services[i]

    if (!train) return null

    function leftCallback(left) {
      if (left) setShouldShowScrollingInfo(false)
      else setShouldShowScrollingInfo(true)
    }

    return (
      <Train
        via={train.destination[0].via}
        leftCallback={i === 0 ? leftCallback : () => {}}
        position={i + 1}
        scheduledTime={train.std}
        destination={train.destination[0].locationName}
        isCancelled={train.isCancelled}
        intermediaryStops={
          train.subsequentCallingPointsList
            ? train.subsequentCallingPointsList[0].subsequentCallingPoints.reduce((stops, thisStop) => {
                return [
                  ...stops,
                  {
                    location: thisStop.locationName,
                    eta: thisStop.et === 'On time' ? thisStop.st : thisStop.et,
                  },
                ]
              }, [])
            : null
        }
        expectedTime={train.etd || 'Delayed'}
        toc={train.operator}
        coachCount={train.length}
        departureStation={train.origin.locationName}
      />
    )
  }

  return (
    <section ref={boardRef} className={clsx('dot-matrix', { 'dot-matrix--noBg': noBg })}>
      <div className="decoration">
        <span>Num</span>
        <span>Time</span>
        <span>Destination</span>
        <span>Est</span>
      </div>
      {TrainData === null && <LoadingMessage />}
      {TrainData !== null && TrainData.error === true && <ErrorMessage />}
      {TrainData !== null && !Services && !TrainData.error && <NoServicesMessage messages={TrainData && TrainData.nrccMessages} />}
      {TrainData !== null && Services && !TrainData.error && (
        <>
          {GetTrain(Services, 0)}
          {shouldShowScrollingInfo ? <ScrollingInfo trainData={Services[0]} /> : <p className="display--no-services"></p>}
          <div className="train--alternate-between">
            {GetTrain(Services, 1)}
            {GetTrain(Services, 2)}
          </div>
        </>
      )}
      <Time />
    </section>
  )
})

export default FullBoard
