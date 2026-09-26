import { useEffect, useMemo, useState } from 'react'

/** Update at the displayed precision, aligned to wall-clock boundaries. */
export default function useClock(resolution: 1000 | 60000) {
  const [time, setTime] = useState(() => Math.floor(Date.now() / resolution) * resolution)

  useEffect(() => {
    let timer: number | undefined
    const refresh = () => {
      window.clearTimeout(timer)
      if (document.hidden) return
      const now = Date.now()
      setTime(Math.floor(now / resolution) * resolution)
      timer = window.setTimeout(refresh, resolution - (now % resolution))
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [resolution])

  return useMemo(() => new Date(time), [time])
}
