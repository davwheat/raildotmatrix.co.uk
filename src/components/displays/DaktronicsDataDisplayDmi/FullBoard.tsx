import React, { useEffect, useState } from 'react'

import NoServicesMessage from './NoServicesMessage'
import PlatformAlterationMessage from './PlatformAlterationMessage'
import PlatformWarningMessage from './PlatformWarningMessage'
import Clock from './Clock'
import TrainServices from './TrainServices'

import boardFill from './board-fill.svg'

import { css } from '@emotion/react'

import { useServiceInformation } from '../../../hooks/useServiceInformation'
import { noticeKind } from '../../../live/overrideNotice'

const BOARD_WIDTH = 2250
const BOARD_HEIGHT = 450

const X_PAD = 24
const Y_PAD_TOP = 32
const Y_PAD_BOTTOM = 16

const X_PAD_CASING = X_PAD + 78
const Y_PAD_TOP_CASING = Y_PAD_TOP + 74
const Y_PAD_BOTTOM_CASING = Y_PAD_BOTTOM + 94

interface IProps {
  platforms?: string[]
  station: string
  useLegacyTocNames?: boolean
  showUnconfirmedPlatforms: boolean
  hasCasing: boolean
  worldlinePowered: boolean
}

const base = css`
  --board-width: ${BOARD_WIDTH}px;
  --board-height: ${BOARD_HEIGHT}px;

  --board-height-inner: ${BOARD_HEIGHT - Y_PAD_TOP - Y_PAD_BOTTOM}px;
  --board-width-inner: ${BOARD_WIDTH - X_PAD - X_PAD}px;
  --row-height: calc(var(--board-height-inner) / 4);

  width: var(--board-width-inner);
  height: var(--board-height-inner);
  background: #000;
  box-sizing: content-box;

  --background-row-y-offset: 20px;

  background:
    linear-gradient(
      to bottom,
      transparent calc(var(--pad-top)),
      var(--dmi-row-background) calc(var(--pad-top) + 0.00001px),
      var(--dmi-row-background) calc(var(--pad-top) + var(--row-height) - var(--background-row-y-offset)),
      transparent calc(var(--pad-top) + 0.00001px + var(--row-height) - var(--background-row-y-offset)),
      transparent calc(var(--pad-top) + var(--row-height)),
      var(--dmi-row-background) calc(var(--pad-top) + 0.00001px + var(--row-height)),
      var(--dmi-row-background) calc(var(--pad-top) + (2 * var(--row-height)) - var(--background-row-y-offset)),
      transparent calc(var(--pad-top) + 0.00001px + (2 * var(--row-height)) - var(--background-row-y-offset)),
      transparent calc(var(--pad-top) + (2 * var(--row-height))),
      var(--dmi-row-background) calc(var(--pad-top) + 0.00001px + (2 * var(--row-height))),
      var(--dmi-row-background) calc(var(--pad-top) + (3 * var(--row-height)) - var(--background-row-y-offset)),
      transparent calc(var(--pad-top) + 0.00001px + (3 * var(--row-height)) - var(--background-row-y-offset))
    ),
    var(--dmi-background);

  --pad-top: ${Y_PAD_TOP}px;
  --pad-bottom: ${Y_PAD_BOTTOM}px;
  --pad-left: ${X_PAD}px;
  --pad-right: ${X_PAD}px;
  padding: var(--pad-top) var(--pad-right) var(--pad-bottom) var(--pad-left);

  user-select: none;

  font-family: 'DataDisplay';
  color: hsl(39, 100%, 45%);
  font-size: 40px;

  position: relative;

  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  display: flex;
  flex-direction: column;
`

export default function FullBoard({ station, platforms, useLegacyTocNames, showUnconfirmedPlatforms, hasCasing, worldlinePowered }: IProps) {
  const { services, overrides, alterations } = useServiceInformation(station, platforms ?? null, !!useLegacyTocNames, showUnconfirmedPlatforms)
  const [announced, setAnnounced] = useState(alterations)
  const warning = noticeKind(overrides)

  // A stand clear warning is about a train passing this platform now, so it keeps the board. The alteration is
  // dropped rather than queued behind it: by the time the warning clears, the train it describes has long gone.
  useEffect(() => {
    if (warning) setAnnounced(alterations)
  }, [warning, alterations])

  const css = [
    base,
    hasCasing && {
      maskImage: `url(${boardFill})`,

      '--board-width': `${BOARD_WIDTH + 2 * (X_PAD_CASING - X_PAD)}px`,
      '--board-height': `${BOARD_HEIGHT + Y_PAD_TOP_CASING + Y_PAD_BOTTOM_CASING - Y_PAD_TOP - Y_PAD_BOTTOM}px`,
      '--pad-top': `${Y_PAD_TOP_CASING}px`,
      '--pad-bottom': `${Y_PAD_BOTTOM_CASING}px`,
      '--pad-left': `${X_PAD_CASING}px`,
      '--pad-right': `${X_PAD_CASING}px`,
    },
  ]

  // Leaving the board to announce an alteration unmounts the services, so they replay their entrance animation
  // afterwards and the new screen scrolls up from the bottom exactly as it does on first load.
  if (alterations !== announced && !warning) {
    return (
      <article css={css}>
        <PlatformAlterationMessage onComplete={() => setAnnounced(alterations)} />
        <Clock />
      </article>
    )
  }

  if (!services || (services.length === 0 && !warning)) {
    return (
      <article css={css}>
        <NoServicesMessage />
        <Clock />
      </article>
    )
  }

  return (
    <article css={css}>
      {warning ? (
        <PlatformWarningMessage kind={warning} />
      ) : (
        services.length > 0 && <TrainServices services={services} worldlinePowered={worldlinePowered} />
      )}
      <Clock />
    </article>
  )
}
