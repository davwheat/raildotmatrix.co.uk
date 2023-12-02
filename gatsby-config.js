const PROD_PLUGINS =
  process.env.NODE_ENV === 'production'
    ? [
        {
          resolve: 'gatsby-plugin-remove-console',
          options: {
            exclude: ['error', 'warn'],
          },
        },
      ]
    : [];

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
    ...PROD_PLUGINS,

    'gatsby-plugin-webpack-bundle-analyser-v2',
    `gatsby-plugin-webpack-size`,
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
};
