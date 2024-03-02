import React, { useState, useRef, useEffect, useCallback } from 'react';

import './css/board/index.less';

import BoardHeader from './BoardHeader';
import NextTrain from './NextTrainData';
import SecondaryTrainData from './SecondaryTrainData';
import { processServices } from '../../../api/ProcessServices';
import GetNextTrainsAtStationStaff, { StaffServicesResponse } from '../../../api/GetNextTrainsAtStationStaff';

interface IProps {
  station: string;
  platformNumber: number;
  useLegacyTocNames?: boolean;
}

function loadTrainData(station: string, setTrainData: (data: any) => void) {
  const ac = new AbortController();

  GetNextTrainsAtStationStaff(station, { minOffset: 0 }, ac).then((data) => {
    setTrainData(data);
  });

  return ac;
}

const UPDATE_INTERVAL_SECS = 20;

function isValidResponseApi(response: StaffServicesResponse | null | { error: true }): response is StaffServicesResponse {
  return response !== null && !(response as any).error && (response as any).trainServices;
}

export default function FullBoard({ station, platformNumber, useLegacyTocNames = false }: IProps) {
  const boardRef = useRef<HTMLDivElement>(null);

  const [trainData, setTrainData] = useState<StaffServicesResponse | null | { error: true }>(null);
  const [dataInfo, setDataInfo] = useState({
    loadingData: false,
    lastUpdated: 0,
  });

  const isError = !isValidResponseApi(trainData);

  const loadData = useCallback(() => {
    loadTrainData(station, (data: StaffServicesResponse | null | { error: true }) => {
      setTrainData(data);
      setDataInfo({ lastUpdated: Date.now(), loadingData: false });
    });
  }, [station, setTrainData, setDataInfo]);

  useEffect(() => {
    if (dataInfo.loadingData) return;

    if (dataInfo.lastUpdated === 0) {
      loadData();
    }

    const key = setInterval(() => {
      loadData();
    }, UPDATE_INTERVAL_SECS * 1000);

    return () => {
      clearInterval(key);
    };
  }, [setTrainData, setDataInfo, dataInfo, station, loadTrainData]);

  const services =
    isError || !trainData.trainServices ? null : processServices(trainData.trainServices, /*platforms ??*/ null, !!useLegacyTocNames, station);

  if (isError || services === null || services.length === 0) {
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

  if (trainData.trainServices?.length === 0) {
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
      <BoardHeader platformNumber={platformNumber} stationName={trainData?.locationName ?? station} />

      {firstService && <NextTrain nextTrain={firstService} />}

      {secondService && <SecondaryTrainData train={secondService} position={2} />}
      {thirdService && <SecondaryTrainData train={thirdService} position={3} />}
    </article>
  );
}
