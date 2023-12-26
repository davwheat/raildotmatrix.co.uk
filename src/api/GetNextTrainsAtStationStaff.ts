import { StaffServicesResponse } from '../../functions/api/getServices';

export type { StaffServicesResponse };

interface IOptions {
  count?: number;
  timeWindow?: number;
  minOffset: number;
  mustStopAt?: string | null;
}

export default async function GetNextTrainsAtStationStaff(
  station: string,
  options: IOptions = { count: 3, timeWindow: 120, minOffset: 0, mustStopAt: null },
  abortController?: AbortController
): Promise<StaffServicesResponse | null | { error: true }> {
  // return require('./ExampleStaffResponse.json');

  if (options.minOffset < -239) {
    console.error('Time offset cannot be more than 239 minutes in the past.');
    return null;
  }
  if (options.minOffset > 119) {
    console.error('Time offset cannot be more than 119 minutes in the future.');
    return null;
  }

  const params = new URLSearchParams({
    station,
    count: options?.count?.toString() || '10',
    timeWindow: options?.timeWindow?.toString() || '120',
    minOffset: options?.minOffset?.toString() || '0',
  });

  let response: Response;

  try {
    response = await fetch(`/api/getServices?${params}`, {
      signal: abortController ? abortController.signal : undefined,
    });
  } catch (e) {
    console.error(e);
    return { error: true };
  }

  if (response.ok === false) {
    return { error: true };
  }

  return await response.json();
}
