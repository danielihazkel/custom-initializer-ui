import { focusWithoutClipping } from './scroll'

/**
 * Focus helper for freshly added editor rows. Entities, fields and relations are appended at
 * the bottom of a (possibly long) list; without this the user has to find the new row and click
 * into it. Rows expose their uid as `data-row-uid`; the first text control inside is focused once
 * React has committed the new row (two frames covers a Suspense/lazy boundary too).
 */
export function focusRowWhenRendered(uid: string | undefined): void {
  focusWithinRow(uid, 'input:not([type="checkbox"]):not([disabled]), select, textarea')
}

/** Focuses the first element matching `selector` inside the row with `uid`, once it exists —
 *  e.g. the SELECT-query textarea that appears when "SELECT view" is ticked. The focus never
 *  scrolls an ancestor (see scroll.ts); the window is scrolled just enough to show the control. */
export function focusWithinRow(uid: string | undefined, selector: string): void {
  if (!uid || typeof document === 'undefined') return
  const attempt = (triesLeft: number) => {
    const row = document.querySelector<HTMLElement>(`[data-row-uid="${cssEscape(uid)}"]`)
    const control = row?.querySelector<HTMLElement>(selector)
    if (control) {
      focusWithoutClipping(control, 'nearest')
      return
    }
    if (triesLeft > 0) requestAnimationFrame(() => attempt(triesLeft - 1))
  }
  requestAnimationFrame(() => attempt(2))
}

/** `CSS.escape` with a fallback for environments without it (jsdom) — uids are UUIDs, so only
 *  quotes and backslashes could ever need escaping. */
export function cssEscape(s: string): string {
  const css = (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS
  return css?.escape ? css.escape(s) : s.replace(/["\\]/g, '\\$&')
}
