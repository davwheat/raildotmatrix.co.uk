export interface StaffServicesResponse {
  trainServices: TrainService[] | null;
  busServices: null;
  ferryServices: null;
  isTruncated: boolean;
  generatedAt: string;
  locationName: string;
  crs: string;
  filterLocationName: null;
  filtercrs: null;
  filterType: number;
  stationManager: string;
  stationManagerCode: string;
  nrccMessages: NrccMessage[];
  platformsAreHidden: boolean;
  servicesAreUnavailable: boolean;
}

export interface AssociatedServiceDetail {
  cancelReason: CancelLatenessReason | null;
  delayReason: CancelLatenessReason | null;
  isCharter: boolean;
  isPassengerService: boolean;
  category: string;
  sta: string;
  staSpecified: boolean;
  ata: string;
  ataSpecified: boolean;
  eta: string;
  etaSpecified: boolean;
  std: string;
  stdSpecified: boolean;
  atd: string;
  atdSpecified: boolean;
  etd: string;
  etdSpecified: boolean;
  rid: string;
  uid: string;
  locations: AssociatedServiceLocation[];
}

interface TrainService {
  previousLocations: any;
  subsequentLocations: TimingLocation[];
  cancelReason: CancelLatenessReason | null;
  delayReason: CancelLatenessReason | null;
  category: string;
  activities: string;
  length: number | null;
  isReverseFormation: boolean;
  detachFront: boolean;
  origin: EndPointLocation[];
  destination: EndPointLocation[];
  currentOrigins: EndPointLocation[] | null;
  currentDestinations: EndPointLocation[] | null;
  formation: any;
  rid: string;
  uid: string;
  trainid: string;
  rsid: string | null;
  sdd: string;
  operator: string;
  operatorCode: string;
  isPassengerService: boolean;
  isCharter: boolean;
  isCancelled: boolean;
  isCircularRoute: boolean;
  filterLocationCancelled: boolean;
  filterLocationOperational: boolean;
  isOperationalCall: boolean;
  sta: string;
  staSpecified: boolean;
  ata: string;
  ataSpecified: boolean;
  eta: string;
  etaSpecified: boolean;
  arrivalType: number;
  arrivalTypeSpecified: boolean;
  arrivalSource: string | null;
  arrivalSourceInstance: any;
  std: string;
  stdSpecified: boolean;
  atd: string;
  atdSpecified: boolean;
  etd: string;
  etdSpecified: boolean;
  departureType: number;
  departureTypeSpecified: boolean;
  departureSource: string | null;
  departureSourceInstance: any;
  platform: string | null;
  platformIsHidden: boolean;
  serviceIsSupressed: boolean;
  adhocAlerts: any;
}

interface TimingLocation {
  locationName: string;
  tiploc: string;
  crs?: string;
  isOperational: boolean;
  isPass: boolean;
  isCancelled: boolean;
  platform?: string;
  platformIsHidden: boolean;
  serviceIsSuppressed: boolean;
  sta: string;
  staSpecified: boolean;
  ata: string;
  ataSpecified: boolean;
  eta: string;
  etaSpecified: boolean;
  arrivalType: number;
  arrivalTypeSpecified: boolean;
  arrivalSource: string | null;
  arrivalSourceInstance: any;
  std: string;
  stdSpecified: boolean;
  atd: string;
  atdSpecified: boolean;
  etd: string;
  etdSpecified: boolean;
  departureType: number;
  departureTypeSpecified: boolean;
  departureSource: string | null;
  departureSourceInstance: any;
  lateness: any;
  associations: Association[] | null;
  adhocAlerts: any;
}

export enum AssociationCategory {
  Join = 0,
  Divide = 1,
  LinkedFrom = 2,
  LinkedTo = 3,
}

interface AssociatedServiceLocation extends TimingLocation {
  length: number | null;
  falseDest: null | EndPointLocation[];
}

export interface Association<Category extends AssociationCategory = AssociationCategory> {
  /**
   * 0: Join
   * 1: Divide
   * 2: Linked-From (last service)
   * 3: Linked-To (next service)
   */
  category: AssociationCategory;
  rid: string;
  uid: string;
  trainid: string;
  rsid?: string;
  sdd: string;
  origin: string;
  originCRS: string;
  originTiploc: string;
  destination: string;
  destCRS: string;
  destTiploc: string;
  isCancelled: boolean;

  /**
   * Added by this proxy
   */
  service: Category extends AssociationCategory.Divide ? AssociatedServiceDetail : undefined;
}

interface CancelLatenessReason {
  tiploc: string;
  near: boolean;
  value: number;
  stationName?: string | null;
}

interface EndPointLocation {
  isOperationalEndPoint: boolean;
  locationName: string;
  crs: string;
  tiploc: string;
  via: any;
  futureChangeTo: number;
  futureChangeToSpecified: boolean;
}

interface NrccMessage {
  category: number;
  severity: number;
  xhtmlMessage: string;
}

import TiplocToStation from './tiploc_to_station.json';

async function getServiceByRid(rid: string): Promise<TrainService> {
  const response = await fetch(`https://national-rail-api.davwheat.dev/service/${rid}`);
  const json: TrainService = await response.json();

  return json;
}

export const onRequest: PagesFunction<unknown> = async (context) => {
  const { request, env } = context;
  const { searchParams, origin } = new URL(request.url);

  try {
    const station = searchParams.get('station');
    const maxServices = searchParams.get('maxServices') || '10';
    const timeOffset = searchParams.get('timeOffset') || '0';
    const timeWindow = searchParams.get('timeWindow') || '120';
    const expand = 'true';

    if (!station) {
      return Response.json({ error: true, message: 'Missing station' });
    }

    const params = new URLSearchParams({
      expand,
      timeOffset,
      timeWindow,
    });

    const response = await fetch(`https://national-rail-api.davwheat.dev/staffdepartures/${station}/${maxServices}?${params}`);

    if (!response.ok) {
      return Response.json({ error: true, message: 'Upstream fetch error' });
    }

    const json: StaffServicesResponse = await response.json();

    for (const s in json.trainServices) {
      const service: TrainService = json.trainServices[s];

      if (service.cancelReason?.near) {
        service.cancelReason.stationName = TiplocToStation[service.cancelReason.tiploc] || null;
      }

      if (service.delayReason?.near) {
        service.delayReason.stationName = TiplocToStation[service.delayReason.tiploc] || null;
      }

      for (const l in service.subsequentLocations) {
        const location: TimingLocation = service.subsequentLocations[l];

        for (const a in location.associations) {
          const association: Association = location.associations[a];

          (association as any).service = await getServiceByRid(association.rid);
        }
      }
    }

    return Response.json(json);
  } catch (ex) {
    if (ex && ex.message) {
      return Response.json({ error: true, message: ex.message });
    } else {
      return Response.json({ error: true, message: 'Unknown error' });
    }
  }
};
