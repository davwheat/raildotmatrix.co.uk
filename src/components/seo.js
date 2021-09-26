/**
 * SEO component that queries for data with
 *  Gatsby's useStaticQuery React hook
 *
 * See: https://www.gatsbyjs.org/docs/use-static-query/
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useStaticQuery, graphql } from 'gatsby';
import { Meta, Title } from 'react-head';

function SEO({ title }) {
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
      <Title>{title ? `${title} | ${site.siteMetadata.title}` : site.siteMetadata.title}</Title>
      <Meta name="description" content={metaDescription} />
    </>
    // <Helmet
    //   htmlAttributes={{
    //     lang,
    //   }}
    //   title={title}
    //   titleTemplate={`%s | ${site.siteMetadata.title}`}
    //   meta={[
    //     {
    //       name: `description`,
    //       content: metaDescription,
    //     },
    //     {
    //       property: `og:title`,
    //       content: title,
    //     },
    //     {
    //       property: `og:description`,
    //       content: metaDescription,
    //     },
    //     {
    //       property: `og:type`,
    //       content: `website`,
    //     },
    //     {
    //       name: `twitter:card`,
    //       content: `summary`,
    //     },
    //     {
    //       name: `twitter:creator`,
    //       content: site.siteMetadata.author,
    //     },
    //     {
    //       name: `twitter:title`,
    //       content: title,
    //     },
    //     {
    //       name: `twitter:description`,
    //       content: metaDescription,
    //     },
    //   ].concat(meta)}
    // />
  );
}

SEO.propTypes = {
  title: PropTypes.string,
};

export default SEO;
