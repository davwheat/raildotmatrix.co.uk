import React from 'react'

import NRE from '../../images/NRE_Powered_logo.png'

import './css/attribution.css'
import PageLink from './PageLink'

export default function Attribution() {
  return (
    <>
      <footer>
        <div className="attribution--left">
          <p>
            A fun project by <PageLink to="https://github.com/davwheat">David Wheatley</PageLink>
          </p>
        </div>
        <a href="https://www.nationalrail.co.uk/" target="_blank" rel="noopener noreferrer">
          <img src={NRE} alt="Powered by National Rail Enquiries" />
        </a>
      </footer>
      <p className="attribution--required-minimum">Powered by National Rail Enquiries</p>
    </>
  )
}
