import React, { useState } from 'react'

import useInterval from '../../hooks/useInterval'

export default function TypewriterText({ prefix, suffix, text, component, time, cursor, className, ...props }) {
  const [currentText, setCurrentText] = useState('')

  useInterval(
    () => {
      let x = currentText
      x += text.substr(x.length, 1)
      setCurrentText(x)
    },
    time ? time / text.length : 150,
  )

  if (cursor) {
    className ? (className += ' animated-text--cursor') : (className = 'animated-text--cursor')

    if (currentText.length === text.length) {
      className += ' animated-text--cursor__blinking'
    }
  }

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
      <span className={className} {...props}>
        {currentText}
      </span>
      {suffix}
    </>
  )
}
