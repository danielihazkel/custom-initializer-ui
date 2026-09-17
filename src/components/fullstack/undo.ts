/** One history step: what the editor looked like *before* the edit named by `label`. */
export interface UndoEntry<T> {
  label: string
  snapshot: T
}

/** Linear undo/redo history. `past` holds "before" states newest-last; `future` holds the states
 *  an undo stepped away from, so redo can walk forward again. Any new edit clears `future`. */
export interface History<T> {
  past: UndoEntry<T>[]
  future: UndoEntry<T>[]
}

export const UNDO_MAX = 50

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] }
}

export function pushUndo<T>(stack: UndoEntry<T>[], entry: UndoEntry<T>, max = UNDO_MAX): UndoEntry<T>[] {
  const next = [...stack, entry]
  return next.length > max ? next.slice(next.length - max) : next
}

export function popUndo<T>(stack: UndoEntry<T>[]): { entry: UndoEntry<T> | null; rest: UndoEntry<T>[] } {
  if (stack.length === 0) return { entry: null, rest: stack }
  return { entry: stack[stack.length - 1], rest: stack.slice(0, -1) }
}

/** Records a new edit: `entry.snapshot` is the state before it. Redo history is discarded. */
export function record<T>(h: History<T>, entry: UndoEntry<T>, max = UNDO_MAX): History<T> {
  return { past: pushUndo(h.past, entry, max), future: [] }
}

/** Steps back one edit. `current` (the live state) is parked on the redo side under the same
 *  label so redo can restore it. Null when there is nothing to undo. */
export function undoStep<T>(h: History<T>, current: T): { history: History<T>; restore: UndoEntry<T> } | null {
  const { entry, rest } = popUndo(h.past)
  if (!entry) return null
  return {
    history: { past: rest, future: [...h.future, { label: entry.label, snapshot: current }] },
    restore: entry,
  }
}

/** Steps forward one edit undone earlier. Null when there is nothing to redo. */
export function redoStep<T>(h: History<T>, current: T): { history: History<T>; restore: UndoEntry<T> } | null {
  const { entry, rest } = popUndo(h.future)
  if (!entry) return null
  return {
    history: { past: [...h.past, { label: entry.label, snapshot: current }], future: rest },
    restore: entry,
  }
}

/** True when a keyboard shortcut should NOT be intercepted because the user is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}
