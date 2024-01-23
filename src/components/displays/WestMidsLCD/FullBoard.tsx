import React, { useState, useRef, useEffect, useCallback } from 'react';

import GetNextTrainsAtStation, { ApiResponse, TrainService } from '../../../api/GetNextTrainsAtStation';

import './css/board/index.less';

import BoardHeader from './BoardHeader';
import NextTrain from './NextTrainData';
import SecondaryTrainData from './SecondaryTrainData';

interface IProps {
  station: string;
  platformNumber: number;
}

function loadTrainData(station: string, setTrainData: (data: any) => void) {
  const ac = new AbortController();

  GetNextTrainsAtStation(station, { minOffset: 0 }, ac).then((data) => {
    setTrainData(data);
  });

  return ac;
}

const UPDATE_INTERVAL_SECS = 15;

function isValidResponseApi(response: ApiResponse | null | { error: true }): response is ApiResponse {
  return response !== null && !(response as any).error && (response as any).trainServices;
}

function getRealDeptTime(trainService: TrainService, stdForDelayed: boolean = false): string | null {
  let realDeptTime: string | null = null;

  if (trainService?.isCancelled || trainService?.etd === 'On time') {
    realDeptTime = trainService.std!;
  } else if (trainService?.etd === 'Delayed') {
    if (stdForDelayed) {
      realDeptTime = trainService.std!;
    }
  } else {
    realDeptTime = trainService.etd!;
  }

  return realDeptTime;
}

export default function FullBoard({ station, platformNumber }: IProps) {
  const [trainData, setTrainData] = useState<ApiResponse | null | { error: true }>(null);

  const isError = !isValidResponseApi(trainData);

  const [dataInfo, setDataInfo] = useState({
    loadingData: false,
    lastUpdated: 0,
  });

  const boardRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(() => {
    loadTrainData(station, (data: ApiResponse | null | { error: true }) => {
      if (isValidResponseApi(data)) {
        data.trainServices = data.trainServices
          .filter((trainService) => {
            const realDeptTime = getRealDeptTime(trainService);

            if (!realDeptTime) return true;

            const now = new Date(new Date().getTime() + 60 * 60 * 1000).toLocaleString('en-GB', {
              hour: '2-digit',
              hour12: false,
              minute: '2-digit',
              timeZone: 'Europe/London',
            });

            const [nowHour, nowMin] = now.split(':');
            const [realHour, realMin] = realDeptTime.split(':');

            if (realHour !== nowHour) {
              return true;
            }

            if (realHour === nowHour && realMin > nowMin) {
              return true;
            }
          })
          .sort((a, b) => {
            const aRealDeptTime = getRealDeptTime(a, true);
            const bRealDeptTime = getRealDeptTime(b, true);

            if (aRealDeptTime === bRealDeptTime) {
              if (a.std === b.std) {
                return 0;
              }

              return a.std! > b.std! ? 1 : -1;
            }

            return aRealDeptTime! > bRealDeptTime! ? 1 : -1;
          });
      }

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

  const firstService = !isError && trainData.trainServices?.[0];
  const secondService = !isError && trainData.trainServices?.[1];
  const thirdService = !isError && trainData.trainServices?.[2];

  if (isError) {
    return (
      <article className="tfwm-board tfwm-board__notice" ref={boardRef}>
        <BoardHeader platformNumber={platformNumber} stationName={station} />

        <div className="fullscreenNotice">
          <p>Please listen for announcements or call National&nbsp;Rail&nbsp;Enquiries on 03457 48 49 50</p>
        </div>
      </article>
    );
  }

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
