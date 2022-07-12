import GenerateUrl from './GenerateUrl';

import example from './ExampleResponse.json';

export interface Location {
  locationName: string;
  crs: string;
  via?: string;
}

export interface CallingPointLocation {
  locationName: string;
  crs: string;
  st: string;
  et: string;
  at?: string;
  isCancelled?: boolean;
  length?: number;
  detachFront: boolean;
}

export interface CallingPoints {
  assocIsCancelled: boolean;
  serviceChangeRequired: boolean;
  serviceType: number;
  callingPoint: CallingPointLocation[];
}

export interface TrainService {
  destination: Location[];
  origin: Location[];

  currentDestinations: Location[] | null;
  currentOrigin: Location[] | null;

  delayReason?: string;
  detachFront: boolean;
  eta?: string;
  etd?: string;
  sta?: string;
  std?: string;
  filterLocationCancelled: boolean;
  // formation?: {
  //   coaches?: number;
  // };
  isCancelled: boolean;
  isCircularRoute: boolean;
  length?: number;
  operator: string;
  operatorCode: string;
  platform?: string;
  previousCallingPoints: null | CallingPoints[];
  subsequentCallingPoints: null | CallingPoints[];

  serviceIdGuid: string;
  serviceID: string;
}

export interface ApiResponse {
  areServicesAvailable: boolean;
  crs: string;
  locationName: string;
  nrccMessages: null | string[];
  platformAvailable: boolean;
  trainServices: TrainService[];
}

interface IOptions {
  count?: number;
  timeWindow?: number;
  minOffset: number;
  mustStopAt?: string | null;
}

export default async function GetNextTrainsAtStation(
  station: string,
  options: IOptions = { count: 3, timeWindow: 120, minOffset: 0, mustStopAt: null },
  abortController?: AbortController
): Promise<ApiResponse | null | { error: true }> {
  return example;

  if (options.minOffset < -239) {
    console.error('Time offset cannot be more than 239 minutes in the past.');
    return null;
  }
  if (options.minOffset > 119) {
    console.error('Time offset cannot be more than 119 minutes in the future.');
    return null;
  }

  let response = await fetch(
    GenerateUrl('departures', [station], {
      expand: true,
      numServices: options.count || 3,
      timeOffset: options.minOffset || 0,
      timeWindow: options.timeWindow || 120,
    }),
    {
      signal: abortController ? abortController.signal : undefined,
    }
  );

  if (response.ok === false) {
    return { error: true };
  }

  return await response.json();
}
