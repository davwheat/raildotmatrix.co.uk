import React, { useEffect, useState } from 'react';

import Layout from '../components/Layout';
import Seo from '../components/Seo';
import TypewriterText from '../components/common/TypewriterText';
import PageLink from '../components/common/PageLink';

import Form, { AutocompleteSelect, Select } from '../components/common/form';

import Attribution from '../components/common/Attribution';

import NewGTR from '../components/displays/NewGTR';
import WestMidsLCD from '../components/displays/WestMidsLCD';
import Class700PIS from '../components/displays/Class700';
import NoSSR from '@mpth/react-no-ssr';

function isValidBoard(BoardSettings) {
  const boardName = BoardSettings.type;
  const station = BoardSettings.station;

  if (['gtr-new', 'tfwm-lcd'].includes(boardName) && station) {
    return true;
  } else if (boardName === 'class-700') {
    return true;
  }

  return false;
}

const IndexPage = () => {
  const [autocomplete, setAutocomplete] = useState([{ label: 'Loading stations...', value: 'VIC' }]);

  let searchParams;

  if (typeof window !== 'undefined') {
    searchParams = window && new URLSearchParams(window.location.search);
  }

  const stn = searchParams?.get('station');
  const type = searchParams?.get('type');

  const [BoardSettings, setBoardSettings] = useState({
    station: stn || '',
    type: type || 'gtr-new',
  });

  const [Page, setPage] = useState(isValidBoard(BoardSettings) ? 1 : 0);

  function ChooseStation(stn) {
    setBoardSettings({
      type: BoardSettings.type,
      station: stn.value,
    });
  }

  function ChooseDisplay(display) {
    setBoardSettings({
      type: display.target.value,
      station: BoardSettings.station,
    });
  }

  // Fetch live autocomplete data from API
  useEffect(() => {
    if (autocomplete[0].label === 'Loading stations...') {
      import('uk-railway-stations').then(({ default: data }) => {
        setAutocomplete(
          data.map((data) => ({
            label: `${data.stationName} (${data.crsCode})`,
            value: data.crsCode,
          }))
        );
      });
    }
  }, [autocomplete, setAutocomplete]);

  const Board = getBoard(BoardSettings, setPage);

  if (!Board && Page === 1) {
    // Reset when invalid board type is selected
    setPage(0);
  }

  return (
    <Layout>
      <NoSSR>
        <Seo title={Page === 0 ? 'Board Setup' : 'Station Board'} />
        {Page === 0 && (
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
                  value={BoardSettings.station.value}
                />
                <Select
                  label="Display type"
                  options={[
                    { value: 'gtr-new', label: 'Infotec DMI' },
                    { value: 'tfwm-lcd', label: 'Blackbox horizontal LCD' },
                  ]}
                  placeholder="Choose a display"
                  onChange={ChooseDisplay}
                  value={BoardSettings.type}
                />
                <PageLink
                  onClick={() => {
                    if (!BoardSettings.station || !BoardSettings.type) return false;
                    else return true;
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

        {Page === 1 && Board}
      </NoSSR>

      <Attribution />
    </Layout>
  );
};

function getBoard(BoardSettings, setPage) {
  const boardName = BoardSettings.type;

  const attrs = {
    editBoardCallback: () => {
      setPage(0);
    },
    station: BoardSettings.station,
  };

  if (boardName === 'gtr-new') {
    return <NewGTR {...attrs} />;
  } else if (boardName === 'tfwm-lcd') {
    return <WestMidsLCD {...attrs} />;
  } else if (boardName === 'class-700') {
    // Hidden option
    return <Class700PIS />;
  } else {
    return null;
  }
}

export default IndexPage;
