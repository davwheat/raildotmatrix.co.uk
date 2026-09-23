export const displayTypes = [
  { value: 'infotec-landscape-dmi', label: 'Infotec landscape DMI' },
  { value: 'daktronics-data-display-dmi', label: 'Daktronics (Data Display) DMI' },
  { value: 'blackbox-landscape-lcd', label: 'Blackbox landscape LCD' },
] as const

export type DisplayType = (typeof displayTypes)[number]['value'] | 'class-700'

export const formationIconTypes = ['accessibility', 'cycles', 'toilets', 'food', 'first-class'] as const
export type FormationIcon = (typeof formationIconTypes)[number]

export const defaults = {
  color: 'orange' as 'orange' | 'white',
  rowPrefix: 'ordinals' as 'ordinals' | 'platforms',
  ordinalFormat: 'suffix' as 'suffix' | 'dot',
  warningPlatform: false,
  platformBox: false,
  compactLowerRow: true,
  smallScrollingText: false,
  serviceCount: 3,
  loadingBrightness: 50 as 50 | 100,
  formationCount: 'none' as 'none' | 'number' | 'coaches' | 'coaches-no-brackets' | 'carriages' | 'carriages-no-brackets',
  formationIcons: [...formationIconTypes] as FormationIcon[],
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
      return [
        ...common,
        ...led,
        'color',
        'platformBox',
        'compactLowerRow',
        'smallScrollingText',
        'clockStyle',
        'loadingBrightness',
        'formationCount',
        'formationIcons',
        'serviceCount',
        'alignPlatformRows',
      ]
    case 'daktronics-data-display-dmi':
      return [...common, ...led, 'boardStyle', 'showCasing', 'worldlinePowered', 'withBackground']
    case 'blackbox-landscape-lcd':
      return common
    default:
      return []
  }
}

const choices = {
  formationCount: ['none', 'number', 'coaches', 'coaches-no-brackets', 'carriages', 'carriages-no-brackets'],
  color: ['orange', 'white'],
  clockStyle: ['normal', 'small-seconds', 'small'],
  rowPrefix: ['ordinals', 'platforms'],
  ordinalFormat: ['suffix', 'dot'],
  boardStyle: ['Yellow', 'Blue', 'Green/Blue'],
}

/** Old saved preferences remain usable; explicit URL options take precedence. */
export function readOptionOverrides(type: DisplayType, stored: unknown, query: URLSearchParams): Partial<DisplayOptions> {
  const saved: Record<string, unknown> = stored && typeof stored === 'object' ? { ...stored } : {}
  if (!saved.rowPrefix && ['before', 'after'].includes(String(saved.platformPosition))) saved.rowPrefix = 'platforms'
  const values: Record<string, unknown> = {}
  for (const key of optionKeys(type)) {
    for (const raw of [saved[key], query.has(key) ? query.get(key) : undefined]) {
      if (raw === undefined) continue
      if (key === 'formationIcons') {
        const icons = typeof raw === 'string' ? (raw.trim() ? raw.split(',').map(icon => icon.trim().toLowerCase()) : []) : raw
        if (Array.isArray(icons) && icons.every(icon => formationIconTypes.includes(icon))) {
          values[key] = formationIconTypes.filter(icon => icons.includes(icon))
        }
      } else if (key in choices) {
        if ((choices[key as keyof typeof choices] as readonly unknown[]).includes(raw)) values[key] = raw
      } else if (key === 'loadingBrightness') {
        const brightness = Number(raw)
        if (brightness === 50 || brightness === 100) values[key] = brightness
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
  return values as Partial<DisplayOptions>
}

/** No platform filter means the whole station; only a single-platform board defaults to unnamed warnings. */
export function resolveOptions(type: DisplayType, overrides: Partial<DisplayOptions>, platforms: string[]): DisplayOptions {
  const platformCount = new Set(platforms.map(platform => platform.trim().toUpperCase()).filter(Boolean)).size
  const warningPlatform = optionKeys(type).includes('warningPlatform') && platformCount !== 1
  return { ...defaults, warningPlatform, ...overrides }
}

export function readOptions(type: DisplayType, stored: unknown, query: URLSearchParams): DisplayOptions {
  return resolveOptions(type, readOptionOverrides(type, stored, query), query.getAll('platform'))
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
