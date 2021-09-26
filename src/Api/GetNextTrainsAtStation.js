import GenerateUrl from './GenerateUrl';

export default async function GetNextTrainsAtStation(
  station,
  options = { count: 3, timeWindow: 120, minOffset: 0, mustStopAt: null },
  abortController
) {
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
