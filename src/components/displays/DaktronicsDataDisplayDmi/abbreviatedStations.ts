const AbbreviatedStations: Record<string, string> = {
  BHM: 'Birmingham New St',
  BRI: 'Bristol T Meads',
  HDM: 'Haddenham & T Pkwy',
  HXX: 'Heathrow T123',
  LSP: 'Liverpool South Pkwy',
  MAN: 'Manchester Picc',
  PAD: 'London Padd',
  PMH: 'Portsmouth Hbr',
  PMS: 'Portsmouth & SSea',
  SOA: 'Southampton Arpt Pwy',
  SOU: 'Southampton Ctl',
  SLQ: 'St Leonards WS',
  STP: 'St Pancras Intl',
  WOF: 'Worcester Fgt St',
  WOP: 'Worcestershire Pkwy',
  WSM: 'Weston S Mare',
};

export function getStationWithOverride(crs: string, name: string): string {
  return AbbreviatedStations[crs] ?? name;
}
