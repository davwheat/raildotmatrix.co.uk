import React, { useEffect, useRef } from 'react';

// const DEBUG_DELAY = 10_000;
const DEBUG_DELAY = 0;

interface IProps {
  children: React.ReactNode;
  className?: string;
  classNameInner?: string;
  pauseWhenDone?: false | number;
  /**
   * The speed at which the text should scroll in pixels per second.
   */
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
  /**
   * The text to prefix to the text and to slide down before scrolling.
   */
  slideDownText?: string;
  /**
   * The number of milliseconds to pause after sliding down the text.
   */
  slideDownPause?: number;
  /**
   * The number of milliseconds the slide down animation should take.
   */
  slideDownTime?: number;
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
  slideDownText = undefined,
  slideDownPause = 1_500,
  slideDownTime = 400,
}: IProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const slideDownRef = useRef<HTMLSpanElement>(null);

  const pauseAtEnds = 1000;

  const previousElContent = useRef<string>('');

  const animationStep = useRef<'pause-left' | 'scrolling' | 'pause-right' | 'slide-down'>('pause-left');

  console.log('Rendering SlideyScrollText');

  useEffect(() => {
    const { current: outer } = outerRef;
    const { current: inner } = innerRef;
    const { current: slideDown } = slideDownRef;

    let outerStyles!: CSSStyleDeclaration;
    let innerStyles!: CSSStyleDeclaration;
    let slideDownStyles: CSSStyleDeclaration | null;

    let outerWidth!: number;
    let innerWidth!: number;
    let slideDownWidth: number = 0;

    function updateSizes() {
      outerStyles = getComputedStyle(outer!);
      innerStyles = getComputedStyle(inner!);
      slideDownStyles = slideDown && getComputedStyle(slideDown);

      outerWidth = parseFloat(outerStyles.width);
      innerWidth = parseFloat(innerStyles.width);
      slideDownWidth = slideDown && slideDownStyles ? parseFloat(slideDownStyles.width) : 0;
    }

    updateSizes();

    let currentTimeout = -1;
    let completeIfNotScrollTimeout = -1;

    inner!.style.removeProperty('--trans-y');
    inner!.style.removeProperty('--trans-x');
    inner!.style.removeProperty('--transition-time');

    function startScroll() {
      animationStep.current = 'scrolling';
      updateScrollDuration();
      inner!.style.setProperty('--trans-x', `-${innerWidth}px`);
    }

    function startScrollOrSlideDown() {
      if (slideDown) {
        startSlideDown();
      } else {
        startScroll();
      }
    }

    function setUpSlideDown() {
      if (!slideDown) return;

      console.log('Sliding down setup');
      inner!.style.setProperty('--trans-y', '-100%');
      inner!.style.setProperty('--trans-x', `${outerWidth - slideDownWidth}px`);
      inner!.style.setProperty('--transition-time', '0.0001ms');
      inner!.style.setProperty('--opacity', '1');
    }

    function startSlideDown() {
      console.log('Starting slide down');

      animationStep.current = 'slide-down';

      () => {
        // Force reflow
        const _ = slideDown?.offsetLeft;
      };

      setTimeout(() => {
        console.log('Sliding down');
        inner!.style.setProperty('--trans-y', '0');
        inner!.style.setProperty('--transition-time', `${slideDownTime}ms`);
      }, DEBUG_DELAY);
    }

    function updateScrollDuration() {
      updateSizes();
      const scrollDuration = `${(innerWidth + outerWidth - slideDownWidth) / scrollSpeed}s`;
      inner!.style.setProperty('--transition-time', scrollDuration);
    }

    function transitionEndHandler() {
      console.log('** transitionEndHandler');

      if (animationStep.current === 'pause-left') {
        console.log('Pause left complete');

        if (onComplete?.() ?? false) {
          return;
        } else {
          currentTimeout = window.setTimeout(startScrollOrSlideDown, (pauseWhenDone || 0) + DEBUG_DELAY);
        }
      } else if (animationStep.current === 'scrolling') {
        console.log('Scrolling complete');

        animationStep.current = 'pause-right';

        currentTimeout = window.setTimeout(
          () => {
            animationStep.current = 'pause-left';

            inner!.style.setProperty('--transition-time', '0.001ms');
            inner!.style.setProperty('--trans-x', `${outerWidth}px`);

            setUpSlideDown();
          },
          (pauseAtEnds || 0) + DEBUG_DELAY
        );
      } else if (animationStep.current === 'slide-down') {
        console.log('Slide down complete');

        currentTimeout = window.setTimeout(startScroll, (slideDownPause || 0) + DEBUG_DELAY);
      }
    }

    console.log('SlideyScrollText effect');

    if (previousElContent.current !== inner!.innerHTML) {
      previousElContent.current = inner!.innerHTML;

      inner!.style.removeProperty('--trans-x');
      inner!.style.removeProperty('--transition-time');

      animationStep.current = 'pause-left';
    }

    if (alwaysScroll || innerWidth > outerWidth) {
      console.log('Starting first scroll');

      inner!.style.setProperty('--trans-x', `${outerWidth}px`);
      setUpSlideDown();

      inner!.style.removeProperty('--transition-time');

      animationStep.current = 'pause-left';

      currentTimeout = window.setTimeout(startScrollOrSlideDown, (pauseAtEnds || 0) + DEBUG_DELAY);

      inner?.addEventListener('transitionend', transitionEndHandler);
    } else {
      inner!.style.removeProperty('--transition-time');
      inner!.style.setProperty('--trans-x', '0');

      completeIfNotScrollTimeout = window.setTimeout(() => onComplete?.(), (callCompleteIfNotScrolling || 0) + DEBUG_DELAY);
    }

    onStart?.(alwaysScroll || innerWidth > outerWidth);

    return () => {
      clearTimeout(currentTimeout);
      clearTimeout(completeIfNotScrollTimeout);
      inner?.removeEventListener('transitionend', transitionEndHandler);
    };
  }, [
    callCompleteIfNotScrolling,
    onStart,
    onComplete,
    previousElContent,
    pauseAtEnds,
    pauseWhenDone,
    scrollSpeed,
    alwaysScroll,
    slideDownText,
    slideDownPause,
  ]);

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
          '--trans-y': '0',

          display: 'block',
          width: 'max-content',
          opacity: 'var(--opacity)',
          transform: 'translate(var(--trans-x), var(--trans-y))',
          transition: 'transform linear var(--transition-time, 0s), opacity linear 0.5s',
        }}
      >
        {slideDownText && (
          <span
            ref={slideDownRef}
            css={{
              display: 'inline-block',
              width: 'max-content',
              whiteSpace: 'preserve',
            }}
          >
            {slideDownText}
          </span>
        )}
        {children}
      </span>
    </div>
  );
}

export default React.memo(SlideyScrollText);
