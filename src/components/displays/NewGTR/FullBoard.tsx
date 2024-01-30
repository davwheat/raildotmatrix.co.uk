import React, { CSSProperties, useCallback, useEffect, useState } from 'react';

import GetNextTrainsAtStationStaff from '../../../api/GetNextTrainsAtStationStaff';
import CallNreMessage from './CallNreMessage';
import Clock from './Clock';
import TrainServices from './TrainServices';

import './css/board.less';

import type { StaffServicesResponse } from '../../../api/GetNextTrainsAtStationStaff';
import { processServices } from '../../../api/ProcessServices';

interface IProps {
  station: string;
  animateClockDigits?: boolean;
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

export default function FullBoard({ station, animateClockDigits }: IProps) {
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

  const services = isError || !trainData.trainServices ? null : processServices(trainData.trainServices);

  if (!services || services.length === 0) {
    return (
      <article className="dot-matrix">
        <CallNreMessage />
        <Clock animateDigits={animateClockDigits} />
      </article>
    );
  }

  return (
    <article className="dot-matrix">
      <TrainServices services={services} />
      <Clock animateDigits={animateClockDigits} />
    </article>
  );
}
