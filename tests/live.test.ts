import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { attests, reduceCIS, connectCIS } from '../src/live/cis'
import { streamUrl } from '../src/live/connection'
import { digestState, stateDigest } from '../src/live/digest'
import fixture from './snapshot.json'
import type { CISState, Heartbeat, Snapshot, Update } from '../src/live/types'

const snapshot = () => structuredClone(fixture) as Snapshot
const update = (values: Partial<Update> = {}): Update => ({
  version: 1,
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
  sent: string[] = []
  onmessage?: (event: { data: string }) => void
  onclose?: () => void
  onerror?: () => void
  constructor(readonly url: URL) {
    FakeSocket.sockets.push(this)
  }
  send(value: string) {
    this.sent.push(value)
  }
  receive(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) })
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
  version: 1,
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
  assert.equal(stateDigest('epoch-1', 7, ['R2/b', 'R1/a'], ['R1/a', 'R2/b'], ['warn-2', 'warn-1']), '39a8facb6240b671')
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
  assert.deepEqual(JSON.parse(socket.sent[0]), { type: 'resync' })
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

import { displayServices } from '../src/live/displayServices'

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
