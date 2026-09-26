/** The real board only names its platforms when it watches one or two; any more and it shows the station name. */
export function platformHeading(platforms: string[]): string | null {
  const selected = [...new Set(platforms.map(platform => platform.trim().toUpperCase()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'en', { numeric: true }),
  )

  switch (selected.length) {
    case 1:
      return `Platform ${selected[0]}`
    case 2:
      return `Platforms ${selected[0]} & ${selected[1]}`
    default:
      return null
  }
}
