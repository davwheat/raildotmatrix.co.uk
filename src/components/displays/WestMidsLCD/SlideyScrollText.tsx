import React, { useEffect, useRef } from 'react';

import clsx from 'clsx';

import './css/board/slideyScrollText.less';

interface IProps {
  children: React.ReactNode;
  className?: string;
  classNameInner?: string;
  pauseAtEnds?: false | number;
  scrollSpeed?: number;
  oneWayScroll?: boolean;
}

export default function SlideyScrollText({
  children,
  className,
  classNameInner,
  pauseAtEnds = 4000,
  scrollSpeed = 75,
  oneWayScroll = false,
}: IProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  const previousElContent = useRef<string>('');

  useEffect(() => {
    const { current: dest } = outerRef;
    const { current: destInner } = innerRef;

    let innerStyle = getComputedStyle(destInner!);

    let outerWidth = dest!.offsetWidth;
    let innerWidth = destInner!.offsetWidth;
    let innerWidthWithoutPadding = innerWidth - parseFloat(innerStyle.paddingLeft) - parseFloat(innerStyle.paddingRight);

    let animationStep: 'pause-left' | 'scrolling-right' | 'pause-right' | 'scrolling-left' | 'fade-out' | 'fade-in' = 'pause-left';
    let currentTimeout = -1;

    destInner!.style.removeProperty('--trans-x');
    destInner!.style.removeProperty('--transition-time');

    function updateScrollDuration() {
      const innerStyle = getComputedStyle(destInner!);

      outerWidth = dest!.clientWidth;
      innerWidth = destInner!.clientWidth;
      innerWidthWithoutPadding = innerWidth - parseFloat(innerStyle.paddingLeft) - parseFloat(innerStyle.paddingRight);

      const scrollDuration = `${(innerWidth - outerWidth) / scrollSpeed}s`;
      destInner!.style.setProperty('--transition-time', scrollDuration);
    }

    function transitionEndHandler() {
      if (animationStep === 'fade-out') {
        animationStep = 'fade-in';

        currentTimeout = setTimeout(() => {
          destInner!.style.setProperty('--trans-x', '0');
          updateScrollDuration();
          destInner!.style.setProperty('--opacity', '1');
        }, 250) as any;
      } else if (animationStep === 'fade-in') {
        animationStep = 'pause-left';

        currentTimeout = setTimeout(() => {
          animationStep = 'scrolling-right';
          updateScrollDuration();
          destInner!.style.setProperty('--trans-x', `-${innerWidth - outerWidth}px`);
        }, pauseAtEnds || 0) as any;
      } else if (animationStep === 'scrolling-right') {
        animationStep = 'pause-right';

        currentTimeout = setTimeout(() => {
          if (oneWayScroll) {
            animationStep = 'fade-out';

            destInner!.style.removeProperty('--transition-time');
            destInner!.style.setProperty('--opacity', '0');

            currentTimeout = setTimeout(() => {
              animationStep = 'scrolling-right';
              updateScrollDuration();
              destInner!.style.setProperty('--trans-x', `-${innerWidth - outerWidth}px`);
            }, pauseAtEnds || 0) as any;
            return;
          }

          animationStep = 'scrolling-left';
          updateScrollDuration();
          destInner!.style.setProperty('--trans-x', '0');
        }, pauseAtEnds || 0) as any;
      } else if (animationStep === 'scrolling-left') {
        animationStep = 'pause-left';

        currentTimeout = setTimeout(() => {
          animationStep = 'scrolling-right';
          updateScrollDuration();
          destInner!.style.setProperty('--trans-x', `-${innerWidth - outerWidth}px`);
        }, pauseAtEnds || 0) as any;
      }
    }

    if (previousElContent.current !== destInner!.innerHTML) {
      previousElContent.current = destInner!.innerHTML;

      destInner!.style.removeProperty('--trans-x');
      destInner!.style.removeProperty('--transition-time');
      animationStep = 'pause-left';
    }

    if (innerWidthWithoutPadding < outerWidth) {
      dest!.style.setProperty('--edge-fade', '0');
      // dest!.style.setProperty('--ignore-pad', '1');
      return;
    }

    if (innerWidth > outerWidth) {
      dest!.style.removeProperty('--edge-fade');
      // dest!.style.removeProperty('--ignore-pad');

      if (animationStep === 'pause-left') {
        currentTimeout = setTimeout(() => {
          animationStep = 'scrolling-right';
          updateScrollDuration();
          destInner!.style.setProperty('--trans-x', `-${innerWidth - outerWidth}px`);
        }, pauseAtEnds || 0) as any;
      }

      destInner?.addEventListener('transitionend', transitionEndHandler);
    } else {
      destInner!.style.removeProperty('--trans-x');
      destInner!.style.removeProperty('--transition-time');
    }

    return () => {
      clearTimeout(currentTimeout);
      destInner?.removeEventListener('transitionend', transitionEndHandler);
    };
  });

  return (
    <div className={clsx('slidey-scroll-text', className)} ref={outerRef}>
      <span className={clsx('slidey-scroll-text-inner', classNameInner)} ref={innerRef}>
        {children}
      </span>
    </div>
  );
}