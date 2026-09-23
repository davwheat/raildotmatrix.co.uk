import React, { useEffect, useState } from 'react'

import { applySourceParams, DataSourceProvider, useDataSource } from '../live/source'
import { useStationPlatforms } from '../live/stationPlatforms'

import Layout from '../components/Layout'
import Seo from '../components/Seo'
import { useRouter } from 'next/router'
import BoardOptions from '../components/BoardOptions'
import { BoardOptionsProvider, useBoardOptions } from '../components/BoardOptions/context'
import { displayTypes, applyOptions, type DisplayType } from '../components/BoardOptions/settings'
import styles from '../components/BoardOptions/options.module.scss'
import Attribution from '../components/common/Attribution'

import Form, { AutocompleteSelect, Select } from '../components/common/form'
import PlatformPicker from '../components/common/form/PlatformPicker'
import type { Option } from '../components/common/form'

// Deliberately not a CRS code, so an unloaded list never reads as a selected station.
const LoadingStations: Option = { label: 'Loading stations...', value: '__loading__' }

const DisplayTypes: Option[] = [...displayTypes]

export default function BoardSettingsPage() {
  return (
    <DataSourceProvider>
      <IndexPage />
    </DataSourceProvider>
  )
}

/** DataSourceProvider renders its children only after mount, so the query string is read from the address bar. */
function IndexPage() {
  const { mode, baseUrl } = useDataSource()
  const [autocomplete, setAutocomplete] = useState<Option[]>([LoadingStations])

  const [boardSettings, setBoardSettings] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const type = searchParams.get('type')

    return {
      station: searchParams.get('station') || '',
      type: (DisplayTypes.some(t => t.value === type) ? type! : DisplayTypes[0].value) as DisplayType,
      platforms: searchParams.getAll('platform'),
    }
  })
  const stationPlatforms = useStationPlatforms(baseUrl, boardSettings.station)

  // Options this page doesn't expose (legacy TOC names, etc.) are carried through
  // unchanged, so editing a board doesn't silently discard them.
  const [passthroughParams] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    params.delete('station')
    params.delete('type')
    params.delete('platform')
    return params.toString()
  })

  function boardParams(station: string) {
    const params = new URLSearchParams(passthroughParams)
    params.set('station', station)
    boardSettings.platforms.forEach(platform => params.append('platform', platform))
    applySourceParams(params, { mode, baseUrl })
    return params
  }

  function ChooseStation(station: Option | null) {
    // Platform numbers mean nothing at another station.
    setBoardSettings(settings =>
      station?.value === settings.station ? settings : { ...settings, station: station?.value || '', platforms: [] },
    )
  }

  function ChooseDisplay(display: React.ChangeEvent<HTMLSelectElement>) {
    setBoardSettings(settings => ({ ...settings, type: display.target.value as DisplayType }))
  }

  // Fetch live autocomplete data from API
  useEffect(() => {
    if (autocomplete[0].label === LoadingStations.label) {
      import('uk-railway-stations').then(({ default: data }) => {
        setAutocomplete(
          data.map(data => ({
            label: `${data.stationName} (${data.crsCode})`,
            value: data.crsCode,
          })),
        )
      })
    }
  }, [autocomplete, setAutocomplete])

  return (
    <Layout>
      <Seo title="Choose departure board" />
      <main className={styles.setup}>
        <header>
          <h1 className="display">Board settings</h1>
          <p>Choose a station, then set up your display.</p>
        </header>
        <BoardOptionsProvider key={boardSettings.type} type={boardSettings.type} platforms={boardSettings.platforms}>
          <SetupForm type={boardSettings.type} station={boardSettings.station} params={boardParams(boardSettings.station)}>
            <div className={styles.station}>
              <AutocompleteSelect
                onChange={ChooseStation}
                label="Select a station"
                autocompleteOptions={autocomplete}
                value={boardSettings.station}
              />
              <Select
                label="Display type"
                options={DisplayTypes}
                placeholder="Choose a display"
                onChange={ChooseDisplay}
                value={boardSettings.type}
              />
              {boardSettings.station && (
                <PlatformPicker
                  station={stationPlatforms}
                  selected={boardSettings.platforms}
                  onChange={platforms => setBoardSettings(settings => ({ ...settings, platforms }))}
                />
              )}
            </div>
          </SetupForm>
        </BoardOptionsProvider>
      </main>

      <Attribution />
    </Layout>
  )
}

function SetupForm({
  type,
  station,
  params,
  children,
}: {
  type: DisplayType
  station: string
  params: URLSearchParams
  children: React.ReactNode
}) {
  const router = useRouter()
  const { options } = useBoardOptions()
  return (
    <Form
      onSubmit={event => {
        event.preventDefault()
        if (!station) return
        applyOptions(params, type, options)
        void router.push(`/board/${type}?${params}`)
      }}
    >
      <article className={styles.columns}>
        {children}
        <div>
          <BoardOptions />
          <div className={styles.actions}>
            <button type="submit" disabled={!station} className={styles.primary}>
              Show board
            </button>
          </div>
        </div>
      </article>
    </Form>
  )
}
