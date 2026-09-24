import { useEffect, useMemo, useRef, useState } from 'react'
import GetNextTrainsAtStationStaff, { type StaffServicesResponse } from '../api/GetNextTrainsAtStationStaff'
import { processServices } from '../api/ProcessServices'
import { connectCIS } from '../live/cis'
import { streamUrl } from '../live/connection'
import { displayServices, nextDisplayBoundary, platformAlterations } from '../live/displayServices'
import { useDataSource } from '../live/source'
import type { CISState } from '../live/types'

export function useServiceInformation(station: string, platforms: string[] | null, legacyNames: boolean, showUnconfirmed = false) {
  const { mode, baseUrl } = useDataSource()
  // Sorted and joined so a caller passing a fresh array of the same platforms
  // every render does not tear the stream down and rebuild it.
  const platformKey = platforms?.length
    ? [...platforms]
        .map(platform => platform.toUpperCase())
        .sort()
        .join(',')
    : ''
  const key = `${mode}:${baseUrl}:${station}:${platformKey}:${showUnconfirmed}`
  const [data, setData] = useState<{ key: string; legacy?: StaffServicesResponse; cis?: CISState } | null>(null)
  const [boundaryVersion, setBoundaryVersion] = useState(0)

  useEffect(() => {
    let active = true
    setData(null)
    if (mode === 'websocket') {
      try {
        // The service filters by platform as well, so a board watching two of
        // twenty platforms is not sent the other eighteen. displayServices still
        // applies the same rules: this narrows the payload, it does not replace
        // the display policy.
        const url = streamUrl(baseUrl, 'cis', station)
        if (platformKey) {
          url.searchParams.set('platform', platformKey)
          if (showUnconfirmed) url.searchParams.set('include_unconfirmed', 'true')
        }
        // A board that has no data shows the same empty screen whatever the connection is doing, so its status is
        // deliberately dropped rather than rendered: a display reporting on its own plumbing is of no use to anyone
        // standing on a platform.
        const disconnect = connectCIS(
          url,
          state => {
            if (active) setData(state ? { key, cis: state } : null)
          },
          () => {},
        )
        return () => {
          active = false
          disconnect()
        }
      } catch (error) {
        console.error('Cannot connect to the live service', error)
        return () => {
          active = false
        }
      }
    }

    let request: AbortController | undefined
    async function load() {
      if (request) return
      request = new AbortController()
      const result = await GetNextTrainsAtStationStaff(station, { minOffset: 0 }, request)
      if (active && result && !('error' in result)) {
        setData({ key, legacy: result })
      }
      request = undefined
    }

    void load()
    const timer = setInterval(load, 20_000)
    return () => {
      active = false
      request?.abort()
      clearInterval(timer)
    }
  }, [key, mode, baseUrl, station, platformKey, showUnconfirmed])

  const [alterations, setAlterations] = useState(0)
  // A board that has just connected holds no earlier platform for any train, so its first state announces nothing.
  const compared = useRef<CISState | null>(null)

  useEffect(() => {
    const state = (data?.key === key && data.cis) || null
    const previous = compared.current
    compared.current = state
    if (!state) return
    const watched = platformKey ? platformKey.split(',') : null
    if (platformAlterations(previous, state, watched).length > 0) setAlterations(count => count + 1)
  }, [data, key, platformKey])

  const current = data?.key === key ? data : null
  const watched = useMemo(() => (platformKey ? platformKey.split(',') : null), [platformKey])
  // Keep service objects stable on parent renders. A quiet feed needs no one-second polling or repeated
  // conversion of every calling point; only an actual time boundary can change this projection.
  const projection = useMemo(() => {
    const now = Date.now()
    const view = current?.cis ? displayServices(current.cis, watched, legacyNames, showUnconfirmed, now) : null
    return {
      services:
        view?.services ??
        (current?.legacy
          ? processServices(current.legacy.trainServices || [], watched, legacyNames, station, showUnconfirmed).filter(
              service => !service.hasDeparted,
            )
          : null),
      overrides: view?.overrides || [],
      boundary: current?.cis ? nextDisplayBoundary(current.cis, watched, now) : null,
    }
  }, [current, watched, legacyNames, showUnconfirmed, station, boundaryVersion])

  useEffect(() => {
    if (!current?.cis) return
    const refresh = () => setBoundaryVersion(version => version + 1)
    // Cap long delays at the browser's signed 32-bit timer limit. Recompute/rearm if a timer runs early or
    // the wall clock changes, and refresh after a suspended page becomes visible again.
    const timer =
      projection.boundary === null ? undefined : setTimeout(refresh, Math.min(2_147_483_647, Math.max(1, projection.boundary - Date.now())))
    const resume = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('pageshow', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('pageshow', refresh)
    }
  }, [current, projection])

  return {
    /** Counts platform alterations rather than describing them: a board announces that one happened, not which train moved. */
    alterations,
    services: projection.services,
    overrides: projection.overrides,
    stationName: current?.cis?.station.name || current?.legacy?.locationName || station,
  }
}
