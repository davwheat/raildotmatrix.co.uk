export function getUrlParam(key: string) {
  if (typeof window === 'undefined') return null

  return getQueryParams(window.location.search)[key] ?? null
}

function getQueryParams(queryString: string) {
  const params = {}

  new URLSearchParams(queryString).forEach((value, key) => {
    let decodedKey = decodeURIComponent(key)
    const decodedValue = decodeURIComponent(value)

    if (decodedKey.endsWith('[]')) {
      // This key is part of an array
      decodedKey = decodedKey.replace('[]', '')
      params[decodedKey] || (params[decodedKey] = [])
      params[decodedKey].push(decodedValue)
    } else {
      // Just a regular parameter
      params[decodedKey] = decodedValue
    }
  })

  return params
}
