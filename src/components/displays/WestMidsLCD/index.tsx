import React, { useRef, useEffect, useCallback } from 'react'
import FullBoard from './FullBoard'
import ToggleSwitch from '../../common/form/ToggleSwitch'
import useStateWithLocalStorage from '../../../hooks/useStateWithLocalStorage'
import { debounce } from 'throttle-debounce'

import './css/index.less'
import PageLink from '../../common/PageLink'
import { ZoomDiv } from '../ZoomDiv'

const BlackboxLandscapeLcd = React.forwardRef<any, any>(({ station, editBoardCallback }, ref) => {
  let searchParams: URLSearchParams | null = null

  if (typeof window !== 'undefined') {
    searchParams = window && new URLSearchParams(window.location.search)
  }

  const [settings, setSettings] = useStateWithLocalStorage('tfwmLcdBoardSettings', {
    hideSettings: false,
  })

  const settingsRef = useRef<HTMLDivElement>(null)
  const hideRef = useRef<HTMLInputElement>(null)

  function updateState() {
    setSettings({
      hideSettings: hideRef.current?.checked || false,
    })

    if (!hideRef.current?.checked) {
      settingsRef.current?.classList.remove('hide')
    }
  }

  const updateHidden = useCallback(() => {
    settingsRef.current!.classList[settings.hideSettings ? 'add' : 'remove']('hide')
  }, [settings.hideSettings])

  const debouncedHide = debounce(1000, updateHidden)

  useEffect(() => {
    updateHidden()

    if (!settings.hideSettings) {
      return
    }

    function handler() {
      settingsRef.current?.classList.remove('hide')

      debouncedHide()
    }

    const events = ['click', 'mousemove', 'mouseover', 'mousemove', 'touchmove', 'touchstart', 'touchend', 'focus']

    events.forEach(e => window.addEventListener(e, handler))

    return () => {
      debouncedHide.cancel()
      events.forEach(e => window.removeEventListener(e, handler))
    }
  }, [settings.hideSettings])

  return (
    <>
      <div className="board-settings" ref={settingsRef}>
        {!searchParams?.get('from-railannouncements.co.uk') && (
          <>
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
          </>
        )}
        <ToggleSwitch checked={settings.hideSettings} ref={hideRef} label="Hide this panel when idle" onChange={updateState} />
      </div>
      <ZoomDiv>
        <FullBoard ref={ref} station={station} useLegacyTocNames={!!searchParams?.get('useLegacyTocNames')} />
      </ZoomDiv>
    </>
  )
})

export default BlackboxLandscapeLcd
