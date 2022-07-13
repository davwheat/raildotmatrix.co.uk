import React, { useState, useRef, useEffect } from 'react';

import GetNextTrainsAtStation, { ApiResponse } from '../../../api/GetNextTrainsAtStation';

import './css/board/index.less';

import { debounce } from 'throttle-debounce';
import BoardHeader from './BoardHeader';
import NextTrain from './NextTrainData';

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

const UPDATE_INTERVAL_SECS = 30;

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

function FullBoard({ station, platformNumber }: IProps) {
  const [trainData, setTrainData] = useState<ApiResponse | null | { error: true }>(null);

  const isError = !isValidResponseApi(trainData);

  const [dataInfo, setDataInfo] = useState({
    loadingData: false,
    lastUpdated: 0,
  });

  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dataInfo.loadingData) return;

    if (dataInfo.lastUpdated === 0) {
      loadTrainData(station, (data) => {
        setTrainData(data);
        setDataInfo({ lastUpdated: Date.now(), loadingData: false });
      });
    }

    const key = setInterval(() => {
      loadTrainData(station, (data) => {
        setTrainData(data);
        setDataInfo({ lastUpdated: Date.now(), loadingData: false });
      });
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
    </article>
  );
}

export default FullBoard;
