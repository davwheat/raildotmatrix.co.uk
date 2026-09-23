import React, { createContext, useContext, useEffect, useState } from 'react'
import { applyOptions, readOptionOverrides, resolveOptions, storageKeys, type DisplayOptions, type DisplayType } from './settings'

const Context = createContext<{
  type: DisplayType
  options: DisplayOptions
  update: (change: Partial<DisplayOptions>) => void
} | null>(null)

export function BoardOptionsProvider({ type, platforms, children }: { type: DisplayType; platforms: string[]; children: React.ReactNode }) {
  const [overrides, setOverrides] = useState(() => {
    let stored: unknown
    try {
      stored = JSON.parse(window.localStorage.getItem(storageKeys[type]) || 'null')
    } catch {
      // Preferences remain usable when browser storage is unavailable.
    }
    const query = new URLSearchParams(window.location.search)
    const setup = !window.location.pathname.startsWith('/board/')
    const queryType = query.get('type') || 'infotec-landscape-dmi'
    return readOptionOverrides(type, stored, setup && queryType !== type ? new URLSearchParams() : query)
  })
  const options = resolveOptions(type, overrides, platforms)

  function updateUrl(next: Partial<DisplayOptions>) {
    const url = new URL(window.location.href)
    const setup = !url.pathname.startsWith('/board/')
    if (setup) url.searchParams.set('type', type)
    applyOptions(url.searchParams, type, resolveOptions(type, next, platforms))
    // Reopening setup or switching display types must still let this default follow the platform selection.
    if (setup && next.warningPlatform === undefined) url.searchParams.delete('warningPlatform')
    window.history.replaceState(window.history.state, '', url)
  }

  useEffect(() => {
    function receive(event: StorageEvent) {
      if (event.storageArea !== window.localStorage || event.key !== storageKeys[type] || !event.newValue) return
      try {
        const saved: unknown = JSON.parse(event.newValue)
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return
        // A live change overrides this tab's initial URL preferences, without rebroadcasting.
        const next = readOptionOverrides(type, saved, new URLSearchParams())
        setOverrides(next)
        updateUrl(next)
      } catch {
        // Ignore malformed preferences from another tab.
      }
    }
    window.addEventListener('storage', receive)
    return () => window.removeEventListener('storage', receive)
  }, [type, platforms])

  function update(change: Partial<DisplayOptions>) {
    // Keep automatic defaults out of storage so they can follow a later platform selection.
    const next = { ...overrides, ...change }
    setOverrides(next)
    try {
      window.localStorage.setItem(storageKeys[type], JSON.stringify(next))
    } catch {
      // The current board and its URL still retain the selected options.
    }
    updateUrl(next)
  }

  return <Context.Provider value={{ type, options, update }}>{children}</Context.Provider>
}

export function useBoardOptions() {
  const value = useContext(Context)
  if (!value) throw new Error('Board options require BoardOptionsProvider')
  return value
}
