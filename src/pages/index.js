import React from 'react';

import Layout from '../components/Layout';
import SEO from '../components/Seo';
import TypewriterText from '../components/common/TypewriterText';
import PageLink from '../components/common/PageLink';
import Attribution from '../components/common/Attribution';

const IndexPage = () => (
  <Layout>
    <SEO title="Home" />
    <main>
      <header>
        <TypewriterText component="h1" className="display" cursor text="Welcome to Rail Dot Matrix" time={500} />
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
);

export default IndexPage;
