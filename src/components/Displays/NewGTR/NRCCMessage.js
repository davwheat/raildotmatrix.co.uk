import React from "react"

export default function NRCCMessages({ messages }) {
  console.log(messages)

  return (
    <p className="display--no-services nrccMsgs">
      <span>
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
