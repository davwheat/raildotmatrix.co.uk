import type { Call, Endpoint, Location, Movement, Platform, PlatformOverride, Portion, Snapshot, Times, Update } from '../../src/live/types'

/**
 * Boards render relative to the browser clock, which the capture freezes to this instant. Fixture times are offsets
 * from it, so every baseline shows the same minutes-to-departure as the day it was recorded.
 */
export const FROZEN_CLOCK = Date.parse('2026-09-13T18:40:00Z')

const STATION: Location = { tpl: 'ECROYDN', crs: 'ECR', name: 'East Croydon' }

const at = (offsetSeconds: number) => new Date(FROZEN_CLOCK + offsetSeconds * 1000).toISOString()
const noTimes = (): Times => ({ planned: null, estimated: null, actual: null, unknown_delay: false })
const times = (plannedOffset: number, estimatedOffset = plannedOffset): Times => ({
  planned: at(plannedOffset),
  estimated: at(estimatedOffset),
  actual: null,
  unknown_delay: false,
})
const place = (tpl: string, crs: string, name: string): Location => ({ tpl, crs, name })
const endpoint = (location: Location, via: string | null = null): Endpoint => ({
  ...location,
  via: via ? { text: via, locs: [] } : null,
  assoc_rid: null,
  assoc_cat: null,
})
const platform = (number: string): Platform => ({ number, confirmed: true, suppressed: false, source: 'CIS' })

const VICTORIA = place('VICTRIC', 'VIC', 'London Victoria')
const LONDON_BRIDGE = place('LNDNBDC', 'LBG', 'London Bridge')
const CLAPHAM = place('CLPHMJC', 'CLJ', 'Clapham Junction')
const NORWOOD = place('NRWD', 'NWD', 'Norwood Junction')
const GATWICK = place('GTWK', 'GTW', 'Gatwick Airport')
const BRIGHTON = place('BRGHTN', 'BTN', 'Brighton')
const BEDFORD = place('BEDFORD', 'BDM', 'Bedford')
const ST_PANCRAS = place('STPXBOX', 'STP', 'St Pancras International')
const HORSHAM = place('HORSHAM', 'HRH', 'Horsham')
const LITTLEHAMPTON = place('LTLHAVN', 'LIT', 'Littlehampton')

function call(location: Location, arrivalOffset: number, platformNumber: string, coachCount: number | null = 8): Call {
  return {
    id: `${location.tpl}@${arrivalOffset}`,
    ...location,
    arrival: times(arrivalOffset),
    departure: times(arrivalOffset + 60),
    platform: platform(platformNumber),
    cancelled: false,
    activities: 'T',
    operational: false,
    detach_front: false,
    false_destination: null,
    coach_count: coachCount,
  }
}

interface MovementOptions {
  id: string
  platform: string
  departureOffset: number
  estimatedOffset?: number
  operatorCode: string
  operatorName: string
  destinations: Endpoint[]
  calls: Call[]
  coachCount?: number | null
  cancelled?: boolean
  cancelReason?: string | null
  delayReason?: string | null
  unknownDelay?: boolean
  portions?: Portion[]
}

function movement(options: MovementOptions): Movement {
  const departure = times(options.departureOffset, options.estimatedOffset ?? options.departureOffset)

  return {
    id: options.id,
    rid: `2026091300${options.id}`,
    location_id: options.id,
    station: STATION,
    kind: 'stop',
    mode: 'train',
    uid: `C${options.id}`,
    headcode: '1A01',
    operator_code: options.operatorCode,
    operator_name: options.operatorName,
    passenger: true,
    operational: false,
    arrival: times(options.departureOffset - 60),
    departure: { ...departure, unknown_delay: !!options.unknownDelay },
    passing: noTimes(),
    platform: platform(options.platform),
    suppressed: false,
    cancelled: !!options.cancelled,
    cancel_reason: { code: null, text: options.cancelReason ?? null },
    delay_reason: { code: null, text: options.delayReason ?? null },
    coach_count: options.coachCount === undefined ? 8 : options.coachCount,
    loading_percent: null,
    loading_category: null,
    coaches: null,
    formation: null,
    coach_loading: null,
    reverse_formation: null,
    detach_front: null,
    activities: 'TB',
    false_destination: null,
    origins: [endpoint(BRIGHTON)],
    destinations: options.destinations,
    calling_points: options.calls,
    portions: options.portions ?? [],
    arrived_at: null,
    passed_at: null,
  }
}

function override(kind: PlatformOverride['kind'], platformNumber: string): PlatformOverride {
  return {
    id: `${kind}-${platformNumber}`,
    kind,
    station: STATION,
    platform: platformNumber,
    movement_id: null,
    activates_at: at(-30),
    expires_at: at(600),
    reason: kind === 'stand_clear' ? 'Passing train' : 'Not for public use',
    source: 'TD',
  }
}

function snapshot(movements: Movement[], overrides: PlatformOverride[] = []): Snapshot {
  return {
    version: 2,
    type: 'snapshot',
    station: STATION,
    window: { from: at(-3600), to: at(7200) },
    epoch: 'visual-fixture',
    revision: 1,
    movements,
    ordering: movements.map(item => item.id),
    overrides,
    nrcc_messages: [],
  }
}

const victoriaService = () =>
  movement({
    id: 'victoria',
    platform: '2',
    departureOffset: 180,
    operatorCode: 'SN',
    operatorName: 'Southern',
    destinations: [endpoint(VICTORIA)],
    calls: [call(CLAPHAM, 480, '12'), call(VICTORIA, 840, '12')],
  })

const bedfordService = () =>
  movement({
    id: 'bedford',
    platform: '4',
    departureOffset: 420,
    operatorCode: 'TL',
    operatorName: 'Thameslink',
    destinations: [endpoint(BEDFORD)],
    calls: [call(LONDON_BRIDGE, 900, '5'), call(ST_PANCRAS, 1440, 'A'), call(BEDFORD, 3600, '2')],
    coachCount: 12,
  })

const gatwickService = () =>
  movement({
    id: 'gatwick',
    platform: '5',
    departureOffset: 660,
    operatorCode: 'GX',
    operatorName: 'Gatwick Express',
    destinations: [endpoint(GATWICK)],
    calls: [call(GATWICK, 1020, '5')],
    coachCount: 8,
  })

const londonBridgeService = () =>
  movement({
    id: 'london-bridge',
    platform: '6',
    departureOffset: 900,
    operatorCode: 'SN',
    operatorName: 'Southern',
    destinations: [endpoint(LONDON_BRIDGE, 'via Sydenham')],
    calls: [call(NORWOOD, 1140, '3'), call(LONDON_BRIDGE, 1500, '8')],
  })

const brightonService = () =>
  movement({
    id: 'brighton',
    platform: '1',
    departureOffset: 1200,
    operatorCode: 'SN',
    operatorName: 'Southern',
    destinations: [endpoint(BRIGHTON)],
    calls: [call(GATWICK, 1560, '2'), call(BRIGHTON, 2400, '4')],
  })

/** A VV portion is how the feed expresses a divide: the portion's own calls continue past the dividing point. */
function dividingService(): Movement {
  const divideCall = call(HORSHAM, 1500, '2', 4)
  const rearPortion: Portion = {
    headcode: '1B02',
    mode: 'train',
    operator_code: 'SN',
    operator_name: 'Southern',
    origin: BRIGHTON,
    destination: LITTLEHAMPTON,
    rid: '202609130099',
    category: 'VV',
    at: HORSHAM,
    cancelled: false,
    available: true,
    coach_count: 4,
    position: 'rear',
    calls: [divideCall, call(LITTLEHAMPTON, 2400, '1', 4)],
  }

  return movement({
    id: 'dividing',
    platform: '3',
    departureOffset: 300,
    operatorCode: 'SN',
    operatorName: 'Southern',
    destinations: [endpoint(HORSHAM), { ...endpoint(LITTLEHAMPTON), assoc_rid: rearPortion.rid, assoc_cat: 'VV' }],
    calls: [call(GATWICK, 960, '2', 8), divideCall],
    coachCount: 8,
    portions: [rearPortion],
  })
}

function update(initial: Snapshot, upserts: Movement[]): Update {
  return {
    version: 2,
    type: 'update',
    epoch: initial.epoch,
    previous_revision: initial.revision,
    revision: initial.revision + 1,
    window: initial.window,
    upserts,
    removals: [],
    ordering: initial.ordering,
    override_upserts: [],
    override_removals: [],
    nrcc_messages: [],
  }
}

/**
 * Moving the next train to a platform this board does not watch. Only a change can produce an alteration, so the
 * board has to be given one state and then another, and a second train stays put so there is something for the
 * board to draw once it has finished announcing.
 */
function platformAlteration(): Fixture {
  const moving = victoriaService()
  const staying = { ...bedfordService(), platform: platform('2') }
  const initial = snapshot([moving, staying])

  return {
    description: 'the next train moving off the platform this board watches',
    snapshot: initial,
    updates: [update(initial, [{ ...moving, platform: platform('7') }])],
    platforms: ['2'],
  }
}

export interface Fixture {
  description: string
  /** `null` holds the socket open without sending, which is the board's pre-data state. */
  snapshot: Snapshot | null
  /** Sent one at a time after the snapshot, for a state a board can only reach by being told something changed. */
  updates?: Update[]
  /** The platforms the board watches, as a platform-mounted board is configured with. Empty watches the station. */
  platforms?: string[]
}

export const FIXTURES: Record<string, Fixture> = {
  connecting: {
    description: 'socket open with no snapshot yet, which must look exactly like an empty board',
    snapshot: null,
  },
  'no-departures': {
    description: 'a healthy feed with nothing to show',
    snapshot: snapshot([]),
  },
  terminating: {
    description: 'a service ending its journey here, shown in place of a destination as Terminates here',
    snapshot: snapshot([
      {
        ...victoriaService(),
        id: 'terminating',
        kind: 'arrival',
        departure: noTimes(),
        arrival: times(240),
        destinations: [endpoint(STATION)],
        calling_points: [],
      },
      bedfordService(),
    ]),
  },
  'single-departure': {
    description: 'one straightforward service',
    snapshot: snapshot([victoriaService()]),
  },
  'busy-board': {
    description: 'five services competing for the board',
    snapshot: snapshot([victoriaService(), bedfordService(), gatwickService(), londonBridgeService(), brightonService()]),
  },
  delayed: {
    description: 'a late running service with a reason',
    snapshot: snapshot([
      movement({
        id: 'delayed',
        platform: '2',
        departureOffset: 180,
        estimatedOffset: 900,
        operatorCode: 'SN',
        operatorName: 'Southern',
        destinations: [endpoint(VICTORIA)],
        calls: [call(CLAPHAM, 1200, '12'), call(VICTORIA, 1560, '12')],
        delayReason: 'This is due to a speed restriction over defective track',
      }),
      bedfordService(),
    ]),
  },
  'unknown-delay': {
    description: 'a service with no estimate at all',
    snapshot: snapshot([
      movement({
        id: 'unknown',
        platform: '2',
        departureOffset: 180,
        operatorCode: 'SN',
        operatorName: 'Southern',
        destinations: [endpoint(VICTORIA)],
        calls: [call(CLAPHAM, 480, '12'), call(VICTORIA, 840, '12')],
        unknownDelay: true,
      }),
      bedfordService(),
    ]),
  },
  cancelled: {
    description: 'a cancelled service with a reason',
    snapshot: snapshot([
      movement({
        id: 'cancelled',
        platform: '2',
        departureOffset: 180,
        operatorCode: 'SN',
        operatorName: 'Southern',
        destinations: [endpoint(VICTORIA)],
        calls: [call(CLAPHAM, 480, '12'), call(VICTORIA, 840, '12')],
        cancelled: true,
        cancelReason: 'This is due to a fault on this train',
      }),
      bedfordService(),
    ]),
  },
  'dividing-service': {
    description: 'a service that splits, with front and rear portions',
    snapshot: snapshot([dividingService(), bedfordService()]),
  },
  'passing-train': {
    description: 'a stand clear warning replacing platform 2',
    snapshot: snapshot([victoriaService(), bedfordService()], [override('stand_clear', '2')]),
  },
  'non-public-train': {
    description: 'a not for public use warning replacing platform 2',
    snapshot: snapshot([victoriaService(), bedfordService()], [override('not_for_public_use', '2')]),
  },
  'platform-alteration': platformAlteration(),
}
