import React, { useState, useRef, useEffect, useCallback } from 'react';

import GetNextTrainsAtStation, { ApiResponse, TrainService } from '../../../api/GetNextTrainsAtStation';

import './css/board/index.less';

import { debounce } from 'throttle-debounce';
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

function fillDiv(div: HTMLDivElement) {
  const currentWidth = div.offsetWidth;
  const currentHeight = div.offsetHeight;

  const availableHeight = window.innerHeight;
  const availableWidth = window.innerWidth;

  const scale = Math.min(availableWidth / currentWidth, availableHeight / currentHeight);

  div.style.cssText = `
    transform: scale(${scale}) translateZ(0);
    transform-origin: 50% 50%;
  `;
}

function isValidResponseApi(response: ApiResponse | null | { error: true }): response is ApiResponse {
  return response !== null && !(response as any).error;
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

function FullBoard({ station, platformNumber }: IProps) {
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
        console.log([...data.trainServices]);

        data.trainServices = data.trainServices
          .filter((trainService) => {
            const realDeptTime = getRealDeptTime(trainService);

            if (!realDeptTime) return true;

            const now = new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, minute: '2-digit', timeZone: 'Europe/London' });

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

      console.log([...data.trainServices]);

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

  useEffect(() => {
    boardRef.current && requestAnimationFrame(() => fillDiv(boardRef.current!));
  });

  useEffect(() => {
    const debouncedScale = debounce(250, () => {
      if (boardRef.current) {
        fillDiv(boardRef.current);
      }
    });

    function scale() {
      debouncedScale();
    }

    window.addEventListener('resize', scale);

    return () => {
      window.removeEventListener('resize', scale);
    };
  }, [boardRef.current]);

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
    <article className="tfwm-board tfwm-board__notice" ref={boardRef}>
      <BoardHeader platformNumber={platformNumber} stationName={station} />

      <div className="fullscreenNotice">
        <p>Please listen for announcements or call National&nbsp;Rail&nbsp;Enquiries on 03457 48 49 50</p>
      </div>
    </article>;
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

export default FullBoard;
