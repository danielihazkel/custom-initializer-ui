/** A bounded stack of "what the editor looked like before a destructive edit". */
export interface UndoEntry<T> {
  label: string
  snapshot: T
}

export const UNDO_MAX = 20

export function pushUndo<T>(stack: UndoEntry<T>[], entry: UndoEntry<T>, max = UNDO_MAX): UndoEntry<T>[] {
  const next = [...stack, entry]
  return next.length > max ? next.slice(next.length - max) : next
}

export function popUndo<T>(stack: UndoEntry<T>[]): { entry: UndoEntry<T> | null; rest: UndoEntry<T>[] } {
  if (stack.length === 0) return { entry: null, rest: stack }
  return { entry: stack[stack.length - 1], rest: stack.slice(0, -1) }
}

/** True when a keyboard shortcut should NOT be intercepted because the user is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}
