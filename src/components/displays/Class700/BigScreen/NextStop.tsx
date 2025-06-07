import React from 'react'
import { crsToStationName } from '../../../../functions/crsToStationName'
import SlideyScrollText from '../SlideyScrollText'
import { getCallingPoints } from './CallingPoints'
import { getDestination } from './Destination'

export default function NextStopBigScreen() {
  const destination = getDestination('crs')
  const nextStop = getCallingPoints('crs')[0]

  const isFinalStop = nextStop === destination

  return (
    <div className="destination splitLines">
      <div className="darkBlue">
        <span className="text">The next station is</span>
      </div>
      <SlideyScrollText className="lightBlue">
        <span className="text t900">
          {crsToStationName(nextStop)}
          {isFinalStop && ', our final destination.'}
        </span>
      </SlideyScrollText>
    </div>
  )
}
