import React from 'react'

import ToggleSwitch from '../../common/form/ToggleSwitch'
import type { RowPrefix } from './loadLedBoard'

export interface IPlatformSettings {
  rowPrefix: RowPrefix
  warningPlatform: boolean
}

export const defaultPlatformSettings: IPlatformSettings = { rowPrefix: 'ordinals', warningPlatform: false }

const RowPrefixes: Record<RowPrefix, string> = {
  ordinals: 'Ordinals',
  platforms: 'Platform numbers',
}

/** Preserve the platform choice in settings saved before the row prefix option. */
export function getRowPrefix(settings: Partial<IPlatformSettings> & { platformPosition?: string }): RowPrefix {
  return (
    settings.rowPrefix ??
    (settings.platformPosition === 'before' || settings.platformPosition === 'after' ? 'platforms' : defaultPlatformSettings.rowPrefix)
  )
}

interface IProps {
  settings: Partial<IPlatformSettings>
  onChange: (settings: Partial<IPlatformSettings>) => void
}

/** The platform options every LED board offers in its settings panel. */
export default function PlatformSettings({ settings, onChange }: IProps) {
  return (
    <>
      <ToggleSwitch
        checked={!!settings.warningPlatform}
        label="Name the platform in warnings"
        onChange={e => onChange({ warningPlatform: e.currentTarget.checked })}
      />
      <div>
        <label htmlFor="row-prefix">Row prefix</label>
        <select
          id="row-prefix"
          value={getRowPrefix(settings)}
          onChange={e => onChange({ rowPrefix: e.currentTarget.value as RowPrefix })}
          css={{ marginLeft: 4 }}
        >
          {Object.entries(RowPrefixes).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}
