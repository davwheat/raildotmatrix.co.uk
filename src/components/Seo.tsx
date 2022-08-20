import React from 'react';

import { useStaticQuery, graphql } from 'gatsby';
import { Meta, Title } from 'react-head';

function Seo({ title }: { title: string }) {
  const { site } = useStaticQuery(
    graphql`
      query {
        site {
          siteMetadata {
            title
            description
            author
          }
        }
      }
    `
  );

  const metaDescription = site.siteMetadata.description;

  return (
    <>
      {/* @ts-expect-error */}
      <Title>{title ? `${title} | ${site.siteMetadata.title}` : site.siteMetadata.title}</Title>
      {/* @ts-expect-error */}
      <Meta name="description" content={metaDescription} />
    </>
  );
}

export default Seo;
