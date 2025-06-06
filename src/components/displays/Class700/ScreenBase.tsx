import React, { useEffect, useState } from 'react'
import CallingPointsBigScreen, { getCallingPoints } from './BigScreen/CallingPoints'
import CoachInfoBigScreen from './BigScreen/CoachInfo'
import DestinationBigScreen, { getDestination } from './BigScreen/Destination'
import NextStopBigScreen from './BigScreen/NextStop'
import StoppingDiagramBigScreen from './BigScreen/StoppingDiagram'
import { getUrlParam } from './getUrlParam'
import CallingPointsSmallScreen from './SmallScreen/CallingPoints'
import DestinationSmallScreen from './SmallScreen/Destination'
import NextStopSmallScreen from './SmallScreen/NextStop'
import StoppingDiagramSmallScreen from './SmallScreen/StoppingDiagram'

export const ValidScreenStages = [
  'destination',
  'next stop',
  'calling points',
  'coach info',
  'loading',
  'toilets',
  'tfl status',
  'cctv',
  'stopping diagram',
  'no route',
  'short platform',
] as const

export const ScreenStagesCycle: (typeof ValidScreenStages)[number][] = [
  'destination',
  'next stop',
  'calling points',
  'coach info',
  // 'loading',
  // 'toilets',
  // 'tfl status',
  // 'cctv',
  'stopping diagram',
]

export function validateScreenStage(stage: string): boolean {
  return (ValidScreenStages as Readonly<string[]>).includes(stage)
}

function getNextScreen(screen: (typeof ValidScreenStages)[number]): (typeof ValidScreenStages)[number] {
  const nextIndex = (ScreenStagesCycle.indexOf(screen) + 1) % ScreenStagesCycle.length
  return ScreenStagesCycle[nextIndex]
}

function isNextStopDestination(): boolean {
  const destination = getDestination('crs')
  const callingPoints = getCallingPoints('crs')

  if (callingPoints.length === 1 && destination === callingPoints[0]) {
    // Next station is last stop.
    // In this case, we don't show the "Destination" screen.
    return true
  }

  return false
}

export default function ScreenBase({}) {
  const [screenStage, setScreenStage] = useState<(typeof ValidScreenStages)[number]>(
    getUrlParam('screenStage') ?? (isNextStopDestination() ? 'next stop' : 'destination'),
  )
  const shouldScrollStages = getUrlParam('scrollStages') === 'true'

  function scrollToNextScreen() {
    let nextStage = getNextScreen(screenStage)

    if (isNextStopDestination()) {
      while (nextStage === 'destination' || nextStage === 'calling points') {
        nextStage = getNextScreen(nextStage)
      }
    }

    setScreenStage(nextStage)
  }

  // TODO: use callback to switch after scroll complete for calling points
  useEffect(() => {
    let to: number | null = null
    if (shouldScrollStages) {
      to = window.setTimeout(scrollToNextScreen, screenStage === 'calling points' ? 45 * 1000 : 10 * 1000)
    }

    return () => {
      to !== null && clearTimeout(to)
    }
  }, [scrollToNextScreen, shouldScrollStages, screenStage, setScreenStage])

  console.log(screenStage)

  const { big: BigScreen, small: SmallScreen } = getScreens(screenStage)

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
  )
}

function getScreens(screenStage: (typeof ValidScreenStages)[number]): { small: () => JSX.Element | null; big: () => JSX.Element | null } {
  switch (screenStage) {
    case 'destination':
      return {
        small: DestinationSmallScreen,
        big: DestinationBigScreen,
      }

    case 'next stop':
      return {
        small: NextStopSmallScreen,
        big: NextStopBigScreen,
      }

    case 'calling points':
      return {
        small: CallingPointsSmallScreen,
        big: CallingPointsBigScreen,
      }

    case 'coach info':
      return {
        small: () => null,
        big: CoachInfoBigScreen,
      }

    case 'stopping diagram':
      return {
        small: StoppingDiagramSmallScreen,
        big: StoppingDiagramBigScreen,
      }

    default:
      return {
        small: () => null,
        big: () => null,
      }
  }
}
