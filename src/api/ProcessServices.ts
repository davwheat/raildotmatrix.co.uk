import LatenessCodes from './LatenessCodes.json';
import CancellationCodes from './CancellationCodes.json';

import type { StaffServicesResponse } from './GetNextTrainsAtStationStaff';
import { Association, AssociationCategory } from '../../functions/api/getServices';

import dayjs from 'dayjs';
import dayjsUtc from 'dayjs/plugin/utc';
import dayjsTz from 'dayjs/plugin/timezone';

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

  displayedArrivalTime(): string | null {
    if (this.isCancelled) return null;

    const time = this.estimatedArrival || this.scheduledArrival;

    if (!time) return null;

    return dayjs(time).format('HH:mm');
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
  destinations: { name: string; via: null | string }[];
  origins: { name: string; via: null | string }[];
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
  private _cancelReason: NonNullable<StaffServicesResponse['trainServices']>[number]['cancelReason'];
  private _delayReason: NonNullable<StaffServicesResponse['trainServices']>[number]['delayReason'];

  get cancelReason(): string | null {
    if (!this._cancelReason) return null;

    let reason = (CancellationCodes as Record<string, string>)[this._cancelReason!!.value.toString()];

    if (reason && this._cancelReason!!.stationName) {
      reason += ` near ${this._cancelReason!!.stationName}`;
    }

    reason += '.';

    return reason;
  }

  get delayReason(): string | null {
    if (!this._delayReason) return null;

    let reason = (LatenessCodes as Record<string, string>)[this._delayReason!!.value.toString()];

    if (reason && this._delayReason!!.stationName) {
      reason += ` near ${this._delayReason!!.stationName}`;
    }

    reason += '.';

    return reason;
  }

  isDelayed(): boolean {
    return dayjs(this.estimatedDeparture).diff(dayjs(this.scheduledDeparture), 'minute') >= 1;
  }

  displayedDepartureTime(): string {
    if (this.cancelled) return 'Cancelled';
    if (this.hasDeparted || this.hasArrived) return 'Arrived';
    if (!this.isDelayed()) return 'On time';
    if (this.estimatedDeparture) return dayjs(this.estimatedDeparture).format('HH:mm');
    if (this.scheduledDeparture) return dayjs(this.scheduledDeparture).format('HH:mm');
    return 'Delayed';
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
  }: {
    destinations: { name: string; via: null | string }[];
    origins: { name: string; via: null | string }[];
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
  displayedArrivalTime(): string | null;
}

export interface IMyTrainService {
  destinations: { name: string; via: null | string }[];
  origins: { name: string; via: null | string }[];
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

  isDelayed(): boolean;
  displayedDepartureTime(): string;
}

export function processServices(services: NonNullable<StaffServicesResponse['trainServices']>): IMyTrainService[] {
  const applicableServices = services.filter((s) => s.isPassengerService && !s.isOperationalCall && s.stdSpecified);

  return applicableServices
    .map((service): IMyTrainService => {
      console.log(service);

      let serviceLength = service.length;
      let currentLength = service.length;

      const stops = service.subsequentLocations
        // Non-passenger stops
        .filter((l) => l.crs && (service.isCancelled ? true : !l.isCancelled) && !l.isOperational && !l.isPass)
        .map((location) => {
          const assoc = (location.associations || []).map((association) => {
            return {
              type: association.category,
              service: association.category === AssociationCategory.Divide ? processAssociatedService(association, service) || undefined : undefined,
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
            scheduledDeparture: location.stdSpecified ? dayjs(location.std).toDate() : null,
            estimatedDeparture: location.etdSpecified ? dayjs(location.etd).toDate() : null,
            scheduledArrival: location.staSpecified ? dayjs(location.sta).toDate() : null,
            estimatedArrival: location.etaSpecified ? dayjs(location.eta).toDate() : null,
            length: currentLength,
            associations: assoc,
          });
        });

      return new Service({
        destinations: (service.currentDestinations || service.destination).map((d) => ({ name: d.locationName, via: d.via })),
        origins: (service.currentOrigins || service.origin).map((o) => ({ name: o.locationName, via: o.via })),

        cancelled: service.isCancelled,

        cancelReason: service.cancelReason,
        delayReason: service.delayReason,

        scheduledDeparture: service.stdSpecified ? dayjs(service.std).toDate() : null,
        estimatedDeparture: service.etdSpecified ? dayjs(service.etd).toDate() : null,
        actualDeparture: service.atdSpecified ? dayjs(service.atd).toDate() : null,
        hasDeparted: !!service.atdSpecified,

        scheduledArrival: service.staSpecified ? dayjs(service.sta).toDate() : null,
        estimatedArrival: service.etaSpecified ? dayjs(service.eta).toDate() : null,
        actualArrival: service.ataSpecified ? dayjs(service.ata).toDate() : null,
        hasArrived: !!service.ataSpecified,

        length: serviceLength,
        toc: service.operator,

        passengerCallPoints: stops,
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
  ogService: NonNullable<StaffServicesResponse['trainServices']>[number]
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
    })),
    origins: ogOrigins.map((o) => ({ name: o.locationName, via: o.via })),

    cancelled: association.isCancelled,

    cancelReason: service.cancelReason,
    delayReason: service.delayReason,

    scheduledDeparture: service.stdSpecified ? dayjs(service.std).toDate() : null,
    estimatedDeparture: service.etdSpecified ? dayjs(service.etd).toDate() : null,
    actualDeparture: service.atdSpecified ? dayjs(service.atd).toDate() : null,
    hasDeparted: !!service.atdSpecified,

    scheduledArrival: service.staSpecified ? dayjs(service.sta).toDate() : null,
    estimatedArrival: service.etaSpecified ? dayjs(service.eta).toDate() : null,
    actualArrival: service.ataSpecified ? dayjs(service.ata).toDate() : null,
    hasArrived: !!service.ataSpecified,

    length: stop1.length,
    toc: ogService.operator,

    passengerCallPoints: service.locations
      // Non-passenger stops
      .filter((l) => l.crs && (association.isCancelled ? true : !l.isCancelled) && !l.isOperational && !l.isPass)
      .map(
        (location) =>
          new CallPoint({
            name: location.locationName,
            isCancelled: association.isCancelled || location.isCancelled,
            scheduledDeparture: location.stdSpecified ? dayjs(location.std).toDate() : null,
            estimatedDeparture: location.etdSpecified ? dayjs(location.etd).toDate() : null,
            scheduledArrival: location.staSpecified ? dayjs(location.sta).toDate() : null,
            estimatedArrival: location.etaSpecified ? dayjs(location.eta).toDate() : null,
            associations: [],
            length: stop1.length,
          })
      ),
  });
}
