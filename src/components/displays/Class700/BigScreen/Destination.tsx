import React from 'react';
import { crsToStationName } from '../../../../functions/crsToStationName';
import { getUrlParam } from '../getUrlParam';

export function getDestination() {
  let destination = getUrlParam('dest');

  destination &&= crsToStationName(destination);
  destination ??= 'Unknown';

  return destination;
}

export default function DestinationBigScreen() {
  const destination = getDestination();

  return (
    <div className="destination splitLines">
      <div className="darkBlue">
        <span className="text">This train terminates at</span>
      </div>
      <div className="lightBlue">
        <span className="text t900">{destination}</span>
      </div>
    </div>
  );
}
