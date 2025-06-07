import React from 'react'
import { Link, PageProps, navigate } from 'gatsby'
import NoSSR from '@mpth/react-no-ssr'

import './common/css/board-page.less'

interface BoardPageSettings {
  requireStation: boolean
}

export default function createBoardPage(Component: React.ComponentType<any>, { requireStation = true }: BoardPageSettings) {
  return function BoardPageTemplate({ location: { search } }: PageProps) {
    const urlParams = new URLSearchParams(search)

    const attrs = {
      editBoardCallback: () => {
        navigate('/board')
      },
      station: urlParams.get('station') || '',
    }

    if (requireStation && attrs.station === '') {
      return (
        <NoSSR>
          <div>
            <p>Invalid station ({attrs.station || '<none>'}).</p>
            <Link to="/board">Edit board</Link>
          </div>
        </NoSSR>
      )
    }

    return (
      <NoSSR>
        <Component {...attrs} />
      </NoSSR>
    )
  }
}
