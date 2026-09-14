import React from 'react'
import Link from 'next/link'
import NoSSR from '@mpth/react-no-ssr'

import getEditBoardUrl from '../functions/getEditBoardUrl'
import { DataSourceProvider } from '../live/source'

interface BoardPageSettings {
  requireStation: boolean
}

export default function createBoardPage(Component: React.ComponentType<any>, { requireStation = true }: BoardPageSettings) {
  return function BoardPageTemplate() {
    return (
      <NoSSR>
        <Board component={Component} requireStation={requireStation} />
      </NoSSR>
    )
  }
}

/** Rendered only after mount, so the query string is read straight from the address bar. */
function Board({ component: Component, requireStation }: { component: React.ComponentType<any>; requireStation: boolean }) {
  const editBoardUrl = getEditBoardUrl(window.location.pathname, window.location.search)
  const station = new URLSearchParams(window.location.search).get('station') || ''

  if (requireStation && station === '') {
    return (
      <div>
        <p>Invalid station ({station || '<none>'}).</p>
        <Link href={editBoardUrl}>Edit board</Link>
      </div>
    )
  }

  return (
    <DataSourceProvider>
      <Component station={station} editBoardUrl={editBoardUrl} />
    </DataSourceProvider>
  )
}
