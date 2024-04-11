import React, { useEffect, useRef } from 'react';

interface IProps {
  children: React.ReactNode;
  className?: string;
  classNameInner?: string;
  pauseWhenDone?: false | number;
  scrollSpeed?: number;
  alwaysScroll?: boolean;
  /**
   * @returns `true` if the animation should be stopped, `false` otherwise.
   */
  onComplete?: () => boolean;
  /**
   * @param willScroll `true` if the text will scroll, `false` otherwise.
   */
  onStart?: (willScroll: boolean) => void;
  /**
   * The number of milliseconds to wait before calling `onComplete` if the text is not scrolling.
   */
  callCompleteIfNotScrolling?: number;
}

function SlideyScrollText({
  children,
  className,
  classNameInner,
  pauseWhenDone = 750,
  scrollSpeed = 550,
  callCompleteIfNotScrolling = 5_000,
  onStart,
  onComplete,
  alwaysScroll = false,
}: IProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  const pauseAtEnds = 1000;

  const previousElContent = useRef<string>('');

  const animationStep = useRef<'pause-left' | 'scrolling-right' | 'pause-right'>('pause-left');

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
    let completeIfNotScrollTimeout = -1;

    inner!.style.removeProperty('--trans-x');
    inner!.style.removeProperty('--transition-time');

    function updateScrollDuration() {
      updateSizes();

      const scrollDuration = `${(innerWidth + outerWidth) / scrollSpeed}s`;
      inner!.style.setProperty('--transition-time', scrollDuration);
    }

    function transitionEndHandler() {
      if (animationStep.current === 'pause-left') {
        if (onComplete?.() ?? false) {
          return;
        } else {
          currentTimeout = setTimeout(() => {
            animationStep.current = 'scrolling-right';
            updateScrollDuration();
            inner!.style.setProperty('--trans-x', `-${innerWidth}px`);
          }, pauseWhenDone || 0) as any;
        }
      } else if (animationStep.current === 'scrolling-right') {
        animationStep.current = 'pause-right';

        currentTimeout = setTimeout(() => {
          animationStep.current = 'pause-left';

          inner!.style.setProperty('--transition-time', '0.001ms');
          inner!.style.setProperty('--trans-x', `${outerWidth}px`);
        }, pauseAtEnds || 0) as any;
      }
    }

    if (previousElContent.current !== inner!.innerHTML) {
      previousElContent.current = inner!.innerHTML;

      inner!.style.removeProperty('--trans-x');
      inner!.style.removeProperty('--transition-time');

      animationStep.current = 'pause-left';
    }

    if (alwaysScroll || innerWidth > outerWidth) {
      inner!.style.setProperty('--trans-x', `${outerWidth}px`);
      inner!.style.removeProperty('--transition-time');

      animationStep.current = 'pause-left';

      currentTimeout = setTimeout(() => {
        animationStep.current = 'scrolling-right';

        updateScrollDuration();

        inner!.style.setProperty('--trans-x', `-${innerWidth}px`);
      }, pauseAtEnds || 0) as any;

      inner?.addEventListener('transitionend', transitionEndHandler);
    } else {
      inner!.style.removeProperty('--transition-time');
      inner!.style.setProperty('--trans-x', '0');

      completeIfNotScrollTimeout = setTimeout(() => onComplete?.(), callCompleteIfNotScrolling || 0) as any;
    }

    onStart?.(alwaysScroll || innerWidth > outerWidth);

    return () => {
      clearTimeout(currentTimeout);
      clearTimeout(completeIfNotScrollTimeout);
      inner?.removeEventListener('transitionend', transitionEndHandler);
    };
  }, [callCompleteIfNotScrolling, onStart, onComplete, previousElContent, pauseAtEnds, pauseWhenDone, scrollSpeed, alwaysScroll]);

  return (
    <div
      className={className}
      ref={outerRef}
      css={{
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        className={classNameInner}
        ref={innerRef}
        css={{
          '--trans-x': '100%',
          '--opacity': 1,

          display: 'block',
          width: 'max-content',
          opacity: 'var(--opacity)',
          transform: 'translateX(var(--trans-x))',
          transition: 'transform linear var(--transition-time, 0s), opacity linear 0.5s',
        }}
      >
        {children}
      </span>
    </div>
  );
}

export default React.memo(SlideyScrollText);
