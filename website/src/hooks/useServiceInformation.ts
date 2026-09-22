import { useEffect, useRef, useState } from 'react'
import GetNextTrainsAtStationStaff, { type StaffServicesResponse } from '../api/GetNextTrainsAtStationStaff'
import { processServices } from '../api/ProcessServices'
import { connectCIS } from '../live/cis'
import { streamUrl } from '../live/connection'
import { displayServices, platformAlterations } from '../live/displayServices'
import { useDataSource } from '../live/source'
import type { CISState } from '../live/types'

const PARENT_ORIGINS = ['https://railannouncements.co.uk', 'http://localhost:3000', 'http://localhost:8000']

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
  const [now, setNow] = useState(Date.now)

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

    let parentSuppliesData = false
    let request: AbortController | undefined
    async function load() {
      if (parentSuppliesData || request) return
      request = new AbortController()
      const result = await GetNextTrainsAtStationStaff(station, { minOffset: 0 }, request)
      if (active && !parentSuppliesData && result && !('error' in result)) {
        setData({ key, legacy: result })
      }
      request = undefined
    }

    function receive(event: MessageEvent) {
      if (event.source !== window.parent || !PARENT_ORIGINS.concat(window.location.origin).includes(event.origin)) return
      if (!event.data || !Array.isArray(event.data.trainServices) || event.data.crs?.toUpperCase() !== station.toUpperCase()) return
      parentSuppliesData = true
      request?.abort()
      setData({ key, legacy: event.data })
    }

    window.addEventListener('message', receive)
    void load()
    const timer = setInterval(load, 20_000)
    return () => {
      active = false
      request?.abort()
      clearInterval(timer)
      window.removeEventListener('message', receive)
    }
  }, [key, mode, baseUrl, station, platformKey, showUnconfirmed])

  useEffect(() => {
    if (mode !== 'websocket') return
    // Platform overrides activate and expire even between server messages.
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [mode])

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
  const view = current?.cis ? displayServices(current.cis, platforms, legacyNames, showUnconfirmed, now) : null
  return {
    /** Counts platform alterations rather than describing them: a board announces that one happened, not which train moved. */
    alterations,
    services:
      view?.services ??
      (current?.legacy
        ? processServices(current.legacy.trainServices || [], platforms, legacyNames, station, showUnconfirmed).filter(
            service => !service.hasDeparted,
          )
        : null),
    overrides: view?.overrides || [],
    stationName: current?.cis?.station.name || current?.legacy?.locationName || station,
  }
}
