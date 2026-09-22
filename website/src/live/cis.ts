import { connectStream, type ConnectionStatus } from './connection'
import { digestState } from './digest'
import type { CISState, Heartbeat, Snapshot, Update } from './types'
import { encodeResync, PROTOCOL_VERSION } from './wire'

const RESYNC_TIMEOUT = 20_000

/** A gap invalidates the view until an authoritative snapshot replaces it. */
export function reduceCIS(state: CISState | null, message: Snapshot | Update): CISState | null {
  if (message.version !== PROTOCOL_VERSION) throw new Error('Unsupported CIS version')
  if (message.type === 'snapshot') {
    return {
      station: message.station,
      epoch: message.epoch,
      revision: message.revision,
      window: message.window,
      movements: new Map(message.movements.map(movement => [movement.id, movement])),
      ordering: message.ordering,
      overrides: new Map(message.overrides.map(override => [override.id, override])),
    }
  }
  if (message.type !== 'update') throw new Error('Unexpected CIS message')
  if (!state || message.epoch !== state.epoch || message.previous_revision !== state.revision) return null

  const movements = new Map(state.movements)
  const overrides = new Map(state.overrides)
  for (const id of message.removals) movements.delete(id)
  for (const movement of message.upserts) movements.set(movement.id, movement)
  for (const { id } of message.override_removals) overrides.delete(id)
  for (const override of message.override_upserts) overrides.set(override.id, override)

  return { ...state, revision: message.revision, window: message.window, ordering: message.ordering, movements, overrides }
}

/** Whether a heartbeat describes the state we hold, rather than a diverged one. */
export function attests(heartbeat: Heartbeat, state: CISState): boolean {
  return heartbeat.epoch === state.epoch && heartbeat.revision === state.revision && heartbeat.digest === digestState(state)
}

export function connectCIS(url: URL, render: (state: CISState | null) => void, onStatus: (status: ConnectionStatus) => void): () => void {
  let state: CISState | null = null
  let socket: WebSocket | undefined
  let waiting = false
  let retried = false
  let responseTimeout: ReturnType<typeof setTimeout> | undefined

  function request() {
    socket?.send(encodeResync())
    responseTimeout = setTimeout(() => {
      // Replacing the socket blanks the board, so an unanswered request is worth
      // asking again before giving up on a connection that is otherwise healthy.
      if (retried || !socket || socket.readyState !== WebSocket.OPEN) {
        socket?.close()
        return
      }
      retried = true
      request()
    }, RESYNC_TIMEOUT)
  }

  function resync() {
    if (waiting || !socket || socket.readyState !== WebSocket.OPEN) return
    waiting = true
    retried = false
    request()
  }

  const disconnect = connectStream(
    url,
    (incoming, current) => {
      socket = current
      if (incoming.type === 'heartbeat') {
        if (incoming.version !== PROTOCOL_VERSION) throw new Error('Unsupported CIS version')
        // Divergence leaves the board on stale data rather than blank: keep
        // rendering what we have until the authoritative snapshot lands.
        if (state && !attests(incoming, state)) resync()
        return
      }
      if (incoming.type !== 'snapshot' && incoming.type !== 'update') throw new Error('Unexpected CIS message')
      if (incoming.type === 'snapshot') {
        waiting = false
        clearTimeout(responseTimeout)
      }
      state = reduceCIS(state, incoming)
      if (!state) resync()
      onStatus(state ? 'live' : 'recovering')
      render(state)
    },
    () => {
      state = null
      socket = undefined
      waiting = false
      clearTimeout(responseTimeout)
      render(null)
    },
    onStatus,
  )

  return () => {
    clearTimeout(responseTimeout)
    disconnect()
  }
}
