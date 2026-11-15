import { useEffect } from 'react'

/**
 * "The factory is working": while any generation or preview request is in flight, `<html>` carries
 * `data-busy`, and `index.css` runs the header's conveyor belt and gears under it. They stand
 * still the rest of the time — a page that animates while idle keeps the CPU busy for nothing.
 *
 * Counted, so two requests at once (a preview and a generate) end the motion together.
 */
let busy = 0

function markBusy(): () => void {
  if (busy++ === 0) document.documentElement.setAttribute('data-busy', '')
  return () => {
    if (--busy === 0) document.documentElement.removeAttribute('data-busy')
  }
}

/** Marks the app busy for as long as `active` is true. */
export function useBusy(active: boolean): void {
  useEffect(() => {
    if (!active) return
    return markBusy()
  }, [active])
}
