import React from 'react';

import SlideyScrollText from './SlideyScrollText';
import dayjs from 'dayjs';
import clsx from 'clsx';

import './css/trainServiceAdditionalInfo.less';

import type { IMyTrainService } from './TrainServices';

interface IProps {
  service: IMyTrainService;
}

function getServiceInfo(service: IMyTrainService): string {
  const { toc, length } = service;

  const portions: string[] = [];

  portions.push(`A${toc ? ` ${toc}` : ''} service${length ? ` formed of ${length} coaches` : ''}.`);

  if (service.cancelled) {
    if (service.cancelReason) portions.push(service.cancelReason);
  } else if (service.isDelayed()) {
    if (service.delayReason) portions.push(service.delayReason);
  }

  return portions.join(' ');
}

export default function TrainServiceAdditionalInfo({ service }: IProps) {
  console.log('additional info');

  const [showCallingPoints, setShowCallingPoints] = React.useState(true);

  // Memoise to prevent early animation end
  const callingPoints = React.useMemo(
    () =>
      service.passengerCallPoints.map((p) => {
        const aTime = p.displayedArrivalTime();
        return `${p.name}${aTime ? ` (${aTime})` : ''}`;
      }),
    [JSON.stringify(service.passengerCallPoints)]
  );

  const serviceInfo = React.useMemo(() => getServiceInfo(service), [JSON.stringify(service)]);

  return (
    <div className="trainServiceAdditional">
      <div className={clsx('info', { shown: !showCallingPoints })}>
        <SlideyScrollText
          callCompleteIfNotScrolling={8_000}
          onComplete={() => {
            setShowCallingPoints(true);
            // Stop animation
            return true;
          }}
        >
          {serviceInfo}
        </SlideyScrollText>
      </div>

      <div className={clsx('callingPoints', { shown: showCallingPoints })}>
        <div className="callingAt">Calling at:</div>
        {showCallingPoints && <CallingPoints pointsText={callingPoints} onComplete={() => setShowCallingPoints(false)} />}
      </div>
    </div>
  );
}

function _CallingPoints({ pointsText, onComplete }: { pointsText: string[]; onComplete?: () => void }) {
  return (
    <SlideyScrollText
      onComplete={() => {
        onComplete?.();

        // Stop animation
        return true;
      }}
    >
      {pointsText.map((p, i) => (
        <span className="callingAtPoint" key={i}>
          {p}
        </span>
      ))}
    </SlideyScrollText>
  );
}

const CallingPoints = React.memo(_CallingPoints, (prev, next) => {
  const eq = prev.pointsText.join('') === next.pointsText.join('');

  console.log('calling points eq', eq);

  return eq;
});
