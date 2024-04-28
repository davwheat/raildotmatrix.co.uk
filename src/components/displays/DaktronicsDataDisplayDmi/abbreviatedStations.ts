const AbbreviatedStations: Record<string, string> = {
  BHM: 'Birmingham New St',
  BRI: 'Bristol T Meads',
  HDM: 'Haddenham & T Pkwy',
  HXX: 'Heathrow T123',
  LSP: 'Liverpool South Pkwy',
  MAN: 'Manchester Picc',
  PMH: 'Portsmouth Hbr',
  PMS: 'Portsmouth & SSea',
  SOA: 'Southampton Arpt Pwy',
  SOU: 'Southampton Ctl',
  SLQ: 'St Leonards WS',
  STP: 'London St Pancras Intl',
  WOF: 'Worcester Fgt St',
  WOP: 'Worcestershire Pkwy',
};

export function getStationWithOverride(crs: string, name: string): string {
  return AbbreviatedStations[crs] ?? name;
}
