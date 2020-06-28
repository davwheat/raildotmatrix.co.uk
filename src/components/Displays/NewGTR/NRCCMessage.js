import React, { useRef, useState } from "react"

export default function NRCCMessages({ messages }) {
  const nrccMessages = useRef(null)
  const [scrollTime, setScrollTime] = useState(0)

  function getScrollTime(nrccMessages) {
    return Math.ceil((nrccMessages.current.offsetWidth + window.innerWidth) / 525)
  }

  if (nrccMessages.current && scrollTime !== getScrollTime(nrccMessages))
    setScrollTime(getScrollTime(nrccMessages))

  return (
    <p className="display--no-services nrccMsgs">
      <span ref={nrccMessages} style={{ animationDuration: scrollTime + "s" }}>
        {messages
          ? messages.map(data => (
              <p
                className="nrccMsg"
                dangerouslySetInnerHTML={{ __html: data.message }}
              />
            ))
          : `. . .`}
      </span>
    </p>
  )
}
