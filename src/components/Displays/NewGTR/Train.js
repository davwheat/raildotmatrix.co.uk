import React, { useRef, useState, useEffect } from "react"
import PropTypes from "prop-types"

export default function Train(props) {
  const {
    position,
    scheduledTime,
    destination,
    intermediaryStops,
    expectedTime,
    status,
    betweenStations,
  } = props

  let currentStatus = "",
    location = null,
    posStr = ""

  const [shouldLeave, setShouldLeave] = useState(false)
  const [detailsOnLastRender, setDetailsOnLastRender] = useState(props)

  if (detailsOnLastRender !== props) {
    setShouldLeave(false)
    setDetailsOnLastRender(props)
  }

  if (intermediaryStops[0].eta === null && !shouldLeave) setShouldLeave(true)

  if (status) {
    currentStatus = status
  } else {
    if (shouldLeave) {
      currentStatus = "Arrived"
    } else if (expectedTime === scheduledTime) {
      currentStatus = "On time"
    } else {
      currentStatus =
        expectedTime === "On time"
          ? "On time"
          : "Exp " + expectedTime.replace(":", "")
    }
  }

  switch (position) {
    case 1:
      posStr = "1st"
      break
    case 2:
      posStr = "2nd"
      break
    case 3:
      posStr = "3rd"
      break

    default:
      posStr = "???"
      break
  }

  return (
    <>
      <div className={`train ${position > 1 && `swap-out`}`}>
        {shouldLeave && (
          <div className="train--spinner">
            {" "}
            <span>l</span>
          </div>
        )}
        <span className="train--position">{posStr}</span>
        <span className="train--scheduled-time">
          {scheduledTime.replace(":", "")}
        </span>
        <span className="train--destination">{destination}</span>
        <span className="train--status">{currentStatus}</span>
      </div>
    </>
  )
}

Train.propTypes = {
  position: PropTypes.number.isRequired,
  scheduledTime: PropTypes.string.isRequired,
  destination: PropTypes.string.isRequired,
  intermediaryStops: PropTypes.arrayOf(
    PropTypes.shape({
      location: PropTypes.string.isRequired,
      eta: PropTypes.string,
    })
  ).isRequired,
  expectedTime: PropTypes.string.isRequired,
  status: PropTypes.string,
  otherMessages: PropTypes.string,
  toc: PropTypes.string.isRequired,
  coachCount: PropTypes.number,
  departureStation: PropTypes.string,
}
