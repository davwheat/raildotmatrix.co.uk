import React from 'react';
import { crsToStationName } from '../../../../functions/crsToStationName';
import { getUrlParam } from '../getUrlParam';
import SlideyScrollText from '../SlideyScrollText';
import { getDestination } from './Destination';

export function getCallingPoints(format: 'crs' | 'names'): string[] {
  const destination = getDestination(format === 'crs' ? 'crs' : 'name');

  let callingPoints: string[] = getUrlParam('stop') ?? [];

  if (typeof callingPoints === 'string') {
    callingPoints = [callingPoints];
  } else if (!Array.isArray(callingPoints)) {
    callingPoints = [];
  }

  let mappedCallingPoints = callingPoints.filter((crs) => !!crsToStationName(crs)).map(format === 'names' ? crsToStationName : (x) => x) as string[];

  if (mappedCallingPoints.length === 0) {
    mappedCallingPoints = [destination];
  } else {
    mappedCallingPoints.push(destination);
  }

  return mappedCallingPoints;
}

export default function CallingPointsBigScreen() {
  const destination = getDestination();
  const callingPoints = getCallingPoints('names');

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
