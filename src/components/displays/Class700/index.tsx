import React, { useRef, useEffect, useCallback } from 'react';
import ScreenBase from './ScreenBase';
import ToggleSwitch from '../../common/form/ToggleSwitch';
import useStateWithLocalStorage from '../../../hooks/useStateWithLocalStorage';
import { debounce } from 'throttle-debounce';

import './css/index.less';
import PageLink from '../../common/PageLink';
import NoSSR from '@mpth/react-no-ssr';
import { ZoomDiv } from '../ZoomDiv';

const Class700PIS = React.forwardRef<any, any>(({ station, editBoardCallback }, ref) => {
  const [settings, setSettings] = useStateWithLocalStorage('class700LcdBoardSettings', {
    hideSettings: false,
  });

  const settingsRef = useRef<HTMLDivElement>(null);
  const hideRef = useRef<HTMLInputElement>(null);

  function updateState() {
    setSettings({
      hideSettings: hideRef.current?.checked,
    });

    if (!hideRef.current?.checked) {
      settingsRef.current?.classList.remove('hide');
    }
  }

  const updateHidden = useCallback(() => {
    settingsRef.current!.classList[settings.hideSettings ? 'add' : 'remove']('hide');
  }, [settings.hideSettings]);

  const debouncedHide = debounce(1000, updateHidden);

  useEffect(() => {
    updateHidden();

    if (!settings.hideSettings) {
      return;
    }

    function handler() {
      settingsRef.current?.classList.remove('hide');

      debouncedHide();
    }

    const events = ['click', 'mousemove', 'mouseover', 'mousemove', 'touchmove', 'touchstart', 'touchend', 'focus'];

    events.forEach((e) => window.addEventListener(e, handler));

    return () => {
      debouncedHide.cancel();
      events.forEach((e) => window.removeEventListener(e, handler));
    };
  }, [settings.hideSettings]);

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
        <ToggleSwitch checked={settings.hideSettings} ref={hideRef} label="Hide this panel when idle" onChange={updateState} />
      </div>

      <NoSSR>
        <ZoomDiv>
          <ScreenBase ref={ref} />
        </ZoomDiv>
      </NoSSR>
    </>
  );
});

export default Class700PIS;
