export function combineLocations(locations: { locationName: string; via?: string; [x: string]: any }[], showAnd: boolean = true): string {
  const names = locations.map((l) => {
    if (l.via) {
      let v = l.via;

      if (v.startsWith('via ')) v = v.substring(4);

      return `${l.locationName} via ${v}`;
    }

    return l.locationName;
  });

  if (names.length === 1) return names[0];

  if (!showAnd) {
    return names.join(', ');
  }

  const lastName = names.pop();

  return names.join(', ') + ' and ' + lastName;
}
