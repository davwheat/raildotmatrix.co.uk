import Head from 'next/head'
import type { AppProps } from 'next/app'

import { DEFAULT_TITLE } from '../siteMetadata'

// Next's Pages Router only accepts global stylesheets imported from this file, so every board's styles are
// collected here rather than alongside the component that uses them. Order is load order, and the comments
// below mark the places where one stylesheet has to win a tie against another.

// Base
import '../css/fonts.css'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/700.css'
import '../css/layout.scss'
import '../components/common/css/board-page.scss'

// Form controls
import '../components/common/form/css/Select.scss'
import '../components/common/form/css/ToggleSwitch.scss'

// Blackbox landscape LCD
import '../components/displays/WestMidsLCD/css/board/index.scss'
import '../components/displays/WestMidsLCD/css/board/header.scss'
import '../components/displays/WestMidsLCD/css/board/nextTrain.scss'
import '../components/displays/WestMidsLCD/css/board/secondaryTrainData.scss'
import '../components/displays/WestMidsLCD/css/board/platformWarning.scss'
import '../components/displays/WestMidsLCD/css/board/fadeBetween.scss'

// Class 700 PIS. The three after index.scss share its selectors and must not lose a specificity tie.
import '../components/displays/Class700/css/index.scss'
import '../components/displays/Class700/css/destination.scss'
import '../components/displays/Class700/css/callingPoints.scss'
import '../components/displays/Class700/css/coachInfo.scss'
import '../components/displays/Class700/css/stoppingDiagram.scss'
import '../components/displays/Class700/css/slideyScrollText.scss'
import '../components/displays/Class700/reusable/SmallClock.scss'

// Board chrome loads last: its .train-link rule has to beat the base one in layout.scss.
import '../components/displays/NewGTR/css/index.scss'
import '../components/displays/WestMidsLCD/css/index.scss'
import '../components/common/css/attribution.scss'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>{DEFAULT_TITLE}</title>
      </Head>
      <Component {...pageProps} />
    </>
  )
}
