const PROD_PLUGINS = process.env.NODE_ENV === 'production' ? [`gatsby-plugin-preact`] : []

module.exports = {
  siteMetadata: {
    title: `Rail Dot Matrix`,
    description: `See a virtual railway dot matrix for any UK station.`,
    author: `@davwheat`,
  },
  plugins: [
    `gatsby-plugin-htaccess`,
    `gatsby-plugin-react-head`,
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `UK Rail Dot Matrix`,
        short_name: `Rail Dot Matrix`,
        start_url: `/`,
        background_color: `#000`,
        theme_color: `#ffa500`,
        display: `minimal-ui`,
        icon: `src/images/logo.png`, // This path is relative to the root of the site.
      },
    },
    'gatsby-plugin-webpack-bundle-analyser-v2',
    ...PROD_PLUGINS,
  ],
}
