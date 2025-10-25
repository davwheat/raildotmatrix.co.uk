import React, { useState } from 'react'
import { Link, navigate } from 'gatsby'

interface IProps {
  onClick?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => boolean
  className?: string
  children: React.ReactNode
  to?: string
  [x: string]: unknown
}

export default function PageLink({ onClick, className, children, to, ...props }: IProps) {
  let classes = ''

  if (className) {
    classes = 'train-link ' + className
  } else {
    classes = 'train-link'
  }

  const isExternal = to ? /^https?:\/\//.test(to) : false

  const LinkComponent = isExternal ? 'a' : Link

  const attrs = {
    ...(isExternal ? { href: to } : { to }),
  }

  return (
    <LinkComponent tabIndex={to ? undefined : 0} className={classes} onClick={onClick} {...attrs} {...props}>
      <span>{children}</span>
    </LinkComponent>
  )
}
