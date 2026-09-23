import React, { createContext, useContext, useEffect, useState } from 'react'
import { applyOptions, readOptions, storageKeys, type DisplayOptions, type DisplayType } from './settings'

const Context = createContext<{
  type: DisplayType
  options: DisplayOptions
  update: (change: Partial<DisplayOptions>) => void
} | null>(null)

export function BoardOptionsProvider({ type, children }: { type: DisplayType; children: React.ReactNode }) {
  const [options, setOptions] = useState(() => {
    let stored: unknown
    try {
      stored = JSON.parse(window.localStorage.getItem(storageKeys[type]) || 'null')
    } catch {
      // Preferences remain usable when browser storage is unavailable.
    }
    const query = new URLSearchParams(window.location.search)
    const setup = !window.location.pathname.startsWith('/board/')
    const queryType = query.get('type') || 'infotec-landscape-dmi'
    return readOptions(type, stored, setup && queryType !== type ? new URLSearchParams() : query)
  })

  function updateUrl(next: DisplayOptions) {
    const url = new URL(window.location.href)
    if (!url.pathname.startsWith('/board/')) url.searchParams.set('type', type)
    applyOptions(url.searchParams, type, next)
    window.history.replaceState(window.history.state, '', url)
  }

  useEffect(() => {
    function receive(event: StorageEvent) {
      if (event.storageArea !== window.localStorage || event.key !== storageKeys[type] || !event.newValue) return
      try {
        const saved: unknown = JSON.parse(event.newValue)
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return
        // A live change overrides this tab's initial URL preferences, without rebroadcasting.
        const next = readOptions(type, saved, new URLSearchParams())
        setOptions(next)
        updateUrl(next)
      } catch {
        // Ignore malformed preferences from another tab.
      }
    }
    window.addEventListener('storage', receive)
    return () => window.removeEventListener('storage', receive)
  }, [type])

  function update(change: Partial<DisplayOptions>) {
    const next = { ...options, ...change }
    setOptions(next)
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
