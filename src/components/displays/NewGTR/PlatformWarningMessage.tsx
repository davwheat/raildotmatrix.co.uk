import React from 'react'

import type { NoticeKind } from '../../../live/overrideNotice'

const MESSAGES: Record<NoticeKind, string[]> = {
  stand_clear: ['* PLEASE STAND CLEAR *', 'OF THE PLATFORM EDGE', 'THE NEXT TRAIN MAY NOT STOP HERE'],
  not_for_public_use: ['* PLEASE STAND CLEAR *', 'OF THE PLATFORM EDGE', 'THE NEXT TRAIN IS NOT FOR PUBLIC USE'],
}

export default function PlatformWarningMessage({ kind }: { kind: NoticeKind }) {
  return (
    <div className="main platform-warning">
      {MESSAGES[kind].map(line => (
        <div className="row" key={line}>
          {line}
        </div>
      ))}
    </div>
  )
}
