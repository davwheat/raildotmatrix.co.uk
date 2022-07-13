import { TrainService } from '../../../api/GetNextTrainsAtStation';
import { combineLocations } from './combineLocations';

export default function generateCallingPointsText(trainData: TrainService): string {
  if (!trainData.subsequentCallingPoints) return '';

  let text = '';

  const stationsBeforeSplit: string[] = [];

  /**
   * Indexes of split locations, in order of train sections.
   */
  const splits: { set: number; stop: number; crs: string; coachesToDest: number; position: string }[] = [];

  trainData.subsequentCallingPoints
    .slice(1)
    .map((points) => points.callingPoint[0])
    .forEach((splitPoint) => {
      splits.push({ set: -1, stop: -1, crs: splitPoint.crs, coachesToDest: -1, position: '' });
    });

  let noSplits = splits.length === 0;

  if (trainData.subsequentCallingPoints.length > 1 && noSplits) {
    // We are splitting at this station
    noSplits = false;
  }

  if (noSplits) {
    text += combineLocations(trainData.subsequentCallingPoints[0].callingPoint, true);

    if (stationsBeforeSplit.length === 1) {
      text += ' only';
    }

    return text;
  }

  trainData.subsequentCallingPoints[0].callingPoint.every((stop, i) => {
    stationsBeforeSplit.push(stop.locationName);

    if (stop.crs === splits[0].crs) {
      splits[0].stop = i;
      return false;
    }

    return true;
  });

  if (stationsBeforeSplit.length) {
    text += 'Calling at ';

    text += combineLocations(
      stationsBeforeSplit.map((x) => ({ locationName: x })),
      !noSplits
    );

    text += ', where the train divides. ';
  } else {
    text += 'This train divides here. ';
  }

  text += 'Please make sure you travel in the correct part of the train. ';

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
    let stops = pointSet.callingPoint;

    if (i === 0) {
      stops = pointSet.callingPoint.slice(stationsBeforeSplit.length);
    } else {
      stops = pointSet.callingPoint.slice(1);
    }

    stops.forEach((point) => {
      travelAreas[point.crs] ||= [];
      travelAreas[point.crs].push(i);
      crsToStationName[point.crs] = point.locationName;
    });
  });

  const travelAreaDescriptive: Record<string, string> = {};

  Object.entries(travelAreas).forEach(([crs, areas]) => {
    if (travelAreaDescriptive[crs]) return;

    areas = areas.sort();

    if (areas.length === splitCount) {
      travelAreaDescriptive[crs] = `the ${splits[areas[0]].position} ${splits[areas[0]].coachesToDest} carriages`;
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
