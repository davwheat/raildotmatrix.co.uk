import React from 'react';
import { crsToStationName } from '../../../../functions/crsToStationName';
import { getUrlParam } from '../getUrlParam';
import SlideyScrollText from '../SlideyScrollText';

export default function CallingPointsBigScreen() {
  let destination = getUrlParam('dest');

  destination &&= crsToStationName(destination);
  destination ??= 'Unknown';

  let callingPoints: string[] = getUrlParam('stop') ?? [];

  if (typeof callingPoints === 'string') {
    callingPoints = [callingPoints];
  } else if (!Array.isArray(callingPoints)) {
    callingPoints = [];
  }

  callingPoints = callingPoints.map(crsToStationName).filter(Boolean) as string[];

  if (callingPoints.length === 0) {
    callingPoints = [destination];
  } else {
    callingPoints.push(destination);
  }

  return (
    <div className="callingPoints splitLines">
      <div className="darkBlue">
        <span className="text t900">{destination}</span>
      </div>
      <SlideyScrollText className="lightBlue">
        <span className="text">{pluralise(callingPoints)}</span>
      </SlideyScrollText>
    </div>
  );
}

function pluralise(arr: string[]): string {
  if (arr.length === 0) return '';

  if (arr.length === 1) {
    return `Calling at ${arr[0]} only.`;
  }

  return `Calling at ${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}.`;
}
