import React from "react"

import NRE from "../../images/NRE_Powered_logo.png"

import "./css/attribution.css"
import PageLink from "./PageLink"

import MediaQuery from "react-responsive"

export default function Attribution() {
  return (
    <>
      <MediaQuery maxDeviceWidth={1500}></MediaQuery>

      <footer>
        <div className="attribution--left">
          <p>
            A fun project by{" "}
            <PageLink to="https://github.com/davwheat">David Wheatley</PageLink>
          </p>
        </div>
        <a
          href="https://www.nationalrail.co.uk/"
          target="_blank"
          rel="noopener noreferer"
        >
          <img src={NRE} alt="Powered by National Rail Enquiries" />
        </a>
      </footer>
      <p className="attribution--required-minimum">
        Powered by National Rail Enquiries
      </p>
    </>
  )
}
