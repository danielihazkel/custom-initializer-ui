/**
 * What an update zip (`/starter.patch`, `/starter-fullstack.patch`) says it holds.
 *
 * Kept free of any editor import on purpose: the Backend tab reads these at first paint, and
 * importing them from `fullstack/updateBaseline` used to pull the whole layout engine
 * (`pageLayout.ts` and friends, ~125 KB) into the entry chunk.
 */
export interface UpdateCounts {
  added: number
  changed: number
  deleted: number
}

/** What the update's response headers say it holds. */
export function countsOf(headers: Headers): UpdateCounts {
  const n = (name: string) => Number.parseInt(headers.get(name) ?? '', 10) || 0
  return { added: n('X-Update-Added'), changed: n('X-Update-Changed'), deleted: n('X-Update-Deleted') }
}

export function describeCounts(c: UpdateCounts): string {
  const parts = [
    c.added ? `${c.added} added` : '',
    c.changed ? `${c.changed} changed` : '',
    c.deleted ? `${c.deleted} removed` : '',
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : 'nothing changed'
}
