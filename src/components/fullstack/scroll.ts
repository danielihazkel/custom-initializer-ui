/**
 * Page-scroll helpers for the editor's "jump to" actions (section nav, first error, outline
 * rows, lint "Show", new-row focus).
 *
 * Why not `element.scrollIntoView()`: it scrolls *every* scrollable ancestor. An
 * `overflow: hidden` box is still programmatically scrollable, so `scrollIntoView` — and a plain
 * `focus()` — can shift the content inside it instead of / as well as scrolling the window. The
 * wheel can never undo that inner offset, which is the "page is stuck, can't scroll back to the
 * top" bug. These helpers scroll the window only and put any clipped ancestor back to 0.
 *
 * The app's `<main>` used to be the offender; it is `overflow: clip` now (App.tsx), which still
 * clips the decorative background but creates no scroll container — that is also what lets this
 * tab's sticky layers pin to the viewport at all. `resetClippedAncestors` stays as the guard for
 * any other clipped ancestor a panel may sit inside.
 */

/** The fixed app header (h-16) plus the sticky workspace toolbar the editor pins beneath it. */
export const SCROLL_TOP_OFFSET = 120

export type ScrollBlock = 'start' | 'center' | 'nearest'

/** Scrolls the window so `el` sits at the top (`start`), the middle (`center`) or just into
 *  view (`nearest`), never touching an overflow-hidden ancestor. */
export function scrollToElement(el: Element | null | undefined, block: ScrollBlock = 'start', behavior: ScrollBehavior = 'smooth'): void {
  if (!el || typeof window === 'undefined') return
  resetClippedAncestors(el)
  const rect = el.getBoundingClientRect()
  const viewport = window.innerHeight
  let target: number
  if (block === 'center') {
    target = window.scrollY + rect.top - (viewport - rect.height) / 2
  } else if (block === 'nearest') {
    if (rect.top >= SCROLL_TOP_OFFSET && rect.bottom <= viewport) return
    target = rect.top < SCROLL_TOP_OFFSET
      ? window.scrollY + rect.top - SCROLL_TOP_OFFSET
      : window.scrollY + rect.bottom - viewport + 16
  } else {
    target = window.scrollY + rect.top - SCROLL_TOP_OFFSET
  }
  try {
    window.scrollTo({ top: Math.max(0, Math.round(target)), behavior })
  } catch {
    /* jsdom / very old browsers: no smooth scrolling — nothing to recover */
  }
}

/** Focuses `el` without letting the browser scroll its ancestors, then brings it into view via
 *  the window only. */
export function focusWithoutClipping(el: HTMLElement, block: ScrollBlock = 'nearest'): void {
  try {
    el.focus({ preventScroll: true })
  } catch {
    el.focus()
  }
  scrollToElement(el, block)
}

/** Any `overflow: hidden` ancestor that has been scrolled (by an earlier `scrollIntoView` or
 *  `focus()`) is put back to 0 — the user has no way to do that themselves. */
export function resetClippedAncestors(el: Element): void {
  if (typeof getComputedStyle !== 'function') return
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (p.scrollTop === 0 && p.scrollLeft === 0) continue
    const style = getComputedStyle(p)
    if (style.overflowY === 'hidden' || style.overflow === 'hidden') p.scrollTop = 0
    if (style.overflowX === 'hidden' || style.overflow === 'hidden') p.scrollLeft = 0
  }
}
