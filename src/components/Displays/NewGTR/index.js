import React, { useState, useRef, useEffect } from 'react'
import FullBoard from './FullBoard'
import ToggleSwitch from '../../Common/Form/ToggleSwitch'
import useStateWithLocalStorage from '../../../hooks/useStateWithLocalStorage'
import { throttle } from 'throttle-debounce'

import './css/index.css'
import PageLink from '../../Common/PageLink'

const NewGTR = React.forwardRef(({ station, editBoardCallback }, ref) => {
  const [settings, setSettings, resetSettings] = useStateWithLocalStorage('newGtrBoardSettings', {
    noBg: false,
    hideSettings: false,
  })

  const settingsRef = useRef(null)

  const noBgRef = useRef(null)
  const hideRef = useRef(null)

  function updateState() {
    setSettings({
      noBg: noBgRef.current.checked,
      hideSettings: hideRef.current.checked,
    })
  }

  useEffect(() => {
    let to = null

    function hideControls() {
      settingsRef.current.classList.add('hide')
    }

    function resetTimeout() {
      throttle(1500, () => {
        settingsRef.current.classList.remove('hide')
        clearTimeout(to)
        to = setTimeout(() => {
          hideControls()
        }, 2500)
      })
    }

    if (settings.hideSettings) {
      window.addEventListener('mousemove', resetTimeout)
    }

    return function cleanupListener() {
      window.removeEventListener('mousemove', resetTimeout)
    }
  })

  return (
    <>
      <div className="board-settings" ref={settingsRef}>
        <PageLink
          style={{
            cursor: 'pointer',
            zIndex: 1000,
          }}
          afterExit={editBoardCallback}
        >
          Edit board
        </PageLink>
        <br />
        <ToggleSwitch ref={noBgRef} label="Remove background" onChange={updateState} />
        <ToggleSwitch ref={hideRef} label="Hide this panel when idle" onChange={updateState} />
      </div>
      <FullBoard ref={ref} noBg={settings.noBg} station={station} />
    </>
  )
})

export default NewGTR
