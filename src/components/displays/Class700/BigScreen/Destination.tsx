import React from 'react';
import { crsToStationName } from '../../../../functions/crsToStationName';
import { getUrlParam } from '../getUrlParam';

export default function DestinationBigScreen() {
  let destination = getUrlParam('dest');

  destination &&= crsToStationName(destination);
  destination ??= 'Unknown';

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
