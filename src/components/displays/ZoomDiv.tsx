import React from 'react';

import { useEffect, useRef } from 'react';
import { debounce } from 'throttle-debounce';

function fillDiv(div: HTMLDivElement) {
  const currentWidth = div.offsetWidth;
  const currentHeight = div.offsetHeight;

  const availableHeight = window.innerHeight;
  const availableWidth = window.innerWidth;

  const scale = Math.min(availableWidth / currentWidth, availableHeight / currentHeight);

  div.style.cssText = `
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform: scale(${scale}) translateZ(0);
    transform-origin: 50% 50%;
  `;
}

export function ZoomDiv({ children }) {
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boardRef.current && requestAnimationFrame(() => fillDiv(boardRef.current!));
  });

  useEffect(() => {
    const debouncedScale = debounce(250, () => {
      if (boardRef.current) {
        fillDiv(boardRef.current);
      }
    });

    function scale() {
      debouncedScale();
    }

    window.addEventListener('resize', scale);

    return () => {
      window.removeEventListener('resize', scale);
    };
  }, [boardRef.current]);

  return (
    <div ref={boardRef} className="ZoomDivContainer">
      {children}
    </div>
  );
}
