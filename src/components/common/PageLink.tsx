import React from 'react'
import Link from 'next/link'

interface IProps {
  onClick?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void
  className?: string
  children: React.ReactNode
  to?: string
  [x: string]: unknown
}

export default function PageLink({ onClick, className, children, to, ...props }: IProps) {
  const classes = className ? 'train-link ' + className : 'train-link'

  const isExternal = to ? /^https?:\/\//.test(to) : false

  // Without a destination this stays a focusable, clickable element rather than a link, which is what the board
  // settings form relies on to present "Next" before a station has been chosen.
  if (!to || isExternal) {
    return (
      <a tabIndex={to ? undefined : 0} className={classes} onClick={onClick} {...(to ? { href: to } : {})} {...props}>
        <span>{children}</span>
      </a>
    )
  }

  return (
    <Link className={classes} onClick={onClick} href={to} {...props}>
      <span>{children}</span>
    </Link>
  )
}
