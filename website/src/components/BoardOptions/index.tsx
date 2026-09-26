import React from 'react'
import { useBoardOptions } from './context'
import { formationIconTypes, type DisplayOptions, type FormationIcon } from './settings'
import styles from './options.module.scss'

type BooleanKey = { [K in keyof DisplayOptions]: DisplayOptions[K] extends boolean ? K : never }[keyof DisplayOptions]

const formationIconLabels: Record<FormationIcon, string> = {
  accessibility: 'Accessibility',
  cycles: 'Cycles',
  toilets: 'Standard toilets',
  food: 'Food',
  'first-class': 'First class',
}

function Check({ name, children, hint, disabled = false }: { name: BooleanKey; children: React.ReactNode; hint?: string; disabled?: boolean }) {
  const { options, update } = useBoardOptions()
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={options[name]} disabled={disabled} onChange={e => update({ [name]: e.currentTarget.checked })} />
      <span>
        {children}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  )
}

function Choice<K extends keyof DisplayOptions>({
  name,
  label,
  values,
  disabled = false,
}: {
  name: K
  label: string
  values: readonly (readonly [DisplayOptions[K], string])[]
  disabled?: boolean
}) {
  const { options, update } = useBoardOptions()
  return (
    <label className={styles.choice}>
      <span>{label}</span>
      <select
        value={String(options[name])}
        disabled={disabled}
        onChange={e => update({ [name]: typeof options[name] === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value })}
      >
        {values.map(([value, text]) => (
          <option key={String(value)} value={String(value)}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

/** The same controls are used on the setup page and inside the embed dialog. */
export default function BoardOptions() {
  const { type, options, update } = useBoardOptions()
  const infotec = type === 'infotec-landscape-dmi'
  const daktronics = type === 'daktronics-data-display-dmi'
  if (type === 'class-700') return <p className={styles.help}>This display has no additional options.</p>
  return (
    <div className={styles.options}>
      {(infotec || daktronics) && (
        <fieldset>
          <legend>Appearance</legend>
          {infotec && (
            <Choice
              name="color"
              label="LED colour"
              values={[
                ['orange', 'Amber'],
                ['white', 'White'],
              ]}
            />
          )}
          {daktronics && (
            <>
              <Check name="showCasing">Show board casing</Check>
              <Choice
                name="boardStyle"
                label="Casing colour"
                disabled={!options.showCasing}
                values={[
                  ['Yellow', 'Yellow'],
                  ['Blue', 'Blue'],
                  ['Green/Blue', 'Green / blue'],
                ]}
              />
              <Check name="withBackground" hint="Show the brown backing behind the LEDs.">
                LED panel background
              </Check>
            </>
          )}
        </fieldset>
      )}
      {(infotec || daktronics) && (
        <fieldset>
          <legend>Service rows</legend>
          <Choice name="serviceCount" label="Services to show" values={[1, 2, 3, 4, 5, 6].map(n => [n, String(n)] as const)} />
          <p className={styles.help}>Later services rotate on the lower service row.</p>
          <Choice
            name="rowPrefix"
            label="Row labels"
            values={[
              ['ordinals', 'Departure order'],
              ['platforms', 'Platform numbers'],
            ]}
          />
          <Choice
            name="ordinalFormat"
            label="Departure numbering"
            disabled={options.rowPrefix !== 'ordinals'}
            values={[
              ['suffix', '1st / 2nd / 3rd'],
              ['dot', '1. / 2. / 3.'],
            ]}
          />
          {infotec && (
            <>
              <Choice
                name="clockStyle"
                label="Clock style"
                values={[
                  ['normal', 'Normal'],
                  ['small-seconds', 'Small seconds'],
                  ['small', 'Small everything'],
                ]}
              />
              <Choice
                name="loadingBrightness"
                label="Loading fill brightness"
                values={[
                  [50, '50%'],
                  [100, '100%'],
                ]}
              />
              <Choice
                name="formationCount"
                label="Formation count"
                values={[
                  ['none', 'Nothing'],
                  ['number', '(n)'],
                  ['coaches', '(n coaches)'],
                  ['coaches-no-brackets', 'n coaches'],
                  ['carriages', '(n carriages)'],
                  ['carriages-no-brackets', 'n carriages'],
                ]}
              />
              <Check name="platformBox">Show platform box</Check>
              <Check name="alignPlatformRows" disabled={!options.platformBox}>
                Align lower rows with the platform box
              </Check>
              <Check name="compactLowerRow">Place lower service row beside the clock</Check>
              <Check name="smallScrollingText" hint="Use the compact font for calling points and service information.">
                Use smaller scrolling text
              </Check>
            </>
          )}
          {daktronics && (
            <Check name="worldlinePowered" hint="Capitalised station names and a single scrolling information line.">
              Worldline display style
            </Check>
          )}
          <Check name="warningPlatform">Name the platform in warnings</Check>
        </fieldset>
      )}
      {infotec && (
        <fieldset>
          <legend>Formation icons</legend>
          <p className={styles.help}>Accessibility takes precedence over the toilet icon in the same coach.</p>
          {formationIconTypes.map(icon => (
            <label key={icon} className={styles.check}>
              <input
                type="checkbox"
                checked={options.formationIcons.includes(icon)}
                onChange={e =>
                  update({
                    formationIcons: formationIconTypes.filter(type =>
                      type === icon ? e.currentTarget.checked : options.formationIcons.includes(type),
                    ),
                  })
                }
              />
              <span>{formationIconLabels[icon]}</span>
            </label>
          ))}
        </fieldset>
      )}
      <fieldset>
        <legend>Train information</legend>
        <Check name="hideTerminating" hint="Hide services that end their journey at this station.">
          Hide terminating trains
        </Check>
        <Check name="showUnconfirmedPlatforms" hint="Include services whose platform has not been published.">
          Show unconfirmed platforms
        </Check>
        <Check name="useLegacyTocNames">Use historic operator names</Check>
      </fieldset>
    </div>
  )
}
