import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta httpEquiv="x-ua-compatible" content="ie=edge" />
        <meta name="theme-color" content="#ffa500" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" />
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="anonymous" />
        {[48, 72, 96, 144, 192, 256, 384, 512].map(size => (
          <link key={size} rel="apple-touch-icon" sizes={`${size}x${size}`} href={`/icons/icon-${size}x${size}.png`} />
        ))}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
