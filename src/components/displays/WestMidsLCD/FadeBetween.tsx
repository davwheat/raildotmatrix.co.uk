import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';

import './css/board/fadeBetween.less';

interface IProps {
  elements: React.ReactNode[];
  secondsPerEl?: number;
}

export default function FadeBetween({ elements, secondsPerEl = 5 }: IProps) {
  const shownIndex = useRef<number>(-1);
  const optionContainer = useRef<HTMLDivElement>(null);

  if (!elements.length) {
    shownIndex.current = -1;
  } else if (shownIndex.current === -1) {
    shownIndex.current = 0;
  }

  if (shownIndex.current > elements.length) {
    shownIndex.current = 0;
  }

  useEffect(() => {
    if (shownIndex.current === -1) return;

    let key: number;

    function switchToNextElement() {
      let nextIndex = shownIndex.current + 1;
      if (nextIndex >= elements.length) nextIndex = 0;

      const shownEl = optionContainer.current?.children[shownIndex.current];
      const nextEl = optionContainer.current?.children[nextIndex];

      shownIndex.current = nextIndex;

      shownEl?.classList.remove('in');
      shownEl?.classList.add('out');

      key = setTimeout(() => {
        nextEl?.classList.remove('out');
        nextEl?.classList.add('in');

        key = setTimeout(switchToNextElement, secondsPerEl * 1000 + 0.5) as any;
      }, 500) as any;
    }

    key = setTimeout(switchToNextElement, secondsPerEl * 1000) as any;

    return () => {
      clearTimeout(key);
    };
  });

  return (
    <div className="fadeBetween" ref={optionContainer}>
      {elements.map((element, index) => (
        <div className={clsx('textOption', index === shownIndex.current ? 'in' : 'out')} key={index}>
          {element}
        </div>
      ))}
    </div>
  );
}
