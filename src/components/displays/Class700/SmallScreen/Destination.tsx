import dayjs from 'dayjs';
import React from 'react';

export default function DestinationSmallScreen() {
  return (
    <div className="destination splitLines">
      <div className="darkBlue" />
      <div className="lightBlue" />

      <div className="clock">
        <div className="time">
          <span className="text t900">{dayjs().format('HH:mm')}</span>
        </div>
        <div className="date">
          <span className="text t900">{dayjs().format('D/M/YYYY')}</span>
        </div>
      </div>
    </div>
  );
}
