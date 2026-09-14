interface ApiConfig {
  endpoint: string
  /** The Huxley2 instance this site uses needs no key, so requests are generated without one. */
  apiKey?: string
}

const config: ApiConfig = {
  endpoint: `https://national-rail-api.davwheat.dev`,
}

export default config
