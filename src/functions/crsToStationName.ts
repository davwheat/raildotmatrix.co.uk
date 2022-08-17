import StationsListJSON from 'uk-railway-stations';

export function crsToStationName(crs: string): string | null {
  crs = crs.toUpperCase();

  return StationsListJSON.find((station) => station.crsCode === crs)?.stationName ?? null;
}
