module.exports = {
  siteMetadata: {
    title: `Rail Dot Matrix`,
    description: `See a virtual railway dot matrix for any UK station.`,
    author: `@davwheat`,
  },
  flags: {
    DEV_SSR: true,
  },
  plugins: [
    {
      resolve: 'gatsby-plugin-react-svg',
      options: {
        rule: {
          include: /\.inline\.svg$/,
        },
      },
    },
    {
      resolve: `gatsby-plugin-emotion`,
      options: {
        sourceMap: true,
        autoLabel: 'always',
        labelFormat: `[local]`,
        cssPropOptimization: true,
      },
    },
    `gatsby-plugin-react-head`,
    {
      resolve: `gatsby-plugin-cloudflare-pages`,
      options: {
        headers: { '/*': ['! X-Frame-Options'] },
      },
    },
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `UK Rail Dot Matrix`,
        short_name: `Rail Dot Matrix`,
        start_url: `/`,
        background_color: `#000`,
        theme_color: `#ffa500`,
        display: `minimal-ui`,
        icon: `src/images/logo.png`,
      },
    },
    `gatsby-plugin-less`,
    {
      resolve: 'gatsby-plugin-react-svg',
      options: {
        rule: {
          include: /\.inline\.svg$/,
        },
      },
    },
  ],
}
