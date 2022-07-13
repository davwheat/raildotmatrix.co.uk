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

function SlideyScrollText({ children, className, classNameInner, pauseAtEnds = 4000, scrollSpeed = 75, oneWayScroll = false }: IProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  const previousElContent = useRef<string>('');

  const animationStep = useRef<'pause-left' | 'scrolling-right' | 'pause-right' | 'scrolling-left' | 'fade-out' | 'fade-in'>('pause-left');

  useEffect(() => {
    const { current: outer } = outerRef;
    const { current: inner } = innerRef;

    let outerStyles!: CSSStyleDeclaration;
    let innerStyles!: CSSStyleDeclaration;

    let outerWidth!: number;
    let innerWidth!: number;

    function updateSizes() {
      outerStyles = getComputedStyle(outer!);
      innerStyles = getComputedStyle(inner!);

      outerWidth = parseFloat(outerStyles.width);
      innerWidth = parseFloat(innerStyles.width);
    }

    updateSizes();

    let currentTimeout = -1;

    inner!.style.removeProperty('--trans-x');
    inner!.style.removeProperty('--transition-time');

    function updateScrollDuration() {
      updateSizes();

      const scrollDuration = `${(innerWidth - outerWidth) / scrollSpeed}s`;
      inner!.style.setProperty('--transition-time', scrollDuration);
    }

    function setScrollingProps() {
      let showLeft = false;
      let showRight = false;

      switch (animationStep.current) {
        case 'fade-in':
        case 'pause-left':
          showRight = true;
          break;

        case 'scrolling-left':
        case 'scrolling-right':
          showLeft = true;
          showRight = true;
          break;

        case 'fade-out':
        case 'pause-right':
          showLeft = true;
          break;
      }

      outer!.style.setProperty('--show-fade-left', showLeft ? '1' : '0');
      outer!.style.setProperty('--show-fade-right', showRight ? '1' : '0');
    }

    function transitionEndHandler() {
      if (animationStep.current === 'fade-out') {
        animationStep.current = 'fade-in';

        setScrollingProps();

        currentTimeout = setTimeout(() => {
          inner!.style.setProperty('--trans-x', '0');
          updateScrollDuration();
          inner!.style.setProperty('--opacity', '1');
        }, 250) as any;
      } else if (animationStep.current === 'fade-in') {
        animationStep.current = 'pause-left';

        setScrollingProps();

        currentTimeout = setTimeout(() => {
          animationStep.current = 'scrolling-right';
          updateScrollDuration();
          inner!.style.setProperty('--trans-x', `-${innerWidth - outerWidth}px`);
        }, pauseAtEnds || 0) as any;
      } else if (animationStep.current === 'scrolling-right') {
        animationStep.current = 'pause-right';

        setScrollingProps();

        currentTimeout = setTimeout(() => {
          if (oneWayScroll) {
            animationStep.current = 'fade-out';

            inner!.style.removeProperty('--transition-time');
            inner!.style.setProperty('--opacity', '0');

            currentTimeout = setTimeout(() => {
              animationStep.current = 'scrolling-right';

              setScrollingProps();
              updateScrollDuration();

              inner!.style.setProperty('--trans-x', `-${innerWidth - outerWidth}px`);
            }, pauseAtEnds || 0) as any;
            return;
          }

          animationStep.current = 'scrolling-left';

          setScrollingProps();
          updateScrollDuration();

          inner!.style.setProperty('--trans-x', '0');
        }, pauseAtEnds || 0) as any;
      } else if (animationStep.current === 'scrolling-left') {
        animationStep.current = 'pause-left';

        outer!.style.setProperty('--scrolled', '0');
        currentTimeout = setTimeout(() => {
          animationStep.current = 'scrolling-right';

          setScrollingProps();
          updateScrollDuration();

          inner!.style.setProperty('--trans-x', `-${innerWidth - outerWidth}px`);
        }, pauseAtEnds || 0) as any;
      }
    }

    if (previousElContent.current !== inner!.innerHTML) {
      previousElContent.current = inner!.innerHTML;

      outer!.style.removeProperty('--edge-fade');
      inner!.style.removeProperty('--trans-x');
      inner!.style.removeProperty('--transition-time');
      inner!.style.removeProperty('--opacity');
      outer!.style.removeProperty('--show-fade-left');
      outer!.style.removeProperty('--show-fade-right');

      animationStep.current = 'pause-left';
    }

    if (innerWidth > outerWidth) {
      outer!.style.removeProperty('--edge-fade');
      inner!.style.removeProperty('--trans-x');
      inner!.style.removeProperty('--transition-time');
      inner!.style.removeProperty('--opacity');
      outer!.style.removeProperty('--show-fade-left');
      outer!.style.removeProperty('--show-fade-right');

      console.log('reset');

      animationStep.current = 'pause-left';

      currentTimeout = setTimeout(() => {
        animationStep.current = 'scrolling-right';

        setScrollingProps();
        updateScrollDuration();

        inner!.style.setProperty('--trans-x', `-${innerWidth - outerWidth}px`);
      }, pauseAtEnds || 0) as any;

      inner?.addEventListener('transitionend', transitionEndHandler);
    } else {
      outer!.style.removeProperty('--edge-fade');
      inner!.style.removeProperty('--trans-x');
      inner!.style.removeProperty('--transition-time');
      inner!.style.removeProperty('--opacity');
      outer!.style.removeProperty('--show-fade-left');
      outer!.style.removeProperty('--show-fade-right');
    }

    return () => {
      clearTimeout(currentTimeout);
      inner?.removeEventListener('transitionend', transitionEndHandler);
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

export default React.memo(SlideyScrollText);
