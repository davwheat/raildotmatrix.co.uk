import React from 'react';

import TrainService from './TrainService';

import dayjs from 'dayjs';
import dayjsUtc from 'dayjs/plugin/utc';
import dayjsTz from 'dayjs/plugin/timezone';

import type { StaffServicesResponse } from '../../../api/GetNextTrainsAtStationStaff';
import SwapBetween from './SwapBetween';
import Separator from './Separator';

import LatenessCodes from '../../../api/LatenessCodes.json';
import CancellationCodes from '../../../api/CancellationCodes.json';

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTz);

dayjs.tz.setDefault('Europe/London');

type AssociationType = 'join' | 'divide' | 'linkedPrevious' | 'linkedNext';
const CategoryToAssociationType: AssociationType[] = ['join', 'divide', 'linkedPrevious', 'linkedNext'];

class CallPoint implements IPassengerCallPoint {
  name: string;
  isCancelled: boolean;
  scheduledDeparture: Date | null;
  estimatedDeparture: Date | null;
  scheduledArrival: Date | null;
  estimatedArrival: Date | null;
  associations:
    | null
    | {
        type: AssociationType | null;
        service: IMyTrainService;
      }[];

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
  }: {
    name: string;
    isCancelled: boolean;
    scheduledDeparture: Date | null;
    estimatedDeparture: Date | null;
    scheduledArrival: Date | null;
    estimatedArrival: Date | null;
    associations:
      | null
      | {
          type: AssociationType | null;
          service: IMyTrainService;
        }[];
  }) {
    this.name = name;
    this.isCancelled = isCancelled;
    this.scheduledDeparture = scheduledDeparture;
    this.estimatedDeparture = estimatedDeparture;
    this.scheduledArrival = scheduledArrival;
    this.estimatedArrival = estimatedArrival;
    this.associations = associations;
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
  length: number;
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
    length: number;
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

interface IPassengerCallPoint {
  name: string;
  isCancelled: boolean;
  scheduledDeparture: Date | null;
  estimatedDeparture: Date | null;
  scheduledArrival: Date | null;
  estimatedArrival: Date | null;
  associations:
    | null
    | {
        type: AssociationType | null;
        service: IMyTrainService;
      }[];
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
  length: number;
  toc: string;
  passengerCallPoints: IPassengerCallPoint[];
  cancelReason: string | null;
  delayReason: string | null;

  isDelayed(): boolean;
  displayedDepartureTime(): string;
}

function processServices(services: NonNullable<StaffServicesResponse['trainServices']>): IMyTrainService[] {
  const applicableServices = services.filter((s) => s.isPassengerService && !s.isOperationalCall);

  return applicableServices
    .map((service): IMyTrainService => {
      console.log(service);

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

        length: service.length,
        toc: service.operator,

        passengerCallPoints: service.subsequentLocations
          // Non-passenger stops
          .filter((l) => l.crs && (service.isCancelled ? true : !l.isCancelled) && !l.isOperational && !l.isPass)
          .map(
            (location) =>
              new CallPoint({
                name: location.locationName,
                isCancelled: service.isCancelled || location.isCancelled,
                scheduledDeparture: location.stdSpecified ? dayjs(location.std).toDate() : null,
                estimatedDeparture: location.etdSpecified ? dayjs(location.etd).toDate() : null,
                scheduledArrival: location.staSpecified ? dayjs(location.sta).toDate() : null,
                estimatedArrival: location.etaSpecified ? dayjs(location.eta).toDate() : null,
                associations: /* location.associations?.map((association) => ({
                type: CategoryToAssociationType[association.category] as AssociationType,
                service: processServices([association.service])[0],
              })) || */ null,
              })
          ),
      });
    })
    .sort((a, b) => {
      const aTime = a.actualDeparture || a.estimatedDeparture || a.scheduledDeparture;
      const bTime = b.actualDeparture || b.estimatedDeparture || b.scheduledDeparture;
      return aTime && bTime ? aTime.getTime() - bTime.getTime() : 0;
    });
}

interface IProps {
  services: NonNullable<StaffServicesResponse['trainServices']>;
}

export default function TrainServices({ services }: IProps) {
  const processed = processServices(services);

  console.log(processed);

  return (
    <>
      {processed[0] && <TrainService ordinal="1st" service={processed[0]} showAdditionalDetails />}

      <Separator />

      {processed.length >= 3 ? (
        <SwapBetween interval={12_000}>
          {processed[1] && <TrainService ordinal="2nd" service={processed[1]} />}
          {processed[2] && <TrainService ordinal="3rd" service={processed[2]} />}
        </SwapBetween>
      ) : (
        <>{processed[1] && <TrainService ordinal="2nd" service={processed[1]} />}</>
      )}
    </>
  );
}
