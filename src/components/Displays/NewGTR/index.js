import React, { useRef, useEffect } from 'react'
import FullBoard from './FullBoard'
import ToggleSwitch from '../../Common/Form/ToggleSwitch'
import useStateWithLocalStorage from '../../../hooks/useStateWithLocalStorage'
import { throttle } from 'throttle-debounce'

import './css/index.css'
import PageLink from '../../Common/PageLink'

const NewGTR = React.forwardRef(({ station, editBoardCallback }, ref) => {
  const [settings, setSettings] = useStateWithLocalStorage('newGtrBoardSettings', {
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

    const throttledReset = throttle(1500, true, () => {
      console.log('Reset')

      settingsRef.current.classList.remove('hide')
      clearTimeout(to)
      to = setTimeout(() => {
        hideControls()
      }, 2500)
    })

    function resetTimeout(e) {
      throttledReset(e)
    }

    const events = ['click', 'mousemove', 'mouseover', 'mousemove', 'touchmove', 'touchstart', 'touchend', 'focus']

    if (settings.hideSettings) {
      events.forEach(e => {
        console.log(e)

        window.addEventListener(e, resetTimeout)
      })
    }

    return function cleanupListener() {
      events.forEach(e => {
        window.removeEventListener(e, resetTimeout)
      })
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
