export type UrlParamValue = string | string[]

export function getUrlParam(key: string): UrlParamValue | null {
  if (typeof window === 'undefined') return null

  return getQueryParams(window.location.search)[key] ?? null
}

function getQueryParams(queryString: string) {
  const params: Record<string, string | string[]> = {}

  new URLSearchParams(queryString).forEach((value, key) => {
    let decodedKey = decodeURIComponent(key)
    const decodedValue = decodeURIComponent(value)

    if (decodedKey.endsWith('[]')) {
      // This key is part of an array
      decodedKey = decodedKey.replace('[]', '')
      const existing = params[decodedKey]
      const values = Array.isArray(existing) ? existing : (params[decodedKey] = [])
      values.push(decodedValue)
    } else {
      // Just a regular parameter
      params[decodedKey] = decodedValue
    }
  })

  return params
}
