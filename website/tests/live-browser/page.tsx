import React from 'react'
import { createRoot } from 'react-dom/client'
import { useServiceInformation } from '../../src/hooks/useServiceInformation'
import { DataSourceProvider } from '../../src/live/source'
import type { ServerMessage, Snapshot } from '../../src/live/types'
import { encodeServerMessage } from '../encode'
import fixture from '../snapshot.json'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

class FakeSocket {
  static OPEN = 1
  static sockets: FakeSocket[] = []
  readyState = 1
  onmessage?: (event: { data: ArrayBuffer }) => void
  onclose?: () => void
  constructor() {
    FakeSocket.sockets.push(this)
  }
  send() {}
  receive(message: ServerMessage) {
    this.onmessage?.({ data: encodeServerMessage(message) })
  }
  close() {
    this.readyState = 3
    this.onclose?.()
  }
}

export async function verify() {
  const originalSocket = window.WebSocket
  const originalNow = Date.now
  window.WebSocket = FakeSocket as unknown as typeof WebSocket
  history.replaceState(null, '', '?dataSource=websocket&liveServiceUrl=ws://example.test')
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  let renders = 0
  let latest: ReturnType<typeof useServiceInformation> | undefined
  function Probe({ parent }: { parent: number }) {
    latest = useServiceInformation('TST', ['2'], false)
    renders++
    return <span>{parent}</span>
  }
  const render = (parent: number) =>
    root.render(
      <DataSourceProvider>
        <Probe parent={parent} />
      </DataSourceProvider>,
    )
  try {
    render(0)
    for (let tries = 0; !FakeSocket.sockets.length && tries < 50; tries++) await wait(20)
    check(FakeSocket.sockets.length === 1, 'expected one connection')
    const socket = FakeSocket.sockets[0]
    const initial = { ...structuredClone(fixture), nrcc_messages: [] } as Snapshot
    socket.receive(initial)
    await settle()
    check(latest?.services?.length, 'snapshot did not reach the hook')
    const services = latest.services
    const quiet = renders
    await wait(1200)
    check(renders === quiet, 'quiet live data still rerenders every second')
    render(1)
    await settle()
    check(latest.services === services, 'parent render reconstructed unchanged services')
    check(FakeSocket.sockets.length === 1, 'fresh platform array reopened the connection')

    const now = Date.now()
    initial.overrides = [
      {
        id: 'warning',
        kind: 'stand_clear',
        station: initial.station,
        platform: '2',
        movement_id: null,
        activates_at: new Date(now + 300).toISOString(),
        expires_at: new Date(now + 800).toISOString(),
        reason: 'TD',
        source: 'TD',
      },
    ]
    initial.movements[0].arrival.actual = new Date(now + 1200).toISOString()
    socket.receive(initial)
    await settle()
    check(latest.overrides.length === 0, 'warning activated early')
    await wait(400)
    check(Number(latest.overrides.length) === 1, 'warning did not activate without a feed update')
    await wait(500)
    check(Number(latest.overrides.length) === 0, 'warning did not expire without a feed update')
    await wait(400)
    check(latest.services?.[0].hasArrived, 'arrival boundary did not refresh the service')

    initial.movements[0].arrival.actual = new Date(Date.now() + 60_000).toISOString()
    socket.receive(initial)
    await settle()
    check(!latest.services?.[0].hasArrived, 'new future arrival was not applied')
    Date.now = () => originalNow() + 120_000
    window.dispatchEvent(new Event('pageshow'))
    await settle()
    check(latest.services?.[0].hasArrived, 'resumed page retained stale time-dependent data')
    return 'Live hook: quiet feed has zero periodic renders; stable service identity; warning, arrival and resume checks passed.'
  } finally {
    root.unmount()
    window.WebSocket = originalSocket
    Date.now = originalNow
    check(
      FakeSocket.sockets.every(socket => socket.readyState === 3),
      'unmount left a connection open',
    )
  }
}
