import React from 'react'

import Layout from '../components/layout'
import SEO from '../components/seo'
import TypewriterText from '../components/Common/TypewriterText'
import PageLink from '../components/Common/PageLink'
import Attribution from '../components/Common/Attribution'

const IndexPage = () => (
  <Layout>
    <SEO title="Home" />
    <main>
      <header>
        <TypewriterText component="h1" className="display" cursor text="Welcome to Rail Dot Matrix" time={2000} />
      </header>
      <article>
        <p>
          This site is made for train nerds who can't actually go outside, but want to experience a small bit of their local (or furthest away) train
          station.
        </p>
        <p>
          While sat comfortably at home, you can take a peek at what your station, or any other station in the UK, would look like at this very
          moment.
        </p>
        <PageLink to="board">Let's go!</PageLink>
      </article>
    </main>

    <Attribution />
  </Layout>
)

export default IndexPage
