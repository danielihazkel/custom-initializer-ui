import { snapshotsEqual, type FullstackSnapshot } from './snapshot'

/**
 * Whether opening a share link (`?fs=…`) straight away would throw work away. A link used to win
 * unconditionally on first render, and the persist effects then wrote it over the stored draft —
 * so opening a colleague's link destroyed whatever was in progress. The draft is safe to replace
 * when it is the stock model, the very model the link carries, or already kept as a preset or
 * recent; anything else is asked about first.
 *
 * Pure so it can run synchronously inside the view's state initialisers, before any hook has
 * loaded the preset lists (they are read straight from storage by the caller).
 */
export function draftHasUnsavedWork(
  stored: FullstackSnapshot,
  shared: FullstackSnapshot,
  saved: readonly FullstackSnapshot[],
  stockEntitiesJson: string,
): boolean {
  if (JSON.stringify(stored.entities) === stockEntitiesJson) return false
  if (snapshotsEqual(stored, shared)) return false
  return !saved.some(s => snapshotsEqual(s, stored))
}
