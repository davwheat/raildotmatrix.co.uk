import React from 'react';
import SmallClock from '../reusable/SmallClock';

export default function NextStopSmallScreen() {
  return (
    <div className="nextStop splitLines">
      <div className="darkBlue" />
      <div className="lightBlue" />

      <SmallClock />
    </div>
  );
}
