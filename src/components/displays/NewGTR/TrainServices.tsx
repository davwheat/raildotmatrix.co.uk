import React from 'react';

import TrainService from './TrainService';

import dayjs from 'dayjs';
import dayjsUtc from 'dayjs/plugin/utc';
import dayjsTz from 'dayjs/plugin/timezone';

import type { StaffServicesResponse } from '../../../api/GetNextTrainsAtStationStaff';
import SwapBetween from './SwapBetween';
import Separator from './Separator';

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTz);

dayjs.tz.setDefault('Europe/London');

type AssociationType = 'join' | 'divide' | 'linkedPrevious' | 'linkedNext';
const CategoryToAssociationType: AssociationType[] = ['join', 'divide', 'linkedPrevious', 'linkedNext'];

export interface IMyTrainService {
  destinations: { name: string; via: null | string }[];
  origins: { name: string; via: null | string }[];
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
  passengerCallPoints: {
    name: string;
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
  }[];

  isDelayed(): boolean;
  displayedDepartureTime(): string;
}

function processServices(services: NonNullable<StaffServicesResponse['trainServices']>): IMyTrainService[] {
  const applicableServices = services.filter((s) => s.isPassengerService && !s.isOperationalCall);

  return applicableServices
    .map((service): IMyTrainService => {
      return {
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
          .filter((l) => l.crs && !l.isCancelled && !l.isOperational && !l.isPass)
          .map((location) => ({
            name: location.locationName,
            scheduledDeparture: location.stdSpecified ? dayjs(location.std).toDate() : null,
            estimatedDeparture: location.etdSpecified ? dayjs(location.etd).toDate() : null,
            scheduledArrival: location.staSpecified ? dayjs(location.sta).toDate() : null,
            estimatedArrival: location.etaSpecified ? dayjs(location.eta).toDate() : null,
            associations:
              location.associations?.map((association) => ({
                type: CategoryToAssociationType[association.category] as AssociationType,
                service: processServices([association.service])[0],
              })) || null,
          })),

        isDelayed(): boolean {
          return dayjs(this.estimatedDeparture).diff(dayjs(this.scheduledDeparture), 'minute') >= 1;
        },

        displayedDepartureTime(): string {
          if (this.hasDeparted || this.hasArrived) return 'Arrived';
          if (!this.isDelayed()) return 'On time';
          if (this.estimatedDeparture) return dayjs(this.estimatedDeparture).format('HH:mm');
          if (this.scheduledDeparture) return dayjs(this.scheduledDeparture).format('HH:mm');
          return 'Delayed';
        },
      } as IMyTrainService;
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
