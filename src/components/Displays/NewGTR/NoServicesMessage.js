import React from 'react'
import NRCCMessages from './NRCCMessage'

export default function NoServicesMessage({ messages }) {
  return (
    <>
      <p className="display--no-services">
        <span>There are no upcoming services from this station.</span>
      </p>
      <p className="display--no-services">
        <span>.&nbsp;&nbsp;.&nbsp;&nbsp;.</span>
      </p>
      <NRCCMessages messages={messages} />
    </>
  )
}
