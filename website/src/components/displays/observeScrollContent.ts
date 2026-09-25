type Widths = { outer: number; inner: number; prefix: number }

/** Remeasure only when content or geometry changes, never at each animation phase. */
export function observeScrollContent(outer: HTMLElement, inner: HTMLElement, prefix: HTMLElement | null, restart: (widths: Widths) => void) {
  let previous: Widths | undefined
  let contentChanged = true
  let pending = 0
  const measure = () => {
    pending = 0
    const widths = {
      outer: parseFloat(getComputedStyle(outer).width),
      inner: parseFloat(getComputedStyle(inner).width),
      prefix: prefix ? parseFloat(getComputedStyle(prefix).width) : 0,
    }
    if (contentChanged || !previous || widths.outer !== previous.outer || widths.inner !== previous.inner || widths.prefix !== previous.prefix) {
      previous = widths
      contentChanged = false
      restart(widths)
    }
  }
  const schedule = () => {
    if (!pending) pending = requestAnimationFrame(measure)
  }
  const resize = new ResizeObserver(schedule)
  resize.observe(outer)
  resize.observe(inner)
  if (prefix) resize.observe(prefix)
  const content = new MutationObserver(() => {
    contentChanged = true
    schedule()
  })
  content.observe(inner, { childList: true, characterData: true, subtree: true })
  measure()
  return () => {
    resize.disconnect()
    content.disconnect()
    cancelAnimationFrame(pending)
  }
}
