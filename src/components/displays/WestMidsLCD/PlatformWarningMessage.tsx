import React from 'react'

import type { NoticeKind } from '../../../live/overrideNotice'

const MESSAGES: Record<NoticeKind, string[]> = {
  stand_clear: ['Please stand clear of the platform edge', 'The next train is not scheduled to stop here'],
  not_for_public_use: ['Please stand clear of the platform edge', 'The next train is not for public use'],
}

export default function PlatformWarningMessage({ kind }: { kind: NoticeKind }) {
  const [warning, ...rest] = MESSAGES[kind]

  return (
    <div className="fullscreenNotice platformWarning">
      <p className="warning">{warning}</p>
      {rest.map(line => (
        <p key={line}>{line}</p>
      ))}
    </div>
  )
}
