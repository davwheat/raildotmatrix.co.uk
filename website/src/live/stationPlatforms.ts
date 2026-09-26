import { useEffect, useState } from 'react'

export type StationPlatforms =
  | { status: 'loading' }
  | { status: 'ready'; platforms: string[] }
  /** Darwin Browser describes no platform here, or couldn't answer. Either way, nothing is known about the station. */
  | { status: 'unavailable' }

/** The REST endpoint lives on the same host as the live WebSocket, which the data source names as `wss://…`. */
function platformsUrl(base: string, crs: string): URL {
  const url = new URL(base)
  url.protocol = ['https:', 'wss:'].includes(url.protocol) ? 'https:' : 'http:'
  url.pathname = `${url.pathname.replace(/\/$/, '')}/v1/platforms`
  url.search = new URLSearchParams({ crs }).toString()
  url.hash = ''
  return url
}

export async function fetchStationPlatforms(base: string, crs: string, signal?: AbortSignal): Promise<StationPlatforms> {
  const response = await fetch(platformsUrl(base, crs), { signal })
  if (!response.ok) return { status: 'unavailable' }

  const body: { platforms?: unknown } = await response.json()
  if (!Array.isArray(body.platforms) || body.platforms.length === 0) return { status: 'unavailable' }

  return { status: 'ready', platforms: [...body.platforms].map(String).sort(comparePlatforms) }
}

export function comparePlatforms(a: string, b: string): number {
  return a.localeCompare(b, 'en-GB', { numeric: true, sensitivity: 'base' })
}

/** The platforms at a station, from Darwin Browser's SMART reference data, refetched when the station or service changes. */
export function useStationPlatforms(base: string, crs: string): StationPlatforms {
  const [state, setState] = useState<StationPlatforms>({ status: 'loading' })

  useEffect(() => {
    if (!crs) {
      setState({ status: 'unavailable' })
      return
    }

    const abort = new AbortController()
    setState({ status: 'loading' })

    fetchStationPlatforms(base, crs, abort.signal)
      .then(result => {
        if (!abort.signal.aborted) setState(result)
      })
      .catch(() => {
        if (!abort.signal.aborted) setState({ status: 'unavailable' })
      })

    return () => abort.abort()
  }, [base, crs])

  return state
}
