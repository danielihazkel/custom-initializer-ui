/**
 * Focus helper for freshly added editor rows. Entities, fields and relations are appended at
 * the bottom of a (possibly long) list; without this the user has to find the new row and click
 * into it. Rows expose their uid as `data-row-uid`; the first text control inside is focused once
 * React has committed the new row (two frames covers a Suspense/lazy boundary too).
 */
export function focusRowWhenRendered(uid: string | undefined): void {
  if (!uid || typeof document === 'undefined') return
  const attempt = (triesLeft: number) => {
    const row = document.querySelector<HTMLElement>(`[data-row-uid="${CSS.escape(uid)}"]`)
    const control = row?.querySelector<HTMLElement>('input:not([type="checkbox"]):not([disabled]), select, textarea')
    if (control) {
      row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      control.focus()
      return
    }
    if (triesLeft > 0) requestAnimationFrame(() => attempt(triesLeft - 1))
  }
  requestAnimationFrame(() => attempt(2))
}
