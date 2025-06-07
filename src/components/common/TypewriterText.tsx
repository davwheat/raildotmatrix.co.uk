import clsx from 'clsx'
import React, { useState } from 'react'

import useInterval from '../../hooks/useInterval'

interface IProps extends Record<string, unknown> {
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  text: string
  component?: string
  /**
   * Milliseconds to take to show the **whole** text.
   *
   * Not providing this will show a char every 150ms.
   */
  time?: number
  /**
   * Whether to show a blinking cursor after the text.
   */
  cursor?: boolean
  className?: string
}

export default function TypewriterText({ prefix, suffix, text, component, time, cursor = false, className, ...props }: IProps) {
  const [currentText, setCurrentText] = useState<string>('')

  useInterval(
    () => {
      let x = currentText
      x += text.substring(x.length, x.length + 1)
      setCurrentText(x)
    },
    time ? time / text.length : 150,
  )

  const classNameText = clsx(className, {
    'animated-text--cursor': cursor,
    'animated-text--cursor__blinking': currentText.length === text.length,
  })

  return component ? (
    React.createElement(component, {
      children: (
        <>
          <span className="animated-text--prefix">{prefix}</span>
          <span className="animated-text--content">{currentText}</span>
          <span className="animated-text--suffix">{suffix}</span>
        </>
      ),
      className: className,
      ...props,
    })
  ) : (
    <>
      {prefix}
      <span className={classNameText} {...props}>
        {currentText}
      </span>
      {suffix}
    </>
  )
}
