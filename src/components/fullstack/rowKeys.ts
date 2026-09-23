import { useRef } from 'react'
import { newUid } from './uid'

/**
 * React keys for rows whose data carries no uid (the page layout travels verbatim to the server,
 * into presets and share links, so it gets no client-only props). Keys are carried from the
 * previous render: a row keeps its key when it is the same object (a reorder moves objects
 * untouched), else when its identity matches (an undo or reload rebuilds every object), else
 * when it sits at a position no other row claimed (an edit replaces the object in place).
 * Anything left gets a fresh key.
 */
export function reconcileKeys<T>(
  prevItems: readonly T[],
  prevKeys: readonly string[],
  nextItems: readonly T[],
  identity: (item: T) => string,
): string[] {
  const used = new Set<number>()
  const keys: (string | undefined)[] = nextItems.map(item => {
    const idx = prevItems.findIndex((p, j) => !used.has(j) && p === item)
    if (idx < 0) return undefined
    used.add(idx)
    return prevKeys[idx]
  })
  nextItems.forEach((item, i) => {
    if (keys[i]) return
    const id = identity(item)
    if (!id) return
    const idx = prevItems.findIndex((p, j) => !used.has(j) && identity(p) === id)
    if (idx < 0) return
    used.add(idx)
    keys[i] = prevKeys[idx]
  })
  return nextItems.map((_, i) => {
    if (keys[i]) return keys[i]!
    if (i < prevItems.length && !used.has(i)) {
      used.add(i)
      return prevKeys[i]
    }
    return newUid()
  })
}

/** {@link reconcileKeys} across renders. */
export function useStableKeys<T>(items: readonly T[], identity: (item: T) => string): string[] {
  const ref = useRef<{ items: readonly T[]; keys: string[] }>({ items: [], keys: [] })
  if (ref.current.items !== items) {
    ref.current = { items, keys: reconcileKeys(ref.current.items, ref.current.keys, items, identity) }
  }
  return ref.current.keys
}
