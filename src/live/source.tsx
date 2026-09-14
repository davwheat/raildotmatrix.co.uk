import NoSSR from '@mpth/react-no-ssr'
import React, { createContext, useContext, useState } from 'react'
import useStateWithLocalStorage from '../hooks/useStateWithLocalStorage'

export type DataSource = 'original' | 'websocket'
export const DEFAULT_LIVE_URL = process.env.NEXT_PUBLIC_LIVE_SERVICE_URL || 'ws://localhost:8080'

interface SourceSettings {
  mode: DataSource
  baseUrl: string
}

const DEFAULT_SETTINGS: SourceSettings = { mode: 'original', baseUrl: DEFAULT_LIVE_URL }

const SourceContext = createContext<SourceSettings>(DEFAULT_SETTINGS)
export const useDataSource = () => useContext(SourceContext)

/** Keeps a shared link as short as its overrides: a setting left at its default is absent from the URL. */
function setOverride(url: URL, name: string, value: string, fallback: string) {
  if (value === fallback) {
    url.searchParams.delete(name)
  } else {
    url.searchParams.set(name, value)
  }
}

export function DataSourceProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useStateWithLocalStorage<SourceSettings>(
    'live-data-source',
    DEFAULT_SETTINGS,
    value => value && ['original', 'websocket'].includes(value.mode) && typeof value.baseUrl === 'string',
  )
  const [settings, setSettings] = useState<SourceSettings>(() => {
    if (typeof window === 'undefined') return stored
    const query = new URLSearchParams(window.location.search)
    return {
      mode: query.get('dataSource') === 'websocket' ? 'websocket' : query.get('dataSource') === 'original' ? 'original' : stored.mode,
      baseUrl: query.get('liveServiceUrl') || stored.baseUrl,
    }
  })

  function update(next: SourceSettings) {
    setSettings(next)
    setStored(next)
    const url = new URL(window.location.href)
    setOverride(url, 'dataSource', next.mode, DEFAULT_SETTINGS.mode)
    setOverride(url, 'liveServiceUrl', next.baseUrl, DEFAULT_SETTINGS.baseUrl)
    window.history.replaceState(null, '', url)
  }

  const embedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('from-railannouncements.co.uk')

  const boardPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/board/')

  // The picker is a development tool, so built sites keep the default source unless a link overrides it. The
  // comparison is against a literal the bundler inlines, which drops the controls from the production bundle.
  const showControls = process.env.NODE_ENV === 'development' && !embedded

  return (
    <NoSSR>
      <SourceContext.Provider value={settings}>
        {showControls && (
          <div
            className="data-source-settings"
            style={{
              position: boardPage ? 'fixed' : 'relative',
              top: 8,
              right: boardPage ? 8 : undefined,
              zIndex: 1001,
              padding: 16,
              borderRadius: 8,
              background: '#333',
              color: '#fff',
              maxWidth: 'calc(100vw - 32px)',
              boxSizing: 'border-box',
              fontSize: 16,
            }}
          >
            <label>
              Train data source{' '}
              <select
                aria-label="Train data source"
                value={settings.mode}
                onChange={event => update({ ...settings, mode: event.target.value as DataSource })}
              >
                <option value="original">Original</option>
                <option value="websocket">Live WebSocket feed</option>
              </select>
            </label>
            {settings.mode === 'websocket' && (
              <label style={{ display: 'block', marginTop: 12 }}>
                Service URL{' '}
                <input
                  aria-label="Service URL"
                  key={settings.baseUrl}
                  defaultValue={settings.baseUrl}
                  onBlur={event => update({ ...settings, baseUrl: event.target.value.trim() })}
                />
              </label>
            )}
          </div>
        )}
        {children}
      </SourceContext.Provider>
    </NoSSR>
  )
}
