import React from 'react'

import type { NoticeKind } from '../../../live/overrideNotice'

const MESSAGES: Record<NoticeKind, string[]> = {
  stand_clear: ['PLEASE STAND CLEAR', 'The next train is not scheduled', 'to call at this station'],
  not_for_public_use: ['PLEASE STAND CLEAR', 'The next train is not', 'for public use'],
}

export default function PlatformWarningMessage({ kind }: { kind: NoticeKind }) {
  return (
    <>
      {MESSAGES[kind].map(line => (
        <div key={line} css={{ height: 'var(--row-height)', lineHeight: 'var(--row-height)', textAlign: 'center' }}>
          {line}
        </div>
      ))}
    </>
  )
}
