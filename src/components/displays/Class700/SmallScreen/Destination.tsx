import React from 'react';
import SmallClock from '../reusable/SmallClock';

export default function DestinationSmallScreen() {
  return (
    <div className="destination splitLines">
      <div className="darkBlue" />
      <div className="lightBlue" />

      <SmallClock />
    </div>
  );
}
