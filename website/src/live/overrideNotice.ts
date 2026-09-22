import type { PlatformOverride } from './types'

export type NoticeKind = PlatformOverride['kind']

/** Only one warning fits a board, and a passing train is the more urgent of the two. */
export function noticeKind(overrides: PlatformOverride[]): NoticeKind | null {
  if (overrides.some(override => override.kind === 'stand_clear')) return 'stand_clear'
  return overrides.length > 0 ? 'not_for_public_use' : null
}
