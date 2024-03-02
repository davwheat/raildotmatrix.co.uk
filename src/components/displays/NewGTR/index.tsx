import React, { useRef, useEffect, useCallback } from 'react';
import FullBoard from './FullBoard';
import ToggleSwitch from '../../common/form/ToggleSwitch';
import useStateWithLocalStorage from '../../../hooks/useStateWithLocalStorage';
import { debounce } from 'throttle-debounce';

import './css/index.less';
import PageLink from '../../common/PageLink';
import { ZoomDiv } from '../ZoomDiv';

interface IProps {
  station: string;
  editBoardCallback: () => void;
}

const BoardColors = {
  orange: 'hsl(39, 100%, 45%)',
  white: '#efefef',
} as const;

export default function NewGTR({ station, editBoardCallback }: IProps) {
  let searchParams: URLSearchParams | null = null;

  if (typeof window !== 'undefined') {
    searchParams = window && new URLSearchParams(window.location.search);
  }

  const hideSettings = searchParams?.get('hideSettings');
  const animateClockDigits = searchParams?.get('animateClockDigits');
  const color: keyof typeof BoardColors = Object.keys(BoardColors).includes(searchParams?.get('color') || '')
    ? (searchParams!!.get('color')!! as keyof typeof BoardColors)
    : 'orange';

  const [settings, setSettings] = useStateWithLocalStorage('newGtrBoardSettings', {
    hideSettings: !!hideSettings,
    animateClockDigits: !!animateClockDigits,
    color,
  });

  const settingsRef = useRef<HTMLDivElement>(null);
  const hideRef = useRef<HTMLInputElement>(null);
  const animateClockDigitsRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef<HTMLSelectElement>(null);

  function updateState() {
    setSettings({
      hideSettings: !!hideRef.current?.checked,
      animateClockDigits: !!animateClockDigitsRef.current?.checked,
      color: colorRef.current?.value as keyof typeof BoardColors,
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

  const platforms = searchParams?.getAll('platform');

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
        <br />
        <ToggleSwitch checked={settings.animateClockDigits} ref={animateClockDigitsRef} label="Animate clock digits" onChange={updateState} />
        <br />
        <label htmlFor="color-select">Color</label>
        <select id="color-select" ref={colorRef} value={settings.color} onChange={updateState} style={{ textTransform: 'capitalize', marginLeft: 4 }}>
          {Object.entries(BoardColors).map(([color]) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
        {platforms && <p>Only showing platform(s) {platforms.join(',')}</p>}
      </div>
      <ZoomDiv>
        <div style={{ '--color': BoardColors[settings.color] } as any}>
          <FullBoard
            station={station}
            animateClockDigits={settings.animateClockDigits}
            platforms={platforms}
            useLegacyTocNames={!!searchParams?.get('useLegacyTocNames')}
          />
        </div>
      </ZoomDiv>
    </>
  );
}
