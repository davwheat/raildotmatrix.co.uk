import React, { useEffect, useState } from 'react'

import { applySourceParams, DataSourceProvider, useDataSource } from '../live/source'

import Layout from '../components/Layout'
import Seo from '../components/Seo'
import TypewriterText from '../components/common/TypewriterText'
import PageLink from '../components/common/PageLink'
import Attribution from '../components/common/Attribution'

import Form, { AutocompleteSelect, Select } from '../components/common/form'
import type { Option } from '../components/common/form'

// Deliberately not a CRS code, so an unloaded list never reads as a selected station.
const LoadingStations: Option = { label: 'Loading stations...', value: '__loading__' }

const DisplayTypes: Option[] = [
  { value: 'infotec-landscape-dmi', label: 'Infotec landscape DMI' },
  { value: 'daktronics-data-display-dmi', label: 'Daktronics (Data Display) DMI' },
  { value: 'blackbox-landscape-lcd', label: 'Blackbox landscape LCD' },
]

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
      type: DisplayTypes.some(t => t.value === type) ? type! : DisplayTypes[0].value,
    }
  })

  // Options this page doesn't expose (platform filters, legacy TOC names, etc.) are carried through
  // unchanged, so editing a board doesn't silently discard them.
  const [passthroughParams] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    params.delete('station')
    params.delete('type')
    return params.toString()
  })

  function boardParams(station: string) {
    const params = new URLSearchParams(passthroughParams)
    params.set('station', station)
    applySourceParams(params, { mode, baseUrl })
    return params
  }

  function ChooseStation(station: Option | null) {
    setBoardSettings(settings => ({ ...settings, station: station?.value || '' }))
  }

  function ChooseDisplay(display: React.ChangeEvent<HTMLSelectElement>) {
    setBoardSettings(settings => ({ ...settings, type: display.target.value }))
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
      <main>
        <header>
          <TypewriterText component="h1" className="display" cursor text="Board settings" time={500} />
        </header>
        <article>
          <Form>
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
            <PageLink
              to={boardSettings.station ? `/board/${boardSettings.type}?${boardParams(boardSettings.station)}` : undefined}
              style={{ cursor: 'pointer' }}
            >
              Next
            </PageLink>
          </Form>
        </article>
      </main>

      <Attribution />
    </Layout>
  )
}
