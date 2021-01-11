import Config from "./Config"

export default function GenerateUrl(
  service,
  urlParams,
  queryParams,
  noKey_old = false
) {
  // Azure handles api key
  const noKey = true

  let queryString = noKey ? "" : `?apiKey=${Config.apiKey}`,
    i = noKey ? 0 : 1

  for (let [param, value] of Object.entries(queryParams)) {
    if (i === 0) queryString += `?${param}=${value}`
    else queryString += `&${param}=${value}`

    i++
  }
  return `${Config.endpoint}/${service}/${urlParams.join("/")}${queryString}`
}
