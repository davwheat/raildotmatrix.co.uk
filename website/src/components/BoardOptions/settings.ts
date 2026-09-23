export const displayTypes = [
  { value: 'infotec-landscape-dmi', label: 'Infotec landscape DMI' },
  { value: 'daktronics-data-display-dmi', label: 'Daktronics (Data Display) DMI' },
  { value: 'blackbox-landscape-lcd', label: 'Blackbox landscape LCD' },
] as const

export type DisplayType = (typeof displayTypes)[number]['value'] | 'class-700'

export const defaults = {
  color: 'orange' as 'orange' | 'white',
  rowPrefix: 'ordinals' as 'ordinals' | 'platforms',
  ordinalFormat: 'suffix' as 'suffix' | 'dot',
  warningPlatform: false,
  platformBox: false,
  compactLowerRow: true,
  serviceCount: 3,
  clockStyle: 'normal' as 'normal' | 'small-seconds' | 'small',
  alignPlatformRows: true,
  boardStyle: 'Yellow' as 'Yellow' | 'Blue' | 'Green/Blue',
  showCasing: true,
  worldlinePowered: false,
  withBackground: false,
  showUnconfirmedPlatforms: false,
  useLegacyTocNames: false,
}
export type DisplayOptions = typeof defaults
export type OptionKey = keyof DisplayOptions

export const storageKeys: Record<DisplayType, string> = {
  'infotec-landscape-dmi': 'newGtrBoardSettings',
  'daktronics-data-display-dmi': 'dataDisplayBoardSettings',
  'blackbox-landscape-lcd': 'tfwmLcdBoardSettings',
  'class-700': 'class700LcdBoardSettings',
}

const common: OptionKey[] = ['showUnconfirmedPlatforms', 'useLegacyTocNames']
const led: OptionKey[] = ['rowPrefix', 'ordinalFormat', 'warningPlatform']
export function optionKeys(type: DisplayType): OptionKey[] {
  switch (type) {
    case 'infotec-landscape-dmi':
      return [...common, ...led, 'color', 'platformBox', 'compactLowerRow', 'clockStyle', 'serviceCount', 'alignPlatformRows']
    case 'daktronics-data-display-dmi':
      return [...common, ...led, 'boardStyle', 'showCasing', 'worldlinePowered', 'withBackground']
    case 'blackbox-landscape-lcd':
      return common
    default:
      return []
  }
}

const choices = {
  color: ['orange', 'white'],
  clockStyle: ['normal', 'small-seconds', 'small'],
  rowPrefix: ['ordinals', 'platforms'],
  ordinalFormat: ['suffix', 'dot'],
  boardStyle: ['Yellow', 'Blue', 'Green/Blue'],
}

/** Old saved preferences remain usable; explicit URL options take precedence. */
export function readOptions(type: DisplayType, stored: unknown, query: URLSearchParams): DisplayOptions {
  const saved: Record<string, unknown> = stored && typeof stored === 'object' ? { ...stored } : {}
  if (!saved.rowPrefix && ['before', 'after'].includes(String(saved.platformPosition))) saved.rowPrefix = 'platforms'
  const values: Record<string, unknown> = { ...defaults }
  for (const key of optionKeys(type)) {
    for (const raw of [saved[key], query.has(key) ? query.get(key) : undefined]) {
      if (raw === undefined) continue
      if (key in choices) {
        if ((choices[key as keyof typeof choices] as readonly unknown[]).includes(raw)) values[key] = raw
      } else if (key === 'serviceCount') {
        const count = Number(raw)
        if (Number.isInteger(count) && count >= 1 && count <= 6) values[key] = count
      } else if (typeof raw === 'boolean') {
        values[key] = raw
      } else if (raw === '1' || raw === 'true') {
        values[key] = true
      } else if (raw === '0' || raw === 'false' || raw === '') {
        values[key] = false
      }
    }
  }
  return values as DisplayOptions
}

/** Include defaults too, so another browser's saved preferences cannot change a shared board. */
export function applyOptions(query: URLSearchParams, type: DisplayType, options: DisplayOptions) {
  for (const key of Object.keys(defaults)) query.delete(key)
  query.delete('hideSettings')
  for (const key of optionKeys(type)) {
    const value = options[key]
    query.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
  }
}

export function isRailAnnouncementsEmbed(framed: boolean, query: URLSearchParams, referrer: string): boolean {
  if (!framed) return false
  if (query.has('from-railannouncements.co.uk')) return true
  try {
    const host = new URL(referrer).hostname
    return host === 'railannouncements.co.uk' || host.endsWith('.railannouncements.co.uk')
  } catch {
    return false
  }
}
