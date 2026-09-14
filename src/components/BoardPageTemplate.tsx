import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import NoSSR from '@mpth/react-no-ssr'

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
  const router = useRouter()

  const station = new URLSearchParams(window.location.search).get('station') || ''

  if (requireStation && station === '') {
    return (
      <div>
        <p>Invalid station ({station || '<none>'}).</p>
        <Link href="/board">Edit board</Link>
      </div>
    )
  }

  const attrs = {
    editBoardCallback: (e: React.MouseEvent) => {
      e.preventDefault()
      router.push('/board')
    },
    station,
  }

  return (
    <DataSourceProvider>
      <Component {...attrs} />
    </DataSourceProvider>
  )
}
