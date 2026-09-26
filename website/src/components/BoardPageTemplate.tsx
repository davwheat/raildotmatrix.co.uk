import React from 'react'
import Link from 'next/link'
import NoSSR from '@mpth/react-no-ssr'

import { BoardOptionsProvider } from './BoardOptions/context'
import BoardControls from './BoardOptions/BoardControls'
import { storageKeys, type DisplayType } from './BoardOptions/settings'

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
  const requestedType = window.location.pathname.split('/')[2] as DisplayType
  const type = requestedType in storageKeys ? requestedType : 'infotec-landscape-dmi'
  const query = new URLSearchParams(window.location.search)
  const station = query.get('station') || ''

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
      <BoardOptionsProvider key={type} type={type} platforms={query.getAll('platform')}>
        <BoardControls editBoardUrl={editBoardUrl} />
        <Component station={station} editBoardUrl={editBoardUrl} />
      </BoardOptionsProvider>
    </DataSourceProvider>
  )
}
