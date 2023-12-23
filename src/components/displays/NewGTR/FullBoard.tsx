import React, { useCallback, useEffect, useState } from 'react';

import type { StaffServicesResponse } from '../../../api/GetNextTrainsAtStationStaff';
import GetNextTrainsAtStationStaff from '../../../api/GetNextTrainsAtStationStaff';
import CallNreMessage from './CallNreMessage';
import Clock from './Clock';

import './css/board.less';
import TrainServices from './TrainServices';

interface IProps {
  station: string;
}

function loadTrainData(station: string, setTrainData: (data: any) => void) {
  const ac = new AbortController();

  GetNextTrainsAtStationStaff(station, { minOffset: 0 }, ac).then((data) => {
    setTrainData(data);
  });

  return ac;
}

const UPDATE_INTERVAL_SECS = 15;

function isValidResponseApi(response: StaffServicesResponse | null | { error: true }): response is StaffServicesResponse {
  return response !== null && !(response as any).error && (response as any).trainServices;
}

export default function FullBoard({ station }: IProps) {
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

  if (isError || trainData.trainServices === null || trainData.trainServices.length === 0) {
    return (
      <article className="dot-matrix">
        <CallNreMessage />
        <Clock />
      </article>
    );
  }

  return (
    <article className="dot-matrix">
      <TrainServices services={trainData.trainServices} />
      <Clock />
    </article>
  );
}
