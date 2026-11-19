/**
 * What an update zip (`/starter.patch`, `/starter-fullstack.patch`) says it holds.
 *
 * Kept free of any editor import on purpose: the Backend tab reads these at first paint, and
 * importing them from `fullstack/updateBaseline` used to pull the whole layout engine
 * (`pageLayout.ts` and friends, ~125 KB) into the entry chunk.
 */
import { t } from '../i18n'

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
    c.added ? t('{n} added', { n: c.added }) : '',
    c.changed ? t('{n} changed', { n: c.changed }) : '',
    c.deleted ? t('{n} removed', { n: c.deleted }) : '',
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : t('nothing changed')
}

/**
 * What an update compared the new model with (`X-Update-Base`), in words for its toast: the files
 * the project was generated with, kept by the server since its download (the patch then carries
 * the generator's fixes too), or nothing to say when it generated the old model again.
 */
export function describeUpdateBase(headers: Headers): string {
  return headers.get('X-Update-Base') === 'snapshot'
    ? ' — ' + t('from the files the project was generated with, the generator’s fixes since included')
    : ''
}

/** The `X-Snapshot` of a generated zip or an update, when it is one the server writes. */
export function snapshotHeader(headers: Headers): string | undefined {
  const id = headers.get('X-Snapshot')
  return id && /^[0-9a-f]{64}$/.test(id) ? id : undefined
}
