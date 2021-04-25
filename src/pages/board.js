import React, { useEffect, useState } from 'react'

import Layout from '../components/layout'
import SEO from '../components/seo'
import TypewriterText from '../components/Common/TypewriterText'
import PageLink from '../components/Common/PageLink'

import Form, { AutocompleteSelect, Select } from '../components/Common/Form'

import NewGTR from '../components/Displays/NewGTR'
import Attribution from '../components/Common/Attribution'
import GenerateUrl from '../Api/GenerateUrl'

const IndexPage = () => {
  const [autocomplete, setAutocomplete] = useState([{ label: 'Loading stations...', value: 'VIC' }])

  let searchParams

  if (typeof window !== 'undefined') {
    searchParams = window && new URLSearchParams(window.location.search)
  }

  const stn = searchParams && searchParams.get('station')

  const [BoardSettings, setBoardSettings] = useState({
    station: stn || '',
    type: 'gtr-new',
  })

  const [Page, setPage] = useState(stn ? 1 : 0)

  function ChooseStation(stn) {
    setBoardSettings({
      type: BoardSettings.type,
      station: stn.value,
    })
  }

  function ChooseDisplay(display) {
    setBoardSettings({
      type: display.target.value,
      station: BoardSettings.station,
    })
  }

  // Fetch live autocomplete data from API
  useEffect(() => {
    if (autocomplete[0].label === 'Loading stations...') {
      fetch(GenerateUrl('crs'))
        .then(response => response.json())
        .then(data => {
          setAutocomplete(data.map(pair => ({ label: `${pair.stationName} (${pair.crsCode})`, value: pair.crsCode })))
        })
    }
  })

  return (
    <Layout>
      <SEO title={Page === 0 ? 'Board Setup' : 'Station Board'} />
      {Page === 0 && (
        <main>
          <header>
            <TypewriterText component="h1" className="display" cursor text="Board settings" time={2000} />
          </header>
          <article>
            <Form>
              <AutocompleteSelect
                onChange={ChooseStation}
                label="Select a station"
                autocompleteOptions={autocomplete}
                value={BoardSettings.station.value}
              />
              <Select
                label="Display type"
                options={[{ value: 'gtr-new', label: 'GTR New' }]}
                placeholder="Choose a display"
                onChange={ChooseDisplay}
                value={BoardSettings.type}
              />
              <PageLink
                onClick={() => {
                  if (!BoardSettings.station || !BoardSettings.type) return false
                  else return true
                }}
                afterExit={() => setPage(1)}
                style={{ cursor: 'pointer' }}
              >
                Next
              </PageLink>
            </Form>
          </article>
        </main>
      )}

      {Page === 1 && (
        <>
          <NewGTR
            editBoardCallback={() => {
              setPage(0)
            }}
            station={BoardSettings.station}
          />
        </>
      )}

      <Attribution />
    </Layout>
  )
}

export default IndexPage
