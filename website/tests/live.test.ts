import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { attests, reduceCIS, connectCIS } from '../src/live/cis'
import { streamUrl } from '../src/live/connection'
import { digestState, stateDigest } from '../src/live/digest'
import { fromBinary } from '@bufbuild/protobuf'
import { ClientMessageSchema } from '../src/live/gen/darwin/live/v2/live_pb'
import { decodeServerMessage } from '../src/live/wire'
import { encodeServerMessage } from './encode'
import fixture from './snapshot.json'
import serviceSnapshot from './fixtures/snapshot.json'
import serviceSnapshotFrame from './fixtures/snapshot.pb'
import serviceStoppingSnapshot from './fixtures/stopping_snapshot.json'
import serviceStoppingSnapshotFrame from './fixtures/stopping_snapshot.pb'
import serviceUpdate from './fixtures/override_removal.json'
import serviceUpdateFrame from './fixtures/override_removal.pb'
import nrccSnapshot from './fixtures/nrcc_snapshot.json'
import nrccSnapshotFrame from './fixtures/nrcc_snapshot.pb'
import nrccUpdate from './fixtures/nrcc_update.json'
import nrccUpdateFrame from './fixtures/nrcc_update.pb'
import nrccClear from './fixtures/nrcc_clear.json'
import nrccClearFrame from './fixtures/nrcc_clear.pb'
import type { CISState, Heartbeat, ServerMessage, Snapshot, Update } from '../src/live/types'

const snapshot = () => ({ ...structuredClone(fixture), nrcc_messages: [] }) as Snapshot
const update = (values: Partial<Update> = {}): Update => ({
  version: 2,
  type: 'update',
  epoch: fixture.epoch,
  previous_revision: 1,
  revision: 2,
  window: fixture.window,
  upserts: [],
  removals: [],
  ordering: fixture.ordering,
  override_upserts: [],
  override_removals: [],
  nrcc_messages: [],
  ...values,
})

test('snapshot and complete upserts converge without losing server ordering or circular visits', () => {
  const initial = snapshot()
  const second = { ...initial.movements[0], id: 'R1/second', location_id: 'second' }
  const first = { ...initial.movements[0], operator_name: null }
  const result = reduceCIS(reduceCIS(null, initial), update({ upserts: [first, second], ordering: [second.id, first.id] }))!
  assert.equal(result.movements.size, 2)
  assert.equal(result.movements.get(first.id)?.operator_name, null)
  assert.deepEqual(result.ordering, [second.id, first.id])
  assert.equal(reduceCIS(result, update()), null)
  assert.equal(reduceCIS(result, update({ epoch: 'rebuilt', previous_revision: 2 })), null)
  const authoritative = reduceCIS(result, { ...initial, epoch: 'rebuilt', revision: 1 })!
  assert.equal(authoritative.movements.size, 1)
  assert.equal(authoritative.epoch, 'rebuilt')
})

test('override removals and departure removals survive authoritative resync', () => {
  const initial = snapshot()
  const override = {
    id: 'warning',
    kind: 'stand_clear' as const,
    station: initial.station,
    platform: '2',
    movement_id: null,
    activates_at: fixture.window.from,
    expires_at: fixture.window.to,
    reason: 'Passing train',
    source: 'TD',
  }
  const withWarning = reduceCIS(reduceCIS(null, initial), update({ override_upserts: [override] }))!
  assert.equal(withWarning.overrides.size, 1)
  const cleared = reduceCIS(
    withWarning,
    update({
      previous_revision: 2,
      revision: 3,
      removals: initial.ordering,
      ordering: [],
      override_removals: [{ id: override.id, reason: 'cleared' }],
    }),
  )!
  assert.equal(cleared.movements.size, 0)
  assert.equal(cleared.overrides.size, 0)
  assert.deepEqual(reduceCIS(cleared, { ...initial, revision: 3, movements: [], ordering: [] }), cleared)
})

test('WebSocket URLs default cleanly to the local service and support a remote prefix', () => {
  assert.equal(streamUrl('ws://localhost:8080', 'cis', 'TST').href, 'ws://localhost:8080/v1/cis/live?crs=TST&heartbeat=30')
  assert.equal(
    streamUrl('https://example.test/darwin/', 'announcements', 'TST', 0).href,
    'wss://example.test/darwin/v1/announcements/live?crs=TST',
  )
  assert.throws(() => streamUrl('file:///tmp', 'cis', 'TST'))
})

class FakeSocket {
  static OPEN = 1
  static sockets: FakeSocket[] = []
  readyState = 1
  binaryType = 'blob'
  sent: Uint8Array[] = []
  onmessage?: (event: { data: unknown }) => void
  onclose?: () => void
  onerror?: () => void
  constructor(readonly url: URL) {
    FakeSocket.sockets.push(this)
  }
  send(value: Uint8Array) {
    this.sent.push(value)
  }
  receive(value: ServerMessage) {
    this.onmessage?.({ data: encodeServerMessage(value) })
  }
  close() {
    this.readyState = 3
    this.onclose?.()
  }
}

function withFakeSockets(context: TestContext) {
  context.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  const originalSocket = globalThis.WebSocket
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket
  context.after(() => {
    globalThis.WebSocket = originalSocket
  })
  FakeSocket.sockets = []
}

const beat = (state: CISState, values: Partial<Heartbeat> = {}): Heartbeat => ({
  version: 2,
  type: 'heartbeat',
  epoch: state.epoch,
  revision: state.revision,
  digest: digestState(state),
  sent_at: fixture.window.from,
  ...values,
})

test('a revision gap requests one resync; reconnect and cleanup discard previous state', context => {
  withFakeSockets(context)
  const views: unknown[] = []
  const stop = connectCIS(
    streamUrl('ws://localhost:8080', 'cis', 'TST'),
    state => views.push(state),
    () => {},
  )
  const socket = FakeSocket.sockets[0]
  socket.receive(snapshot())
  socket.receive(update({ previous_revision: 99 }))
  socket.receive(update({ previous_revision: 99 }))
  assert.equal(socket.sent.length, 1)
  assert.equal(views.at(-1), null)
  socket.receive(snapshot())
  context.mock.timers.tick(70_000)
  assert.equal(socket.sent.length, 1, 'a healthy stream must not resync on a timer')
  socket.close()
  assert.equal(views.at(-1), null)
  context.mock.timers.tick(1000)
  assert.equal(FakeSocket.sockets.length, 2)
  FakeSocket.sockets[1].receive({ ...snapshot(), movements: [], ordering: [] })
  stop()
  context.mock.timers.tick(120_000)
  assert.equal(FakeSocket.sockets.length, 2)
  const count = views.length
  socket.receive(snapshot())
  assert.equal(views.length, count)
})

test('the state digest matches the server implementation byte for byte', () => {
  // The same vector is pinned by darwin-browser's TestStateDigestGoldenVector.
  assert.equal(stateDigest('epoch-1', 7, ['R2/b', 'R1/a'], ['R1/a', 'R2/b'], ['warn-2', 'warn-1']), '72e9ae2f95c1a7ae')
})

test('a heartbeat attests matching state and exposes a map that has drifted', () => {
  const state = reduceCIS(null, snapshot())!
  assert.ok(attests(beat(state), state))
  assert.ok(!attests(beat(state, { revision: state.revision + 1 }), state))
  assert.ok(!attests(beat(state, { epoch: 'rebuilt' }), state))
  const lost = { ...state, movements: new Map(state.movements) }
  lost.movements.delete(state.ordering[0])
  assert.ok(!attests(beat(state), lost), 'a lost movement must not pass on an unchanged revision')
})

test('heartbeats keep a quiet stream alive and resync once when the digest disagrees', context => {
  withFakeSockets(context)
  const views: unknown[] = []
  const stop = connectCIS(
    streamUrl('ws://localhost:8080', 'cis', 'TST'),
    state => views.push(state),
    () => {},
  )
  const socket = FakeSocket.sockets[0]
  socket.receive(snapshot())
  const state = reduceCIS(null, snapshot())!

  socket.receive(beat(state))
  context.mock.timers.tick(70_000)
  socket.receive(beat(state))
  context.mock.timers.tick(70_000)
  assert.equal(socket.sent.length, 0, 'an agreeing heartbeat is liveness, not a reason to resync')
  assert.equal(FakeSocket.sockets.length, 1)

  socket.receive(beat(state, { digest: 'ffffffffffffffff' }))
  socket.receive(beat(state, { digest: 'ffffffffffffffff' }))
  assert.equal(socket.sent.length, 1)
  assert.equal(fromBinary(ClientMessageSchema, socket.sent[0]).command.case, 'resync')
  assert.notEqual(views.at(-1), null, 'the board keeps its trains while the snapshot is in flight')
  stop()
})

test('silence past the heartbeat deadline replaces the connection', context => {
  withFakeSockets(context)
  const stop = connectCIS(
    streamUrl('ws://localhost:8080', 'cis', 'TST'),
    () => {},
    () => {},
  )
  const socket = FakeSocket.sockets[0]
  socket.receive(snapshot())
  context.mock.timers.tick(74_000)
  assert.equal(socket.readyState, 1)
  context.mock.timers.tick(2_000)
  assert.equal(socket.readyState, 3, 'a wedged connection delivers nothing and reports no error')
  context.mock.timers.tick(1_000)
  assert.equal(FakeSocket.sockets.length, 2)
  stop()
})

test('an unanswered resync is retried before the socket is replaced', context => {
  withFakeSockets(context)
  const stop = connectCIS(
    streamUrl('ws://localhost:8080', 'cis', 'TST'),
    () => {},
    () => {},
  )
  const socket = FakeSocket.sockets[0]
  socket.receive(snapshot())
  socket.receive(beat(reduceCIS(null, snapshot())!, { digest: 'ffffffffffffffff' }))
  assert.equal(socket.sent.length, 1)
  context.mock.timers.tick(20_000)
  assert.equal(socket.sent.length, 2, 'a slow answer must not cost a working connection')
  assert.equal(socket.readyState, 1)
  context.mock.timers.tick(20_000)
  assert.equal(socket.readyState, 3)
  stop()
})

import { displayServices, nextDisplayBoundary, platformAlterations } from '../src/live/displayServices'

test('display policy keeps TrainOrder, feed names, null data and available split portions', () => {
  const initial = snapshot()
  const first = initial.movements[0]
  first.portions = [
    {
      rid: 'R2',
      category: 'VV',
      at: first.calling_points[0],
      available: true,
      cancelled: false,
      headcode: null,
      mode: 'train',
      operator_code: null,
      operator_name: null,
      origin: null,
      destination: first.destinations[0],
      coach_count: 4,
      position: 'rear',
      calls: first.calling_points,
    },
  ]
  const later = { ...first, id: 'R3/call', departure: { ...first.departure, planned: '2026-09-13T10:20:00Z' } }
  initial.movements.push(later)
  initial.ordering = [later.id, first.id]
  const state = reduceCIS(null, initial)!
  const result = displayServices(state, null, false, false)
  assert.deepEqual(
    result.services.map(service => service.id),
    initial.ordering,
  )
  assert.equal(result.services[0].destinations[0].name, 'Destination from feed')
  assert.equal(result.services[0].passengerCallPoints[0].associations[0].service?.length, 4)
  first.portions[0].available = false
  assert.equal(displayServices(state, null, false, false).services[1].passengerCallPoints[0].associations.length, 0)
})

test('a portion that joins another service here is left to the train it becomes', () => {
  const initial = snapshot()
  const main = initial.movements[0]
  const portion = {
    rid: 'R2',
    category: 'JJ' as const,
    at: main.station,
    available: true,
    cancelled: false,
    headcode: null,
    mode: 'train' as const,
    operator_code: null,
    operator_name: null,
    origin: null,
    destination: main.destinations[0],
    coach_count: 5,
    position: null,
    calls: main.calling_points,
  }
  // The joining half terminates here; the service it joins departs with both portions' origins on it.
  const joining = {
    ...main,
    id: 'R2/call',
    arrival: { ...main.departure, planned: '2026-09-13T10:00:00Z' },
    departure: { planned: null, estimated: null, actual: null, unknown_delay: false },
    portions: [portion],
  }
  main.portions = [{ ...portion, rid: 'R2' }]
  const terminating = { ...joining, id: 'R3/call', portions: [] }
  initial.movements.push(joining, terminating)
  initial.ordering = [main.id, joining.id, terminating.id]
  const services = displayServices(reduceCIS(null, initial)!, null, false, true).services
  assert.deepEqual(
    services.map(service => service.id),
    [main.id, terminating.id],
  )
  // A terminating service with no join of its own still says so.
  assert.equal(services[1].destinations[0].name, 'Terminates here')
  joining.portions = [{ ...portion, available: false }]
  assert.equal(displayServices(reduceCIS(null, initial)!, null, false, true).services.length, 3)
})

test('hiding terminating trains preserves departures, platform filters and warnings', () => {
  const initial = snapshot()
  const departure = initial.movements[0]
  const terminating = {
    ...departure,
    id: 'terminating',
    arrival: { ...departure.departure, actual: '2026-09-13T10:00:30Z' },
    departure: { planned: null, estimated: null, actual: null, unknown_delay: false },
    portions: [],
  }
  const cancelled = { ...terminating, id: 'cancelled-terminating', cancelled: true }
  initial.movements = [terminating, cancelled, departure]
  initial.ordering = initial.movements.map(movement => movement.id)
  const state = reduceCIS(null, initial)!
  const now = Date.parse(initial.window.from)
  assert.equal(displayServices(state, null, false, false, now).services.length, 3)
  assert.deepEqual(
    displayServices(state, null, false, false, now, true).services.map(service => service.id),
    [departure.id],
  )
  assert.deepEqual(displayServices(state, ['3'], false, true, now, true).services, [])

  const onlyTerminating = reduceCIS(null, { ...initial, ordering: [terminating.id, cancelled.id] })!
  assert.deepEqual(displayServices(onlyTerminating, null, false, false, now, true).services, [])
  assert.equal(nextDisplayBoundary(state, null, now), Date.parse(terminating.arrival.actual))
  assert.equal(nextDisplayBoundary(state, null, now, true), null)

  const moved = { ...terminating, platform: { ...terminating.platform, number: '3' } }
  const next = reduceCIS(state, update({ upserts: [moved] }))!
  assert.deepEqual(platformAlterations(state, next, ['2']), [terminating.id])
  assert.deepEqual(platformAlterations(state, next, ['2'], true), [])

  state.overrides.set('warning', {
    id: 'warning',
    kind: 'stand_clear',
    station: initial.station,
    platform: '2',
    movement_id: terminating.id,
    activates_at: initial.window.from,
    expires_at: initial.window.to,
    reason: 'TD',
    source: 'TD',
  })
  const warned = displayServices(state, null, false, false, now, true)
  assert.equal(warned.overrides.length, 1)
  assert.deepEqual(warned.services, [])
})

test('a train crossing the platforms a board watches is an alteration, either way', () => {
  const initial = snapshot()
  const here = reduceCIS(null, initial)!
  const moved = { ...initial.movements[0], platform: { ...initial.movements[0].platform, number: '5' } }
  const away = reduceCIS(here, update({ upserts: [moved] }))!

  assert.deepEqual(platformAlterations(here, away, ['2']), [moved.id])
  assert.deepEqual(platformAlterations(away, here, ['2']), [moved.id], 'a train moving onto the platform alters it too')
  assert.deepEqual(platformAlterations(here, away, ['2', '5']), [], 'a move between watched platforms changes no row')
  assert.deepEqual(platformAlterations(here, away, null), [], 'a board watching the whole station loses no train to another')
  assert.deepEqual(platformAlterations(null, away, ['2']), [], 'a board that has just connected has nothing to compare')
})

test('a platform first published, withdrawn, or belonging to a train no board lists is not an alteration', () => {
  const initial = snapshot()
  const here = reduceCIS(null, initial)!
  const unplatformed = { ...initial.movements[0], platform: { ...initial.movements[0].platform, number: null } }
  const unknown = reduceCIS(null, { ...initial, movements: [unplatformed] })!

  assert.deepEqual(platformAlterations(unknown, here, ['2']), [])
  assert.deepEqual(platformAlterations(here, unknown, ['2']), [])

  const suppressed = { ...initial.movements[0], platform: { ...initial.movements[0].platform, number: '5' }, suppressed: true }
  assert.deepEqual(platformAlterations(here, reduceCIS(here, update({ upserts: [suppressed] }))!, ['2']), [])
})

test('warnings replace only their platform and expire using the client clock', () => {
  const initial = snapshot()
  const other = { ...initial.movements[0], id: 'other', platform: { ...initial.movements[0].platform, number: '3' } }
  initial.movements.push(other)
  initial.ordering.push(other.id)
  initial.overrides = [
    {
      id: 'warning',
      kind: 'stand_clear',
      station: initial.station,
      platform: '2',
      movement_id: null,
      activates_at: fixture.window.from,
      expires_at: '2026-09-13T10:01:00Z',
      reason: 'TD',
      source: 'TD',
    },
  ]
  const state = reduceCIS(null, initial)!
  const starts = Date.parse(fixture.window.from)
  const expires = Date.parse('2026-09-13T10:01:00Z')
  assert.equal(nextDisplayBoundary(state, null, starts - 1), starts)
  assert.equal(nextDisplayBoundary(state, null, starts), expires)
  assert.equal(nextDisplayBoundary(state, null, expires), null)
  assert.equal(nextDisplayBoundary(state, ['3'], starts - 1), null)
  const active = displayServices(state, null, false, false, Date.parse(fixture.window.from))
  assert.deepEqual(
    active.services.map(service => service.id),
    ['other'],
  )
  assert.equal(active.overrides.length, 1)
  const expired = displayServices(state, null, false, false, Date.parse('2026-09-13T10:01:00Z'))
  assert.equal(expired.services.length, 2)
  assert.equal(expired.overrides.length, 0)
  assert.equal(displayServices(state, ['3'], false, false, Date.parse(fixture.window.from)).overrides.length, 0)
})

test('reported arrivals use the supplied display time and schedule a single boundary', () => {
  const initial = snapshot()
  const arrives = Date.parse(initial.window.from) + 5500
  initial.movements[0].arrival.actual = new Date(arrives).toISOString()
  const state = reduceCIS(null, initial)!
  assert.equal(nextDisplayBoundary(state, null, arrives - 1), arrives)
  assert.equal(displayServices(state, null, false, false, arrives - 1).services[0].hasArrived, false)
  assert.equal(displayServices(state, null, false, false, arrives).services[0].hasArrived, true)
  assert.equal(nextDisplayBoundary(state, null, arrives), null)
})

test('the initial snapshot displays five published platforms without waiting for confirmation updates', () => {
  const initial = snapshot()
  initial.movements = Array.from({ length: 5 }, (_, index) => ({
    ...structuredClone(initial.movements[0]),
    id: `service-${index}`,
    platform: { number: '2', confirmed: false, suppressed: false, source: null },
  }))
  initial.ordering = initial.movements.map(movement => movement.id)
  const state = reduceCIS(null, initial)!
  const services = displayServices(state, ['2'], false, false).services
  assert.deepEqual(
    services.map(service => service.id),
    initial.ordering,
  )
  assert.equal(displayServices(state, ['3'], false, true).services.length, 0)

  initial.movements[0].platform.suppressed = true
  initial.movements[1].platform.number = null
  const restricted = reduceCIS(null, initial)!
  assert.equal(displayServices(restricted, ['2'], false, false).services.length, 3)
  assert.equal(displayServices(restricted, ['2'], false, true).services.length, 5)
})

// The .pb files are frames darwin-browser's own encoder wrote, and the .json beside each is the
// message it encoded. Copy both from its docs/live/fixtures when the schema changes.
test('frames written by the service decode to the messages it encoded', () => {
  for (const [frame, message] of [
    [serviceSnapshotFrame, serviceSnapshot],
    [serviceStoppingSnapshotFrame, serviceStoppingSnapshot],
    [serviceUpdateFrame, serviceUpdate],
    [nrccSnapshotFrame, nrccSnapshot],
    [nrccUpdateFrame, nrccUpdate],
    [nrccClearFrame, nrccClear],
  ] as const) {
    assert.deepEqual(decodeServerMessage(frame), { nrcc_messages: [], ...message })
  }
})

test('station notices replace completely on snapshots and updates, including withdrawal', () => {
  const initial = reduceCIS(null, decodeServerMessage(nrccSnapshotFrame) as Snapshot)!
  assert.deepEqual(initial.nrcc_messages, nrccSnapshot.nrcc_messages)
  const changed = reduceCIS(initial, decodeServerMessage(nrccUpdateFrame) as Update)!
  assert.deepEqual(changed.nrcc_messages, nrccUpdate.nrcc_messages)
  assert.deepEqual(initial.nrcc_messages, nrccSnapshot.nrcc_messages, 'the previous state stays untouched')
  assert.deepEqual(reduceCIS(changed, decodeServerMessage(nrccClearFrame) as Update)!.nrcc_messages, [])
  assert.deepEqual(reduceCIS(changed, snapshot())!.nrcc_messages, [], 'an authoritative snapshot clears old notices too')

  const future = { ...snapshot(), nrcc_messages: [{ ...nrccSnapshot.nrcc_messages[0], category: 'Future', severity: '99' }] }
  assert.deepEqual(decodeServerMessage(new Uint8Array(encodeServerMessage(future))), future)
})

test('coach facilities preserve unknown, true and false through protobuf', () => {
  const sent = snapshot()
  sent.movements[0].coaches = [null, true, false].map((facility, i) => ({
    number: String(i),
    class: null,
    toilet_type: null,
    toilet_status: null,
    loading_percent: null,
    accessible: facility,
    cycle_spaces: facility,
    food: facility,
  }))
  assert.deepEqual(decodeServerMessage(new Uint8Array(encodeServerMessage(sent))), sent)
})

test('null, empty and zero survive the wire as themselves', () => {
  const movement = snapshot().movements[0]
  const unknown = {
    ...movement,
    coaches: null,
    coach_count: null,
    reverse_formation: null,
    platform: { ...movement.platform, suppressed: null },
  }
  const known = { ...movement, coaches: [], coach_count: 0, reverse_formation: false, platform: { ...movement.platform, suppressed: false } }
  const sent = { ...snapshot(), request_id: 'check-1', movements: [unknown, known] }
  assert.deepEqual(decodeServerMessage(new Uint8Array(encodeServerMessage(sent))), sent)
})

test('another protocol version is refused and an unknown message is ignored', context => {
  assert.throws(
    () => decodeServerMessage(new Uint8Array(encodeServerMessage({ ...snapshot(), version: 1 } as never))),
    /Unsupported stream version/,
  )
  assert.equal(decodeServerMessage(new Uint8Array([0x08, 0x02])), null, 'a payload a newer service added is not an error')

  withFakeSockets(context)
  const stop = connectCIS(
    new URL('ws://localhost/v1/cis/live?crs=TST'),
    () => {},
    () => {},
  )
  const socket = FakeSocket.sockets[0]
  assert.equal(socket.binaryType, 'arraybuffer')
  socket.onmessage?.({ data: JSON.stringify(snapshot()) })
  assert.equal(socket.readyState, 3, 'a text frame is a version 1 service, which closes the connection')
  stop()
})
