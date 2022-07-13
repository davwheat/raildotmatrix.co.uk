import React from 'react';
import { TrainService } from '../../../api/GetNextTrainsAtStation';
import { combineLocations } from './combineLocations';

import './css/board/nextTrain.less';
import SlideyScrollText from './SlideyScrollText';

export default function NextTrain({ nextTrain }: { nextTrain: TrainService }) {
  const isOnTime = nextTrain.etd === 'On time' || nextTrain.etd === nextTrain.std;

  return (
    <div className="nextTrain">
      <div className="top-row">
        <div className="time">{nextTrain.std ?? nextTrain.sta}</div>

        <SlideyScrollText className="dest" classNameInner="dest-inner">
          {combineLocations(nextTrain.currentDestinations ?? nextTrain.destination)}
        </SlideyScrollText>

        <div className="status" data-on-time={isOnTime}>
          {isOnTime && 'On time'}
          {!isOnTime && nextTrain.isCancelled && 'Cancelled'}
          {!isOnTime && !nextTrain.isCancelled && `Exp ${nextTrain.etd}`}
        </div>
      </div>

      <div className="second-row">
        <div className="toc">{nextTrain.operator}</div>
        <div className="length">
          {(nextTrain.length || 0) === 1 && `1 carriage`}
          {(nextTrain.length || 0) > 1 && `${nextTrain.length} carriages`}

          {/*
            Sometimes data feed issues mean that the train length is 0.
            We should hide the length when this is the case.
           */}
          {/* {(nextTrain.length || 0) === 0 && `? carriages`} */}
        </div>
      </div>

      <div className="third-row">
        <SlideyScrollText className="trainInfo" scrollSpeed={350} oneWayScroll>
          {generateCallingAtText(nextTrain)}
        </SlideyScrollText>
      </div>
    </div>
  );
}

function generateCallingAtText(trainData: TrainService): string {
  if (!trainData.subsequentCallingPoints) return '';

  let text = '';

  const stationsBeforeSplit: string[] = [];

  const noSplits = trainData.subsequentCallingPoints[0].callingPoint.every((stop) => {
    stationsBeforeSplit.push(stop.locationName);

    return !stop.detachFront;
  });

  if (!noSplits) text += 'Calling at ';

  text += combineLocations(
    stationsBeforeSplit.map((x) => ({ locationName: x })),
    !noSplits
  );

  if (noSplits) {
    if (stationsBeforeSplit.length === 1) {
      text += ' only';
    }

    return text;
  }

  text += ', where the train divides. Please make sure you travel in the correct part of the train. ';

  /**
   * Indexes of split locations, in order of train sections.
   */
  const splits: { set: number; stop: number; crs: string; coachesToDest: number; position: string }[] = [];

  trainData.subsequentCallingPoints.forEach((pointSet, i) => {
    const pointCount = pointSet.callingPoint.length;

    [...pointSet.callingPoint].reverse().forEach((point, j) => {
      if (point.detachFront) {
        splits.push({ set: i, stop: pointCount - j, crs: point.crs, coachesToDest: -1, position: '' });
      }
    });
  });

  // Add through destination
  splits.unshift({ set: -1, stop: -1, crs: trainData.destination[0].crs, coachesToDest: -1, position: '' });

  // Fill in coach counts
  splits.forEach((_, i) => {
    const points = trainData.subsequentCallingPoints![i].callingPoint;
    const lastPoint = points[points.length - 1];
    splits[i].coachesToDest = lastPoint.length || -1;
  });

  const splitCount = splits.length;

  if (splitCount === 2) {
    splits[0].position = 'front';
    splits[1].position = 'rear';
  } else if (splitCount === 3) {
    splits[0].position = 'front';
    splits[1].position = 'middle';
    splits[2].position = 'rear';
  }

  const travelAreas: Record<string, number[]> = {};
  const crsToStationName: Record<string, string> = {};

  trainData.subsequentCallingPoints.forEach((pointSet, i) => {
    pointSet.callingPoint.forEach((point, j) => {
      travelAreas[point.crs] ||= [];
      travelAreas[point.crs].push(i);
      crsToStationName[point.crs] = point.locationName;
    });
  });

  splits.forEach((split, i) => {
    let area = i;

    while (area >= 1) {
      if (!travelAreas[split.crs].includes(area)) travelAreas[split.crs].push(area);
      area--;
    }
  });

  const travelAreaDescriptive: Record<string, string> = {};

  Object.entries(travelAreas).forEach(([crs, areas]) => {
    if (travelAreaDescriptive[crs]) return;

    areas = areas.sort();

    if (areas.length === splitCount) {
      travelAreaDescriptive[crs] = 'any part of the train';
      return;
    }

    if (areas.length === 1) {
      const split = splits[areas[0]];
      travelAreaDescriptive[crs] = `the ${split.position} ${split.coachesToDest} carriages`;
      return;
    }

    if (areas[0] === 0 && areas[1] === 1) {
      travelAreaDescriptive[crs] = `the front ${splits[0].coachesToDest + splits[1].coachesToDest} carriages`;
      return;
    }

    if (areas[0] === 1 && areas[1] === 2) {
      travelAreaDescriptive[crs] = `the rear ${splits[1].coachesToDest + splits[2].coachesToDest} carriages`;
      return;
    }

    travelAreaDescriptive[crs] = `the ${splits[areas[0]].position} ${splits[areas[0]].coachesToDest} carriages`;
  });

  const stationsByTravelArea: Record<string, string[]> = {};

  Object.entries(travelAreaDescriptive).forEach(([crs, desc]) => {
    stationsByTravelArea[desc] ||= [];
    stationsByTravelArea[desc].push(crs);
  });

  const allAreas = Object.keys(stationsByTravelArea);

  allAreas.forEach((area) => {
    text += ' Passengers for ';
    text += combineLocations(
      stationsByTravelArea[area].map((crs) => ({
        locationName: crsToStationName[crs],
      }))
    );
    text += ' should travel in ';
    text += area;
    text += '.';
  });

  return text;
}
