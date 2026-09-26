import React from 'react'

import { comparePlatforms, type StationPlatforms } from '../../../live/stationPlatforms'

interface IProps {
  station: StationPlatforms
  selected: string[]
  onChange: (selected: string[]) => void
}

const samePlatform = (a: string, b: string) => a.toUpperCase() === b.toUpperCase()

/** Restricts a board to some of a station's platforms. None ticked means the whole station. */
export default function PlatformPicker({ station, selected, onChange }: IProps) {
  const known = station.status === 'ready' ? station.platforms : []
  // A platform already in the link stays listed, so that it can be unticked, even if the station's list lacks it.
  const platforms = [...known, ...selected.filter(p => !known.some(k => samePlatform(k, p)))].sort(comparePlatforms)

  function toggle(platform: string, on: boolean) {
    onChange(on ? [...selected, platform] : selected.filter(p => !samePlatform(p, platform)))
  }

  return (
    <fieldset className="platform-picker">
      <legend>Platforms</legend>

      {station.status === 'loading' && <p className="platform-picker--help-text">Loading this station's platforms...</p>}
      {station.status === 'unavailable' && platforms.length === 0 && (
        <p className="platform-picker--help-text">This station's platforms aren't known, so the board shows all of them.</p>
      )}

      {platforms.length > 0 && (
        <>
          <div className="platform-picker--options">
            {platforms.map(platform => (
              <label key={platform} className="platform-picker--option">
                <input
                  type="checkbox"
                  checked={selected.some(p => samePlatform(p, platform))}
                  onChange={e => toggle(platform, e.currentTarget.checked)}
                />
                {platform}
              </label>
            ))}
          </div>
          <p className="platform-picker--help-text">
            {selected.length === 0 ? 'Showing every platform. Tick some to show only those.' : 'Showing only the ticked platforms.'}
          </p>
        </>
      )}
    </fieldset>
  )
}
