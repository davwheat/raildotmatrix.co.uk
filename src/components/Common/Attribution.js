import React from 'react'

import NRE from '../../images/NRE_Powered_logo.png'

import './css/attribution.css'

export default function Attribution() {
  return (
    <footer>
      <a href="https://www.nationalrail.co.uk/" target="_blank" rel="noopener noreferer">
        <img src={NRE} alt="Powered by National Rail Enquiries" />
      </a>
    </footer>
  )
}
