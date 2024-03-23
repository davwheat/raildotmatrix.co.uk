import React, { useRef } from 'react';

import './css/board/index.less';

import BoardHeader from './BoardHeader';
import NextTrain from './NextTrainData';
import SecondaryTrainData from './SecondaryTrainData';
import { processServices } from '../../../api/ProcessServices';
import { StaffServicesResponse } from '../../../api/GetNextTrainsAtStationStaff';
import { isValidResponseApi, useServiceInformation } from '../../../hooks/useServiceInformation';

interface IProps {
  station: string;
  platformNumber: number;
  useLegacyTocNames?: boolean;
}

export default function FullBoard({ station, platformNumber, useLegacyTocNames = false }: IProps) {
  const boardRef = useRef<HTMLDivElement>(null);

  const [trainData, dataInfo] = useServiceInformation(station);

  const services = isValidResponseApi(trainData)
    ? processServices(trainData.trainServices!!, /* platforms ?? */ null, !!useLegacyTocNames, station).filter((s) => !s.hasDeparted)
    : null;

  if (services === null || services.length === 0) {
    return (
      <article className="tfwm-board tfwm-board__notice" ref={boardRef}>
        <BoardHeader platformNumber={platformNumber} stationName={station} />

        <div className="fullscreenNotice">
          <p>Please listen for announcements or call National&nbsp;Rail&nbsp;Enquiries on 03457 48 49 50</p>
        </div>
      </article>
    );
  }

  const [firstService, secondService, thirdService] = services;

  if (dataInfo.loadingData) {
    return (
      <article className="tfwm-board tfwm-board__notice" ref={boardRef}>
        <BoardHeader platformNumber={platformNumber} stationName={station} />
      </article>
    );
  }

  if (services.length === 0) {
    return (
      <article className="tfwm-board tfwm-board__notice" ref={boardRef}>
        <BoardHeader platformNumber={platformNumber} stationName={station} />

        <div className="fullscreenNotice">
          <p>Please listen for announcements or call National&nbsp;Rail&nbsp;Enquiries on 03457 48 49 50</p>
        </div>
      </article>
    );
  }

  return (
    <article className="tfwm-board" ref={boardRef}>
      <BoardHeader platformNumber={platformNumber} stationName={(trainData as StaffServicesResponse)?.locationName ?? station} />

      {firstService && <NextTrain nextTrain={firstService} />}

      {secondService && <SecondaryTrainData train={secondService} position={2} />}
      {thirdService && <SecondaryTrainData train={thirdService} position={3} />}
    </article>
  );
}
