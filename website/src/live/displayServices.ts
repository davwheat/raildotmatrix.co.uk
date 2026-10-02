import { AssociationCategory } from '../api-types/get-services-types'
import { CallPoint, Service, getLegacyTocName, type IAssociation, type IMyTrainService } from '../api/ProcessServices'
import type { Call, CISState, Endpoint, Location, Movement, PlatformOverride, Portion } from './types'

const date = (value: string | null) => (value ? new Date(value) : null)

/** A service ending its journey here has an arrival but no onward departure. */
const terminatesHere = (movement: Movement) => !movement.departure.planned

/** Boards count down to a departure; for a terminating service the arrival is the time passengers are waiting for. */
const boardTimes = (movement: Movement) => (terminatesHere(movement) ? movement.arrival : movement.departure)

const TERMINATES_HERE = { name: 'Terminates here', crs: '', via: null }
const locationName = (location: Location) => location.name || location.crs || location.tpl
const endpoint = (location: Endpoint) => ({ name: locationName(location), crs: location.crs || '', via: location.via?.text || null })
/** The feed sends the endpoint of a portion it knows nothing about with no location, which a board has no name to show for. */
const endpoints = (locations: Endpoint[]) => locations.filter(locationName).map(endpoint)

class LiveService extends Service {
  constructor(
    readonly movement: Movement,
    legacyNames: boolean,
    now: number,
    journey = advertisedJourney(movement),
  ) {
    super({
      id: movement.id,
      boardStationCrs: movement.station.crs || '',
      destinations: terminatesHere(movement) ? [TERMINATES_HERE] : endpoints(advertisedDestinations(movement, journey)),
      terminatesHere: terminatesHere(movement),
      origins: endpoints(movement.origins),
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
      passengerCallPoints: [{ calls: journey.calls, portions: movement.portions }, ...journey.linked].flatMap(leg =>
        callPoints(leg.calls, movement.cancelled, call => divisions(call, leg.portions, movement, legacyNames, now)),
      ),
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

/** A false destination or a link, and a call, can name one station by different TIPLOCs. */
const sameStation = (a: Location, b: Location) => a.tpl === b.tpl || (!!a.crs && a.crs === b.crs)

/** A call the service makes, as opposed to one that is cancelled or that passengers can't use. */
const running = (call: Call) => !call.cancelled && !call.operational

/**
 * The portion that takes a service's passengers on from the call where it ends. Darwin links two services to make
 * one journey of them, most often a train and the rail replacement bus that finishes its route, and a bus recorded
 * as a train's next working means the same. A link anywhere else on the route is a change that the service runs on
 * past, so it's left alone. `main` is false on the service the passengers came from.
 *
 * A portion that joins another train ends where it joins, and its passengers stay on board, so the train it joins
 * takes them on as well. There `main` is false on the portion that joins, and the join can be a call that
 * passengers can't use.
 */
function onwardLink(portions: Portion[], calls: Call[]): { link: Portion; from: number; calls: Call[] } | null {
  let ends = calls.length - 1
  while (ends >= 0 && calls[ends].cancelled) ends--
  let leaves = ends
  while (leaves >= 0 && !running(calls[leaves])) leaves--
  for (const link of portions) {
    if (!link.available || link.cancelled) continue
    const joins = link.category === 'JJ' && link.main !== true
    if (!joins && link.main === false) continue
    if (!joins && link.category !== 'LK' && !(link.category === 'NP' && link.mode === 'bus')) continue
    const from = joins ? ends : leaves
    if (from < 0 || !sameStation(link.at, calls[from])) continue
    const meets = link.calls.findIndex(call => sameStation(call, link.at))
    const onward = meets === -1 ? [] : link.calls.slice(meets + 1)
    // A linked service that runs nowhere from here takes nobody on.
    if (onward.some(running)) return { link, from, calls: onward }
  }
  return null
}

/** The part of a journey that one service runs. */
interface Leg {
  calls: Call[]
  /**
   * What the feed sends of that service's own associations. For a train that a portion joined, they include the
   * portions that divide from it afterwards.
   */
  portions: Portion[]
}

interface Journey {
  /** The movement's own calls that the board lists. */
  calls: Call[]
  /** The services linked on from the last of those, in order. */
  linked: Leg[]
  /** Where the last linked service goes, or null when nothing is linked. */
  linkedDestination: Location | null
}

/**
 * What the board advertises of a movement's journey. A service linked to another where it ends is shown as one
 * through service: the calls of each linked service follow its own, and the last one's destination replaces its
 * own. Links carry on through as many services as the feed sends, such as a train, a bus, and then a train. A
 * portion that joins another train is shown in the same way, as a through service to where that train goes.
 *
 * A false destination ends the calling pattern instead. It ends at the first call there, because a train on a
 * circular route calls there again on its way to the real destination. Darwin sets one to say what a board shows,
 * so no link is followed past it.
 */
function advertisedJourney(movement: Movement): Journey {
  const falseDestination = movement.false_destination
  if (falseDestination) {
    const first = movement.calling_points.findIndex(call => sameStation(call, falseDestination))
    const calls = first === -1 ? movement.calling_points : movement.calling_points.slice(0, first + 1)
    return { calls, linked: [], linkedDestination: null }
  }
  const journey: Journey = { calls: movement.calling_points, linked: [], linkedDestination: null }
  let onward = onwardLink(movement.portions, movement.calling_points)
  if (onward) journey.calls = movement.calling_points.slice(0, onward.from + 1)
  while (onward) {
    const { link, calls } = onward
    onward = onwardLink(link.links, calls)
    journey.linked.push({ calls: onward ? calls.slice(0, onward.from + 1) : calls, portions: link.links })
    journey.linkedDestination = link.destination || calls[calls.length - 1]
  }
  return journey
}

/**
 * A false destination is the station Darwin tells a board to show in place of the service's own, as on a circular
 * route, and a linked service's destination replaces it in the same way. Either has no via caption, because the
 * feed's caption describes the route to the service's own destination. The destinations of portions are kept while
 * a portion still divides off for them: the feed lists one for as long as the division stands, which includes a
 * portion that no longer runs anywhere. An endpoint whose portion the feed didn't send is taken at its word.
 */
function advertisedDestinations(movement: Movement, journey: Journey): Endpoint[] {
  const shown = movement.false_destination || journey.linkedDestination
  const dividesOff = (rid: string) => {
    const portions = movement.portions.filter(portion => portion.rid === rid && portion.category === 'VV')
    return !portions.length || portions.some(portion => portionCalls(portion, movement.cancelled))
  }
  const unassociated = (location: Location): Endpoint => ({ ...location, via: null, assoc_rid: null, assoc_cat: null })
  return [
    ...(shown ? [unassociated({ tpl: shown.tpl, crs: shown.crs, name: shown.name })] : []),
    ...movement.destinations.filter(destination => (destination.assoc_rid ? dividesOff(destination.assoc_rid) : !shown)),
    // The feed lists the destinations of the movement's own portions. Those of a train that it joins come with
    // that train.
    ...journey.linked.flatMap(leg =>
      leg.portions.flatMap(portion => {
        const reached = portion.category === 'VV' && leg.calls.some(call => call.tpl === portion.at.tpl)
        const calls = reached ? portionCalls(portion, movement.cancelled) : null
        return calls ? [unassociated(portion.destination || calls[calls.length - 1])] : []
      }),
    ),
  ]
}

const passengerCall = (call: Call) => !!call.crs && !call.operational

/** Darwin concatenates fixed two-character activity codes, so 'R' must not match within 'RM'. */
function hasActivity(activities: string | null, code: string): boolean {
  if (!activities) return false
  for (let index = 0; index < activities.length; index += 2) {
    if (activities.slice(index, index + 2).trim() === code) return true
  }
  return false
}

/**
 * The passenger calls of a calling pattern, each with the portions that divide from the train there and the
 * coaches that it leaves behind.
 *
 * A train can divide at a station where it sets nobody down, as a sleeper does. The division still has to be
 * listed against a call, so that call is kept, as it is by `processServices`.
 *
 * A call that the train no longer makes is left out, unless the train is cancelled here too: then the board lists
 * the journey that it would have made.
 *
 * The feed names the end of a train as it arrives at a call. Each reversal on the way there swaps the ends, so
 * that end is the other one as the train stands here.
 */
function callPoints(calls: Call[], cancelled: boolean, divisionsAt: (call: Call) => IAssociation[] = () => []): CallPoint[] {
  let turned = false
  return calls.flatMap(call => {
    if (call.cancelled && !cancelled) return []
    const associations = call.crs ? divisionsAt(call) : []
    if (turned) {
      for (const association of associations) {
        if (association.position === 'front') association.position = 'rear'
        else if (association.position === 'rear') association.position = 'front'
      }
    }
    if (hasActivity(call.activities, 'RM')) turned = !turned
    return passengerCall(call) || associations.length ? [makeCall(call, associations)] : []
  })
}

function makeCall(call: Call, associations: IAssociation[] = []): CallPoint {
  return new CallPoint({
    name: locationName(call),
    isCancelled: call.cancelled,
    scheduledDeparture: date(call.departure.planned),
    estimatedDeparture: date(call.departure.actual || call.departure.estimated),
    scheduledArrival: date(call.arrival.planned),
    estimatedArrival: date(call.arrival.actual || call.arrival.estimated),
    length: call.coach_count,
    associations,
  })
}

/**
 * The calls of a portion that divides off, from the division. They're null for a portion that passengers can't
 * travel in: one that doesn't run, that the feed knows nothing about, or that has nowhere left to call.
 */
function portionCalls(portion: Portion, cancelled: boolean): Call[] | null {
  if (!portion.available || portion.cancelled) return null
  const from = portion.calls.findIndex(call => sameStation(call, portion.at))
  const calls = (from === -1 ? portion.calls : portion.calls.slice(from)).filter(call => passengerCall(call) && (cancelled || !call.cancelled))
  return calls.some(call => !sameStation(call, portion.at)) ? calls : null
}

const trainEnd = (position: string | null) => (position === 'front' || position === 'middle' || position === 'rear' ? position : undefined)

/**
 * The portions that divide from a train at one of its calls, each with the end of the train that it is at as the
 * train arrives. The feed works that out from the way the train leaves. Where it doesn't, Darwin says only which
 * end of the train stock detaches from, which can't tell two portions apart.
 *
 * Coaches that the train leaves behind there, while it runs on as the same service, are a portion that goes no
 * further.
 */
function divisions(call: Call, portions: Portion[], movement: Movement, legacyNames: boolean, now: number): IAssociation[] {
  const divides = portions.flatMap((portion): IAssociation[] => {
    const calls = portion.at.tpl === call.tpl && portion.category === 'VV' ? portionCalls(portion, movement.cancelled) : null
    if (!calls) return []
    const service = portionService(portion, calls, movement, legacyNames, now)
    return [{ type: AssociationCategory.Divide, service, position: trainEnd(portion.position) }]
  })
  if (divides.length === 1 && !divides[0].position && call.detach_front !== null) divides[0].position = call.detach_front ? 'front' : 'rear'
  if (divides.length) return divides

  const detached = passengerCall(call) ? call.formation_change?.detached : null
  if (!detached) return []
  const left = new LiveService(
    { ...movement, id: `${movement.id}/detached/${call.id}`, coach_count: detached.coaches, calling_points: [], portions: [] },
    legacyNames,
    now,
  )
  return [{ type: AssociationCategory.Divide, service: left, position: trainEnd(detached.position) }]
}

function portionService(portion: Portion, calls: Call[], movement: Movement, legacyNames: boolean, now: number): IMyTrainService {
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
      calling_points: calls,
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
