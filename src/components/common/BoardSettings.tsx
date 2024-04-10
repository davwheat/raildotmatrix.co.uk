import React, { useCallback, useEffect, useRef } from 'react';
import useStateWithLocalStorage from '../../hooks/useStateWithLocalStorage';
import PageLink from './PageLink';
import { debounce } from 'throttle-debounce';
import ToggleSwitch from './form/ToggleSwitch';

interface IBoardSettingsProps {
  children: React.ReactNode;
}

export default function BoardSettings({ children, editBoardCallback }: IBoardSettingsProps) {
  let searchParams: URLSearchParams | null = null;

  if (typeof window !== 'undefined') {
    searchParams = window && new URLSearchParams(window.location.search);
  }

  const hideSettings = searchParams?.get('hideSettings');

  const [settings, setSettings] = useStateWithLocalStorage('boardSettingsRoot', {
    hideSettings: !!hideSettings,
  });

  const settingsRef = useRef<HTMLDivElement>(null);
  const hideRef = useRef<HTMLInputElement>(null);

  function updateState() {
    setSettings({
      hideSettings: !!hideRef.current?.checked,
    });

    if (!hideRef.current?.checked) {
      settingsRef.current?.classList.remove('hide');
    }
  }

  const updateHidden = useCallback(() => {
    settingsRef.current?.classList[settings.hideSettings ? 'add' : 'remove']('hide');
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
    <div className="board-settings" ref={settingsRef} css={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!searchParams?.get('from-railannouncements.co.uk') && (
        <PageLink
          style={{
            cursor: 'pointer',
            zIndex: 1000,
          }}
          to="/board"
        >
          Edit board
        </PageLink>
      )}
      <ToggleSwitch checked={settings.hideSettings} ref={hideRef} label="Hide this panel when idle" onChange={updateState} />
      {children}
    </div>
  );
}
