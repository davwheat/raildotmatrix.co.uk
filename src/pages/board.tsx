import React, { useEffect, useState } from 'react'

import { DataSourceProvider, useDataSource } from '../live/source'

import Layout from '../components/Layout'
import Seo from '../components/Seo'
import TypewriterText from '../components/common/TypewriterText'
import PageLink from '../components/common/PageLink'
import Attribution from '../components/common/Attribution'

import Form, { AutocompleteSelect, Select } from '../components/common/form'

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
  const [autocomplete, setAutocomplete] = useState([{ label: 'Loading stations...', value: 'VIC' }])

  const searchParams = new URLSearchParams(window.location.search)
  const stn = searchParams.get('station')
  const type = searchParams.get('type')

  const [BoardSettings, setBoardSettings] = useState({
    station: stn || '',
    type: type || 'infotec-landscape-dmi',
  })

  function ChooseStation(stn: { label: string; value: string }) {
    setBoardSettings({
      type: BoardSettings.type,
      station: stn.value,
    })
  }

  function ChooseDisplay(display: React.ChangeEvent<HTMLSelectElement>) {
    setBoardSettings({
      type: display.target.value,
      station: BoardSettings.station,
    })
  }

  // Fetch live autocomplete data from API
  useEffect(() => {
    if (autocomplete[0].label === 'Loading stations...') {
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
      <Seo title="Choose dpearture board" />
      <main>
        <header>
          <TypewriterText component="h1" className="display" cursor text="Board settings" time={500} />
        </header>
        <article>
          <Form>
            <AutocompleteSelect
              onChange={ChooseStation as any}
              label="Select a station"
              autocompleteOptions={autocomplete}
              value={BoardSettings.station}
            />
            <Select
              label="Display type"
              options={[
                { value: 'infotec-landscape-dmi', label: 'Infotec landscape DMI' },
                { value: 'daktronics-data-display-dmi', label: 'Daktronics (Data Display) DMI' },
                { value: 'blackbox-landscape-lcd', label: 'Blackbox landscape LCD' },
              ]}
              placeholder="Choose a display"
              onChange={ChooseDisplay as any}
              value={BoardSettings.type}
            />
            <PageLink
              to={
                BoardSettings.station && BoardSettings.type
                  ? `/board/${BoardSettings.type}?${new URLSearchParams({ station: BoardSettings.station, dataSource: mode, liveServiceUrl: baseUrl })}`
                  : undefined
              }
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
