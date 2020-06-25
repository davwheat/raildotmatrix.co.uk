import React, { useState, useRef } from 'react'

import AllStations from '../Api/AllStations'

import Layout from '../components/layout'
import SEO from '../components/seo'
import TypewriterText from '../components/Common/TypewriterText'
import PageLink from '../components/Common/PageLink'

import Form, { AutocompleteSelect, Select } from '../components/Common/Form'

import NewGTR from '../components/Displays/NewGTR'
import Attribution from '../components/Common/Attribution'

const IndexPage = () => {
  const [BoardSettings, setBoardSettings] = useState({
    station: '',
    type: '',
  })

  const [Page, setPage] = useState(0)

  const boardRef = useRef(null)

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
                autocompleteOptions={AllStations}
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
          <EditBoard
            callback={() => {
              setPage(0)
            }}
          />
          <NewGTR ref={boardRef} station={BoardSettings.station} />
        </>
      )}

      <Attribution />
    </Layout>
  )
}

export default IndexPage

function EditBoard({ callback }) {
  return (
    <PageLink style={{ position: 'fixed', top: 16, left: 16, cursor: 'pointer' }} afterExit={callback}>
      Edit board
    </PageLink>
  )
}
