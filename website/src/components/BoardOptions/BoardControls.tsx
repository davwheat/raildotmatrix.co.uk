import React, { useId, useRef } from 'react'
import Link from 'next/link'
import BoardOptions from '.'
import { useBoardOptions } from './context'
import { applyOptions, isRailAnnouncementsEmbed } from './settings'
import styles from './options.module.scss'

export default function BoardControls({ editBoardUrl }: { editBoardUrl: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { type, options } = useBoardOptions()
  const embedded = isRailAnnouncementsEmbed(window.self !== window.top, new URLSearchParams(window.location.search), document.referrer)
  const editUrl = new URL(editBoardUrl, window.location.origin)
  applyOptions(editUrl.searchParams, type, options)

  if (!embedded)
    return (
      <Link className={styles.launcher} href={editUrl.pathname + editUrl.search}>
        Edit board
      </Link>
    )
  return (
    <>
      <button type="button" className={styles.launcher} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        Settings
      </button>
      <dialog ref={dialog} aria-labelledby={titleId} className={styles.dialog}>
        <form method="dialog">
          <div className={styles.dialogHeading}>
            <h2 id={titleId}>Board settings</h2>
            <button type="submit" aria-label="Close settings" className={styles.close}>
              ×
            </button>
          </div>
          <BoardOptions />
          <div className={styles.dialogActions}>
            <span>Changes apply immediately.</span>
            <button type="submit" className={styles.primary}>
              Done
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
