import React from 'react'
import Head from 'next/head'

import { siteMetadata } from '../siteMetadata'

function Seo({ title }: { title?: string }) {
  return (
    <Head>
      <title>{title ? `${title} | ${siteMetadata.title}` : siteMetadata.title}</title>
      <meta name="description" content={siteMetadata.description} />
    </Head>
  )
}

export default Seo
