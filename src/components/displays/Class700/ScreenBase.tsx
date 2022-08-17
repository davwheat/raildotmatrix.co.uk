import React, { useEffect, useState } from 'react';
import CallingPointsBigScreen from './BigScreen/CallingPoints';
import CoachInfoBigScreen from './BigScreen/CoachInfo';
import DestinationBigScreen from './BigScreen/Destination';
import { getUrlParam } from './getUrlParam';
import CallingPointsSmallScreen from './SmallScreen/CallingPoints';
import DestinationSmallScreen from './SmallScreen/Destination';

export const ValidScreenStages = [
  'destination',
  'next station',
  'calling points',
  'coach info',
  'loading',
  'toilets',
  'tfl status',
  'cctv',
  'stops graphic',
  'no route',
  'short platform',
] as const;

export const ScreenStagesCycle: typeof ValidScreenStages[number][] = [
  'destination',
  // 'next station',
  'calling points',
  'coach info',
  // 'loading',
  // 'toilets',
  // 'tfl status',
  // 'cctv',
  // 'stops graphic',
];

export function validateScreenStage(stage: string): boolean {
  return (ValidScreenStages as Readonly<string[]>).includes(stage);
}

export default function ScreenBase({}) {
  const [screenStage, setScreenStage] = useState(getUrlParam('screenStage') ?? 'destination');
  const shouldScrollStages = getUrlParam('scrollStages') === 'true';

  function scrollToNextScreen() {
    const nextIndex = (ScreenStagesCycle.indexOf(screenStage) + 1) % ScreenStagesCycle.length;
    const nextStage = ScreenStagesCycle[nextIndex];

    setScreenStage(nextStage);
  }

  useEffect(() => {
    if (shouldScrollStages) {
      setTimeout(scrollToNextScreen, 10 * 1000);
    }
  }, [scrollToNextScreen, shouldScrollStages, setScreenStage]);

  console.log(screenStage);

  const { big: BigScreen, small: SmallScreen } = getScreens(screenStage);

  return (
    <div className="class700">
      <div className="metalFrame metalFrame1" />
      <div className="metalFrame metalFrame2" />
      <div className="metalFrame metalFrame3" />
      <div className="metalFrame metalFrame4" />

      <div className="blackFrame blackFrame1" role="presentation" />
      <div className="blackFrame blackFrame2" role="presentation" />
      <div className="blackFrame blackFrame3" role="presentation" />
      <div className="blackFrame blackFrame4" role="presentation" />
      <div className="blackFrame blackFrame5" role="presentation" />

      <div className="smallScreen">
        <SmallScreen />
      </div>
      <div className="bigScreen">
        <BigScreen />
      </div>
    </div>
  );
}

function getScreens(screenStage: typeof ValidScreenStages[number]): { small: () => JSX.Element | null; big: () => JSX.Element | null } {
  switch (screenStage) {
    case 'destination':
      return {
        small: DestinationSmallScreen,
        big: DestinationBigScreen,
      };

    case 'calling points':
      return {
        small: CallingPointsSmallScreen,
        big: CallingPointsBigScreen,
      };

    case 'coach info':
      return {
        small: () => null,
        big: CoachInfoBigScreen,
      };

    default:
      return {
        small: () => null,
        big: () => null,
      };
  }
}
