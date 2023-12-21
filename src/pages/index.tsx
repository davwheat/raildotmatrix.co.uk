import React from 'react';

import Layout from '../components/Layout';
import Seo from '../components/Seo';
import TypewriterText from '../components/common/TypewriterText';
import PageLink from '../components/common/PageLink';
import Attribution from '../components/common/Attribution';

import type { PageProps } from 'gatsby';

export default function IndexPage(props: PageProps) {
  return (
    <Layout>
      <Seo title="Home" />
      <main>
        <header>
          <TypewriterText component="h1" className="display" cursor text="Welcome to Rail Dot Matrix" time={500} />
        </header>
        <article>
          <p>
            View a real-time display of the next trains at your local UK railway station. This site uses live information from National Rail Enquiries
            under license from Rail Delivery Group.
          </p>
          <PageLink to="board">Get started</PageLink>
        </article>
      </main>

      <Attribution />
    </Layout>
  );
}
