import React, { useState } from 'react'

import Layout from '../components/Layout'
import SEO from '../components/Seo'
import TypewriterText from '../components/common/TypewriterText'
import PageLink from '../components/common/PageLink'
import useInterval from '../hooks/useInterval'
import type { PageProps } from 'gatsby'

export default function NotFoundPage(props: PageProps) {
  const [timeString, setTimeString] = useState(`${padZero(new Date().getHours())}:${padZero(new Date().getMinutes())}`)

  function padZero(input) {
    if (input < 10) {
      return `0${input}`
    } else {
      return `${input}`
    }
  }

  function updateTimeString() {
    const date = new Date()

    setTimeString(`${padZero(date.getHours())}:${padZero(date.getMinutes())}`)
  }

  useInterval(updateTimeString, 2500)

  return (
    <Layout>
      <SEO title="404: Not found" />
      <main>
        <header>
          <TypewriterText
            component="h1"
            className="display display--light"
            prefix={
              <>
                1st&nbsp;
                {timeString.split('').map(c => (
                  <span>{c}</span>
                ))}
              </>
            }
            text="404 Page"
            suffix="Cancelled"
            time={2000}
          />
        </header>
        <h1 className="display display--light">This page doesn't exist</h1>
        <PageLink to="/">Home page!</PageLink>
      </main>
    </Layout>
  )
}
