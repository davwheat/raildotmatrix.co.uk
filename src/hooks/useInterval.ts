import { useEffect, useRef } from 'react';

export default function useInterval(callback: () => void, delay: number) {
  const savedCallback = useRef<() => void>();

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current?.();
    }

    let id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}
