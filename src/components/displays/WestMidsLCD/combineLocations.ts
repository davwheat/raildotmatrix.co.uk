import { IMyTrainService } from '../../../api/ProcessServices';

export function combineLocations(locations: IMyTrainService['destinations'], showAnd: boolean = true): string {
  const names = locations.map((l) => {
    if (l.via) {
      let v = l.via;

      // Need lowercase as GTR sometimes feeds data with "Via " instead of the standard "via "
      if (v.toLowerCase().startsWith('via ')) v = v.substring(4);

      return `${l.name} via ${v}`;
    }

    return l.name;
  });

  if (names.length === 1) return names[0];

  if (!showAnd) {
    return names.join(', ');
  }

  const lastName = names.pop();
  return names.join(', ') + ' and ' + lastName;
}
