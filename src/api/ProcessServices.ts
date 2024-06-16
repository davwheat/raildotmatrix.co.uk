import LatenessCodes from './LatenessCodes.json';
import CancellationCodes from './CancellationCodes.json';

import type { StaffServicesResponse } from './GetNextTrainsAtStationStaff';
import { Association, AssociationCategory } from '../../functions/api/getServices';

import dayjs from 'dayjs';
import dayjsUtc from 'dayjs/plugin/utc';
import dayjsTz from 'dayjs/plugin/timezone';
import { crsToStationName } from '../functions/crsToStationName';

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTz);

dayjs.tz.setDefault('Europe/London');

class CallPoint implements IPassengerCallPoint {
  name: string;
  isCancelled: boolean;
  scheduledDeparture: Date | null;
  estimatedDeparture: Date | null;
  scheduledArrival: Date | null;
  estimatedArrival: Date | null;
  length: number | null;
  associations: IAssociation[];

  displayedArrivalTime(formatString: string = 'HH:mm'): string | null {
    if (this.isCancelled) return null;

    const time = this.estimatedArrival || this.scheduledArrival;

    if (!time) return null;

    return dayjs.tz(time).format(formatString);
  }

  constructor({
    name,
    isCancelled,
    scheduledDeparture,
    estimatedDeparture,
    scheduledArrival,
    estimatedArrival,
    associations,
    length,
  }: {
    name: string;
    isCancelled: boolean;
    scheduledDeparture: Date | null;
    estimatedDeparture: Date | null;
    scheduledArrival: Date | null;
    estimatedArrival: Date | null;
    associations: IAssociation[];
    length: number | null;
  }) {
    this.name = name;
    this.isCancelled = isCancelled;
    this.scheduledDeparture = scheduledDeparture;
    this.estimatedDeparture = estimatedDeparture;
    this.scheduledArrival = scheduledArrival;
    this.estimatedArrival = estimatedArrival;
    this.associations = associations;
    this.length = length;
  }
}

class Service implements IMyTrainService {
  destinations: { name: string; via: null | string; crs: string }[];
  origins: { name: string; via: null | string; crs: string }[];
  cancelled: boolean;
  scheduledDeparture: Date | null;
  estimatedDeparture: Date | null;
  actualDeparture: Date | null;
  hasDeparted: boolean;
  scheduledArrival: Date | null;
  estimatedArrival: Date | null;
  actualArrival: Date | null;
  hasArrived: boolean;
  length: number | null;
  toc: string;
  passengerCallPoints: IPassengerCallPoint[];
  id: string;
  private _cancelReason: NonNullable<StaffServicesResponse['trainServices']>[number]['cancelReason'];
  private _delayReason: NonNullable<StaffServicesResponse['trainServices']>[number]['delayReason'];

  private _boardStationCrs: string;
  private _boardStationName: string;

  get cancelReason(): string | null {
    if (!this._cancelReason) return null;

    let reason = (CancellationCodes as Record<string, string | undefined>)[this._cancelReason!!.value.toString()];
    if (!reason) return null;

    if (reason && this._cancelReason!!.stationName) {
      reason += ` near ${this._cancelReason!!.stationName}`;
    }

    reason += '.';

    return reason;
  }

  get delayReason(): string | null {
    if (!this._delayReason) return null;

    let reason = (LatenessCodes as Record<string, string | undefined>)[this._delayReason!!.value.toString()];
    if (!reason) return null;

    if (reason && this._delayReason!!.stationName) {
      reason += ` near ${this._delayReason!!.stationName}`;
    }

    reason += '.';

    return reason;
  }

  isDelayed(useActualDepTime: boolean = false): boolean {
    return dayjs.tz(useActualDepTime ? this.actualDeparture : this.estimatedDeparture).diff(dayjs.tz(this.scheduledDeparture), 'minute') >= 1;
  }

  displayedDepartureTime(
    timePrefix: string | undefined = undefined,
    formatString: string = 'HH:mm',
    onTimeText: string | undefined = 'On time'
  ): string {
    if (this.cancelled) return 'Cancelled';
    if (this.hasDeparted || this.hasArrived) {
      if (!this.origins.some((o) => this._boardStationCrs === o.crs)) {
        return 'Arrived';
      } else {
        // This is the origin. We can't use etd if it's departed.
        const depTime = this.actualDeparture || this.estimatedDeparture || this.scheduledDeparture!!;

        if (!this.isDelayed(this.hasDeparted)) return onTimeText ?? dayjs.tz(this.scheduledDeparture).format(formatString);
        return `${timePrefix ?? ''}${dayjs.tz(depTime).format(formatString)}`;
      }
    }
    if (!this.estimatedDeparture) return 'Delayed';
    if (!this.isDelayed()) return onTimeText ?? dayjs.tz(this.scheduledDeparture).format(formatString);
    if (this.estimatedDeparture) return `${timePrefix ?? ''}${dayjs.tz(this.estimatedDeparture).format(formatString)}`;
    return `${timePrefix ?? ''}${dayjs.tz(this.scheduledDeparture).format(formatString)}`;
  }

  constructor({
    destinations,
    origins,
    cancelled,
    scheduledDeparture,
    estimatedDeparture,
    actualDeparture,
    hasDeparted,
    scheduledArrival,
    estimatedArrival,
    actualArrival,
    hasArrived,
    length,
    toc,
    passengerCallPoints,
    cancelReason,
    delayReason,
    boardStationCrs,
    id,
  }: {
    destinations: { name: string; via: null | string; crs: string }[];
    origins: { name: string; via: null | string; crs: string }[];
    cancelled: boolean;
    scheduledDeparture: Date | null;
    estimatedDeparture: Date | null;
    actualDeparture: Date | null;
    hasDeparted: boolean;
    scheduledArrival: Date | null;
    estimatedArrival: Date | null;
    actualArrival: Date | null;
    hasArrived: boolean;
    length: number | null;
    toc: string;
    passengerCallPoints: IPassengerCallPoint[];
    cancelReason: NonNullable<StaffServicesResponse['trainServices']>[number]['cancelReason'];
    delayReason: NonNullable<StaffServicesResponse['trainServices']>[number]['delayReason'];
    boardStationCrs: string;
    id: string;
  }) {
    this.destinations = destinations;
    this.origins = origins;
    this.cancelled = cancelled;
    this.scheduledDeparture = scheduledDeparture;
    this.estimatedDeparture = estimatedDeparture;
    this.actualDeparture = actualDeparture;
    this.hasDeparted = hasDeparted;
    this.scheduledArrival = scheduledArrival;
    this.estimatedArrival = estimatedArrival;
    this.actualArrival = actualArrival;
    this.hasArrived = hasArrived;
    this.length = length;
    this.toc = toc;
    this.passengerCallPoints = passengerCallPoints;
    this._cancelReason = cancelReason;
    this._delayReason = delayReason;
    this._boardStationCrs = boardStationCrs;
    this.id = id;

    this._boardStationName = crsToStationName(this._boardStationCrs) || '';
  }
}

export interface IAssociation<Category extends AssociationCategory = AssociationCategory> {
  type: Category;
  /**
   * NOTE: All associations' calling point locations **will** contain the dividing point!
   */
  service: Category extends AssociationCategory.Divide ? IMyTrainService : undefined;
}

interface IPassengerCallPoint {
  name: string;
  isCancelled: boolean;
  scheduledDeparture: Date | null;
  estimatedDeparture: Date | null;
  scheduledArrival: Date | null;
  estimatedArrival: Date | null;
  length: number | null;
  associations: IAssociation[];
  displayedArrivalTime(formatString?: string): string | null;
}

export interface IMyTrainService {
  id: string;

  destinations: { name: string; via: null | string; crs: string }[];
  origins: { name: string; via: null | string; crs: string }[];
  cancelled: boolean;
  scheduledDeparture: Date | null;
  estimatedDeparture: Date | null;
  actualDeparture: Date | null;
  hasDeparted: boolean;
  scheduledArrival: Date | null;
  estimatedArrival: Date | null;
  actualArrival: Date | null;
  hasArrived: boolean;
  length: number | null;
  toc: string;
  passengerCallPoints: IPassengerCallPoint[];
  cancelReason: string | null;
  delayReason: string | null;

  /**
   * Returns whether the estimated departure is later than the scheduled departure.
   *
   * This **does not** account for cancelled services.
   */
  isDelayed(): boolean;
  displayedDepartureTime(timePrefix?: string, formatString?: string, onTimeText?: string | null): string;
}

export function getLegacyTocName(tocCode: string) {
  switch (tocCode.toUpperCase()) {
    case 'AW':
      return 'Arriva Trains Wales';
    case 'CC':
      return 'c2c';
    case 'CH':
      return 'Chiltern Railways';
    case 'CS':
      return 'Caledonian Sleeper';
    case 'EM':
      return 'East Midlands Trains';
    case 'ES':
      return 'Eurostar';
    case 'GC':
      return 'Grand Central';
    case 'GN':
      return 'First Capital Connect';
    case 'GR':
      return 'National Express East Coast';
    case 'GW':
      return 'First Great Western';
    case 'GX':
      return 'Gatwick Express';
    case 'HT':
      return 'Hull Trains';
    case 'HX':
      return 'Heathrow Express';
    case 'IL':
      return 'Island Line';
    case 'LD':
      return 'Lumo';
    case 'LE':
      return 'One';
    case 'LM':
      return 'London Midland';
    case 'LO':
      return 'London Overground';
    case 'ME':
      return 'Merseyrail';
    case 'NT':
      return 'Northern Rail';
    case 'SE':
      return 'Southeastern';
    case 'SN':
      return 'Southern';
    case 'SR':
      return 'ScotRail';
    case 'SW':
      return 'South West Trains';
    case 'TL':
      return 'First Capital Connect';
    case 'TP':
      return 'First Transpennine Express';
    case 'TW':
      return 'Tyne & Wear Metro';
    case 'VT':
      return 'Virgin Trains';
    case 'XC':
      return 'Virgin Trains';
    case 'XR':
      return 'TfL Rail';

    default:
      return '';
  }
}

export function processServices(
  services: NonNullable<StaffServicesResponse['trainServices']>,
  platforms: string[] | null,
  useLegacyTocNames: boolean,
  boardStationCrs: string,
  showUnconfirmedPlatforms: boolean = false
): IMyTrainService[] {
  platforms = platforms?.map((p) => p.toUpperCase()) ?? null;

  const applicableServices = services.filter((s) => {
    if (!s.isPassengerService || s.isOperationalCall || !s.stdSpecified) {
      return false;
    }

    if (showUnconfirmedPlatforms && s.platform === null) {
      return true;
    }

    // Platform filtering
    if (platforms && platforms.length > 0 && (s.platform === null || !platforms.includes(s.platform.toUpperCase()))) {
      return false;
    }

    return true;
  });

  return applicableServices
    .map((service): IMyTrainService => {
      console.log(service);

      let serviceLength = service.length;
      let currentLength = service.length;

      const stops = service.subsequentLocations
        // Non-passenger stops
        .filter((s) => {
          if (!s.crs) return false;
          // Force the calling point if the train divides here
          if (s.associations?.filter((a) => a.category === AssociationCategory.Divide).length) return true;
          if ((s.isCancelled && !service.isCancelled) || s.isOperational || s.isPass) return false;
          // Ignore pick-up only
          // if (s.activities === 'U') return false;
          return true;
        })
        .map((location) => {
          const assoc = (location.associations || []).map((association) => {
            return {
              type: association.category,
              service:
                association.category === AssociationCategory.Divide
                  ? processAssociatedService(association, service, boardStationCrs) || undefined
                  : undefined,
            };
          });

          assoc.forEach((a) => {
            if (!a.service || !serviceLength || !currentLength) return;

            if (a.service.length === null) {
              serviceLength = null;
              currentLength = null;
            } else {
              currentLength!! -= a.service?.length || 0;
            }
          });

          return new CallPoint({
            name: location.locationName,
            isCancelled: service.isCancelled || location.isCancelled,
            scheduledDeparture: location.stdSpecified ? dayjs.tz(location.std).toDate() : null,
            estimatedDeparture: location.etdSpecified ? dayjs.tz(location.etd).toDate() : null,
            scheduledArrival: location.staSpecified ? dayjs.tz(location.sta).toDate() : null,
            estimatedArrival: location.etaSpecified ? dayjs.tz(location.eta).toDate() : null,
            length: currentLength,
            associations: assoc,
          });
        });

      return new Service({
        destinations: (service.isCancelled ? service.destination : service.currentDestinations || service.destination).map((d) => ({
          name: d.locationName,
          via: d.via,
          crs: d.crs,
        })),
        origins: (service.isCancelled ? service.origin : service.currentOrigins || service.origin).map((o) => ({
          name: o.locationName,
          via: o.via,
          crs: o.crs,
        })),

        cancelled: service.isCancelled,

        cancelReason: service.cancelReason,
        delayReason: service.delayReason,

        scheduledDeparture: service.stdSpecified ? dayjs.tz(service.std).toDate() : null,
        estimatedDeparture: service.etdSpecified ? dayjs.tz(service.etd).toDate() : null,
        actualDeparture: service.atdSpecified ? dayjs.tz(service.atd).toDate() : null,
        hasDeparted: !!service.atdSpecified,

        scheduledArrival: service.staSpecified ? dayjs.tz(service.sta).toDate() : null,
        estimatedArrival: service.etaSpecified ? dayjs.tz(service.eta).toDate() : null,
        actualArrival: service.ataSpecified ? dayjs.tz(service.ata).toDate() : null,
        hasArrived: !!service.ataSpecified,

        length: serviceLength,
        toc: useLegacyTocNames ? getLegacyTocName(service.operatorCode) || service.operator : service.operator,

        passengerCallPoints: stops,
        boardStationCrs: boardStationCrs,
        id: `${boardStationCrs}_${service.rid}`,
      });
    })
    .sort((a, b) => {
      const aTime = a.actualDeparture || a.estimatedDeparture || a.scheduledDeparture;
      const bTime = b.actualDeparture || b.estimatedDeparture || b.scheduledDeparture;
      return aTime && bTime ? aTime.getTime() - bTime.getTime() : 0;
    });
}

function processAssociatedService(
  association: Association<AssociationCategory.Divide>,
  ogService: NonNullable<StaffServicesResponse['trainServices']>[number],
  boardStationCrs: string
): IMyTrainService | null {
  const service = association.service;

  const stop1 = service.locations[0];

  const ogDests = ogService.currentDestinations || ogService.destination;
  const applicableOgDest = ogDests.find((d) => d.tiploc === association.destTiploc);

  const ogOrigins = ogService.currentOrigins || ogService.origin;

  return new Service({
    destinations: (applicableOgDest
      ? [applicableOgDest]
      : stop1.falseDest || [{ locationName: association.destination, crs: association.destCRS }]
    ).map((d) => ({
      name: d.locationName,
      via: 'via' in d ? d.via : null,
      crs: d.crs,
    })),
    origins: ogOrigins.map((o) => ({ name: o.locationName, via: o.via, crs: o.crs })),

    cancelled: association.isCancelled,

    cancelReason: service.cancelReason,
    delayReason: service.delayReason,

    scheduledDeparture: service.stdSpecified ? dayjs.tz(service.std).toDate() : null,
    estimatedDeparture: service.etdSpecified ? dayjs.tz(service.etd).toDate() : null,
    actualDeparture: service.atdSpecified ? dayjs.tz(service.atd).toDate() : null,
    hasDeparted: !!service.atdSpecified,

    scheduledArrival: service.staSpecified ? dayjs.tz(service.sta).toDate() : null,
    estimatedArrival: service.etaSpecified ? dayjs.tz(service.eta).toDate() : null,
    actualArrival: service.ataSpecified ? dayjs.tz(service.ata).toDate() : null,
    hasArrived: !!service.ataSpecified,

    length: stop1.length,
    toc: ogService.operator,
    boardStationCrs: boardStationCrs,
    id: `${boardStationCrs}_${service.rid}`,

    passengerCallPoints: service.locations
      // Non-passenger stops
      .filter((l) => l.crs && (association.isCancelled ? true : !l.isCancelled) && !l.isOperational && !l.isPass)
      .map(
        (location) =>
          new CallPoint({
            name: location.locationName,
            isCancelled: association.isCancelled || location.isCancelled,
            scheduledDeparture: location.stdSpecified ? dayjs.tz(location.std).toDate() : null,
            estimatedDeparture: location.etdSpecified ? dayjs.tz(location.etd).toDate() : null,
            scheduledArrival: location.staSpecified ? dayjs.tz(location.sta).toDate() : null,
            estimatedArrival: location.etaSpecified ? dayjs.tz(location.eta).toDate() : null,
            associations: [],
            length: stop1.length,
          })
      ),
  });
}
