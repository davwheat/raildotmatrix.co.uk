import React, { useState, useRef, useEffect } from 'react';

import GetNextTrainsAtStation, { ApiResponse } from '../../../api/GetNextTrainsAtStation';

import './css/board/index.less';

import clsx from 'clsx';
import { debounce } from 'throttle-debounce';
import BoardHeader from './BoardHeader';
import NextTrain from './NextTrainData';

interface IProps {
  station: string;
  // noBg: boolean;
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

function FullBoard({ station, platformNumber }: { station: string; platformNumber: number }) {
  const [trainData, setTrainData] = useState<ApiResponse | null | { error: true }>(null);

  const isError = !isValidResponseApi(trainData);

  const [loadingData, setLoadingData] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);

  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loadingData) return;

    if (lastUpdated === 0) {
      loadTrainData(station, (data) => {
        setTrainData(data);
        setLastUpdated(Date.now());
        setLoadingData(false);
      });
    }

    const key = setInterval(() => {
      loadTrainData(station, (data) => {
        setTrainData(data);
        setLastUpdated(Date.now());
        setLoadingData(false);
      });
    }, UPDATE_INTERVAL_SECS * 1000);
  }, [setTrainData, setLastUpdated, setLoadingData, lastUpdated, loadingData, station, loadTrainData]);

  useEffect(() => {
    // do it at least once
    if (boardRef.current) {
      fillDiv(boardRef.current);
    }

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

  return (
    <article className="tfwm-board" ref={boardRef}>
      <BoardHeader platformNumber={platformNumber} stationName={isError ? 'Loading...' : trainData.locationName} />

      {firstService && <NextTrain nextTrain={firstService} />}
    </article>
  );
}

export default FullBoard;
