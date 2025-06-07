import Config from './Config'

export default function GenerateUrl(service: string, urlParams: string[], queryParams: Record<string, string>) {
  const noKey = true

  let queryString = noKey ? '' : `?apiKey=${Config.apiKey}`,
    i = noKey ? 0 : 1

  if (queryParams) {
    for (let [param, value] of Object.entries(queryParams)) {
      if (i === 0) queryString += `?${param}=${value}`
      else queryString += `&${param}=${value}`

      i++
    }
  }

  return `${Config.endpoint}/${service}/${urlParams ? urlParams.join('/') : ''}${queryString}`
}
