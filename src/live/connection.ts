export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'recovering'

/** Requested cadence. The server sends a heartbeat only after this much silence. */
export const HEARTBEAT_SECONDS = 30
/** Two missed heartbeats plus slack, matching the server's own pong deadline. */
const IDLE_TIMEOUT = 75_000
const CONNECT_TIMEOUT = 20_000

export function streamUrl(base: string, path: string, crs: string, heartbeatSeconds = HEARTBEAT_SECONDS): URL {
  const url = new URL(base)
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
    throw new Error('Use an HTTP or WebSocket service URL')
  }
  url.protocol = ['https:', 'wss:'].includes(url.protocol) ? 'wss:' : 'ws:'
  url.pathname = `${url.pathname.replace(/\/$/, '')}/v1/${path}/live`
  const query = new URLSearchParams({ crs })
  if (heartbeatSeconds > 0) query.set('heartbeat', String(heartbeatSeconds))
  url.search = query.toString()
  url.hash = ''
  return url
}

/** Reconnect only to this feed. A disconnect never enables the legacy API. */
export function connectStream(
  url: URL,
  onMessage: (message: unknown, socket: WebSocket) => void,
  onReset: () => void,
  onStatus: (status: ConnectionStatus) => void,
): () => void {
  let stopped = false
  let socket: WebSocket | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let idle: ReturnType<typeof setTimeout> | undefined
  let attempts = 0

  function connect() {
    if (stopped) return
    onStatus(attempts === 0 ? 'connecting' : 'reconnecting')
    const current = new WebSocket(url)
    socket = current
    // A half-open connection reports no error and delivers nothing, and browsers
    // never surface the pongs that would expose it. Server heartbeats give this
    // deadline something to observe while no trains are changing.
    const expectData = (within: number) => {
      clearTimeout(idle)
      idle = setTimeout(() => current.close(), within)
    }
    expectData(CONNECT_TIMEOUT)

    current.onmessage = event => {
      if (stopped || socket !== current) return
      expectData(IDLE_TIMEOUT)
      try {
        if (typeof event.data !== 'string' || event.data.length > 5_000_000) {
          throw new Error('Invalid stream message')
        }
        onMessage(JSON.parse(event.data), current)
        attempts = 0
      } catch (error) {
        console.error('Invalid live feed message', error)
        current.close()
      }
    }

    current.onerror = () => current.close()
    current.onclose = () => {
      clearTimeout(idle)
      if (stopped || socket !== current) return
      onReset()
      onStatus('reconnecting')
      const delay = Math.min(30_000, 1000 * 2 ** attempts++)
      retry = setTimeout(connect, delay)
    }
  }

  connect()
  return () => {
    stopped = true
    clearTimeout(retry)
    clearTimeout(idle)
    socket?.close()
    onReset()
  }
}
