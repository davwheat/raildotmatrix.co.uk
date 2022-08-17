import React from 'react';
import { crsToStationName } from '../../../../functions/crsToStationName';
import { getUrlParam } from '../getUrlParam';
import SlideyScrollText from '../SlideyScrollText';

export default function CallingPointsBigScreen() {
  let destination = getUrlParam('dest');

  destination &&= crsToStationName(destination);
  destination ??= 'Unknown';

  return (
    <div className="callingPoints splitLines">
      <div className="darkBlue">
        <span className="text t900">{destination}</span>
      </div>
      <SlideyScrollText className="lightBlue">
        <span className="text">Calling at Hassocks, Burgess Hill, Preston Park and Brighton.</span>
      </SlideyScrollText>
    </div>
  );
}
