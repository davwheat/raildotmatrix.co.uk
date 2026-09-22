import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: process.env.STATIC_EXPORT ? 'export' : undefined,

  // Next writes AGENTS.md and CLAUDE.md into the repo root on dev startup unless this is off.
  agentRules: false,

  // StrictMode is applied by <Layout> instead, so it covers the content pages without double-rendering the
  // boards, which drive their own animation and carousel state.
  reactStrictMode: false,

  images: {
    unoptimized: true,
  },

  compiler: {
    emotion: {
      sourceMap: true,
      autoLabel: 'always',
      labelFormat: '[local]',
    },
  },

  // `next dev` serves the site; the Pages Functions in functions/ are served by `yarn develop:workers` on 8787.
  // The key is omitted entirely for an export, which warns about rewrites whether or not any are returned.
  ...(process.env.STATIC_EXPORT
    ? {}
    : {
        async rewrites() {
          return [{ source: '/api/:path*', destination: 'http://127.0.0.1:8787/api/:path*' }]
        },
      }),

  webpack(config) {
    // The boards need SVGs both ways: `.inline.svg` as a styleable React component, every other SVG as a URL
    // for `url()` and `<img src>`.
    config.module.rules.push(
      {
        test: /\.inline\.svg$/,
        use: [{ loader: '@svgr/webpack', options: { exportType: 'default' } }],
      },
      {
        test: /\.svg$/,
        resourceQuery: { not: [/url/] },
        exclude: /\.inline\.svg$/,
        type: 'asset/resource',
        generator: {
          filename: 'static/media/[name].[hash][ext]',
        },
      },
    )

    return config
  },
}

export default nextConfig
