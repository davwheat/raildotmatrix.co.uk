import { AssociationCategory } from '../api-types/get-services-types'
import { CallPoint, Service, getLegacyTocName, type IMyTrainService } from '../api/ProcessServices'
import type { Call, CISState, Endpoint, Location, Movement, PlatformOverride, Portion } from './types'

const date = (value: string | null) => (value ? new Date(value) : null)

/** A service ending its journey here has an arrival but no onward departure. */
const terminatesHere = (movement: Movement) => !movement.departure.planned

/** Boards count down to a departure; for a terminating service the arrival is the time passengers are waiting for. */
const boardTimes = (movement: Movement) => (terminatesHere(movement) ? movement.arrival : movement.departure)

const TERMINATES_HERE = { name: 'Terminates here', crs: '', via: null }
const locationName = (location: Location) => location.name || location.crs || location.tpl
const endpoint = (location: Endpoint) => ({ name: locationName(location), crs: location.crs || '', via: location.via?.text || null })

class LiveService extends Service {
  constructor(
    readonly movement: Movement,
    legacyNames: boolean,
    now: number,
  ) {
    super({
      id: movement.id,
      boardStationCrs: movement.station.crs || '',
      destinations: terminatesHere(movement) ? [TERMINATES_HERE] : advertisedDestinations(movement).map(endpoint),
      terminatesHere: terminatesHere(movement),
      origins: movement.origins.map(endpoint),
      cancelled: movement.cancelled,
      cancelReason: null,
      delayReason: null,
      scheduledDeparture: date(boardTimes(movement).planned),
      estimatedDeparture: boardTimes(movement).unknown_delay ? null : date(boardTimes(movement).estimated || boardTimes(movement).planned),
      actualDeparture: date(movement.departure.actual),
      hasDeparted: false, // The server owns removal, including matched TD departures.
      scheduledArrival: date(movement.arrival.planned),
      estimatedArrival: date(movement.arrival.estimated),
      actualArrival: date(movement.arrival.actual),
      hasArrived: !!movement.arrival.actual && Date.parse(movement.arrival.actual) <= now,
      length: movement.coach_count,
      toc:
        (legacyNames && movement.operator_code && getLegacyTocName(movement.operator_code)) ||
        movement.operator_name ||
        movement.operator_code ||
        '',
      passengerCallPoints: passengerCalls(advertisedCalls(movement)).map(call => makeCall(call, movement, legacyNames, now)),
    })
  }

  get cancelReason() {
    return this.movement.cancel_reason.text
  }
  get delayReason() {
    return this.movement.delay_reason.text
  }
  isDelayed() {
    return boardTimes(this.movement).unknown_delay || super.isDelayed()
  }
}

/** A false destination and a call can name one station by different TIPLOCs. */
const sameStation = (a: Location, b: Location) => a.tpl === b.tpl || (!!a.crs && a.crs === b.crs)

/**
 * A false destination is the station Darwin tells a board to show in place of the service's own, as on a circular
 * route. The feed's via caption describes the route to the real destination, so the false one has none. The
 * destinations of portions are kept.
 */
function advertisedDestinations(movement: Movement): Endpoint[] {
  if (!movement.false_destination) return movement.destinations
  return [
    { ...movement.false_destination, via: null, assoc_rid: null, assoc_cat: null },
    ...movement.destinations.filter(destination => destination.assoc_rid),
  ]
}

/**
 * The calling pattern ends at a false destination. It ends at the first call there, because a train on a circular
 * route calls there again on its way to the real destination.
 */
function advertisedCalls(movement: Movement): Call[] {
  const falseDestination = movement.false_destination
  if (!falseDestination) return movement.calling_points
  const first = movement.calling_points.findIndex(call => sameStation(call, falseDestination))
  return first === -1 ? movement.calling_points : movement.calling_points.slice(0, first + 1)
}

function passengerCalls(calls: Call[]): Call[] {
  return calls.filter(call => call.crs && !call.operational)
}

function makeCall(call: Call, movement: Movement, legacyNames: boolean, now: number): CallPoint {
  const portions = movement.portions.filter(
    portion => portion.at.tpl === call.tpl && portion.category === 'VV' && portion.available && !portion.cancelled,
  )
  return new CallPoint({
    name: locationName(call),
    isCancelled: call.cancelled,
    scheduledDeparture: date(call.departure.planned),
    estimatedDeparture: date(call.departure.actual || call.departure.estimated),
    scheduledArrival: date(call.arrival.planned),
    estimatedArrival: date(call.arrival.actual || call.arrival.estimated),
    length: call.coach_count,
    associations: portions
      .filter(portion => passengerCalls(portion.calls).length > 0)
      .map(portion => ({
        type: AssociationCategory.Divide,
        service: portionService(portion, movement, legacyNames, now),
      })),
  })
}

function portionService(portion: Portion, movement: Movement, legacyNames: boolean, now: number): IMyTrainService {
  const destinations = movement.destinations.filter(destination => destination.assoc_rid === portion.rid)
  return new LiveService(
    {
      ...movement,
      id: `${movement.id}/portion/${portion.rid}`,
      rid: portion.rid,
      coach_count: portion.coach_count,
      destinations: destinations.length
        ? destinations
        : portion.destination
          ? [{ ...portion.destination, via: null, assoc_rid: null, assoc_cat: null }]
          : [],
      calling_points: portion.calls,
      // The false destination belongs to the main train, not to the portion that leaves it.
      false_destination: null,
      portions: [],
    },
    legacyNames,
    now,
  )
}

/**
 * A service that ends here only because it joins another one is that train's
 * other portion rather than a working of its own: the service it becomes has
 * its own entry, with both portions' origins on it, so showing this as well
 * puts one train on the board twice — once as a train that terminates and
 * strands its passengers, which is the opposite of what it does.
 */
function joinsHere(movement: Movement): boolean {
  return (
    terminatesHere(movement) &&
    movement.portions.some(
      portion => portion.category === 'JJ' && portion.available && !portion.cancelled && portion.at.tpl === movement.station.tpl,
    )
  )
}

/** A movement a departure board can list at all, before any platform filtering or override is considered. */
function isPassengerCall(movement: Movement, hideTerminating = false): boolean {
  if (movement.suppressed || !movement.passenger || movement.operational) return false
  if (hideTerminating && terminatesHere(movement)) return false
  // A terminating service is shown like any other, timed by its arrival. A train that only passes through is not a
  // call at all: it is announced, if at all, by a platform override.
  if (!movement.departure.planned && (!movement.arrival.planned || movement.kind === 'passing')) return false
  return !joinsHere(movement)
}

const selectedPlatforms = (platforms: string[] | null) => (platforms?.length ? new Set(platforms.map(platform => platform.toUpperCase())) : null)

/**
 * Trains that have moved between a platform this board watches and one it does not. No board shows a platform
 * number against a service, so an alteration reaches a passenger as a train appearing or vanishing: a move within
 * the watched platforms changes nothing they can see, and a board watching the whole station never loses a train
 * to one. A platform being published for the first time, or withdrawn, is an announcement rather than a move.
 */
export function platformAlterations(previous: CISState | null, next: CISState, platforms: string[] | null, hideTerminating = false): string[] {
  const selected = selectedPlatforms(platforms)
  if (!previous || !selected) return []
  const watched = (platform: string) => selected.has(platform.toUpperCase())

  return [...next.movements.values()].flatMap(movement => {
    const was = previous.movements.get(movement.id)?.platform.number
    const now = movement.platform.number
    if (!was || !now || was === now || !isPassengerCall(movement, hideTerminating)) return []
    return watched(was) === watched(now) ? [] : [movement.id]
  })
}

export interface DisplayView {
  services: IMyTrainService[]
  overrides: PlatformOverride[]
}

export function displayServices(
  state: CISState,
  platforms: string[] | null,
  legacyNames: boolean,
  showUnconfirmed: boolean,
  now = Date.now(),
  hideTerminating = false,
): DisplayView {
  const selected = selectedPlatforms(platforms)
  const overrides = [...state.overrides.values()].filter(
    override =>
      (!selected || selected.has(override.platform.toUpperCase())) &&
      Date.parse(override.activates_at) <= now &&
      Date.parse(override.expires_at) > now,
  )
  const overridden = new Set(overrides.map(override => override.platform.toUpperCase()))

  // Keep the server's ordering: TrainOrder takes priority within each platform.
  const services = state.ordering.flatMap(id => {
    const movement = state.movements.get(id)
    if (!movement || !isPassengerCall(movement, hideTerminating)) return []
    const platform = movement.platform.number?.toUpperCase()
    if (platform && overridden.has(platform)) return []
    // Darwin confirmation is separate from permission to display a platform.
    // A published platform can be shown before confirmation arrives.
    const unconfirmed = !platform || movement.platform.suppressed
    if (unconfirmed && !showUnconfirmed) return []
    if (selected && (!platform || !selected.has(platform)) && !(unconfirmed && showUnconfirmed)) return []
    return [new LiveService(movement, legacyNames, now)]
  })
  return { services, overrides }
}

/** The next change that needs no server message: a warning starting/ending, or a reported arrival arriving. */
export function nextDisplayBoundary(state: CISState, platforms: string[] | null, now: number, hideTerminating = false): number | null {
  const selected = selectedPlatforms(platforms)
  let next = Infinity
  const consider = (time: string | null) => {
    if (!time) return
    const at = Date.parse(time)
    if (at > now && at < next) next = at
  }
  for (const override of state.overrides.values()) {
    if (selected && !selected.has(override.platform.toUpperCase())) continue
    consider(override.activates_at)
    consider(override.expires_at)
  }
  for (const movement of state.movements.values()) {
    if (isPassengerCall(movement, hideTerminating)) consider(movement.arrival.actual)
  }
  return Number.isFinite(next) ? next : null
}
