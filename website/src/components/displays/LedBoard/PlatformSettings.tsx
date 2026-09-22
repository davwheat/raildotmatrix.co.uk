import React from 'react'

import ToggleSwitch from '../../common/form/ToggleSwitch'
import type { PlatformPosition } from './loadLedBoard'

export interface IPlatformSettings {
  platformPosition: PlatformPosition
  warningPlatform: boolean
}

export const defaultPlatformSettings: IPlatformSettings = { platformPosition: 'none', warningPlatform: false }

const PlatformPositions: Record<PlatformPosition, string> = {
  none: "Don't show",
  before: 'Before the order ("Pl 1 1st")',
  after: 'After the order ("1st Pl 1")',
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
        <label htmlFor="platform-position">Platform numbers</label>
        <select
          id="platform-position"
          value={settings.platformPosition ?? defaultPlatformSettings.platformPosition}
          onChange={e => onChange({ platformPosition: e.currentTarget.value as PlatformPosition })}
          css={{ marginLeft: 4 }}
        >
          {Object.entries(PlatformPositions).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}
