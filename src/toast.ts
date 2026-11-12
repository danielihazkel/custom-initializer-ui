import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Toast } from './types'

/**
 * The one toast stack of the app.
 *
 * There used to be two toast components that did not know of each other — `AppToast` (bottom
 * right, animated, no action) and the admin `StatusToast` (bottom centre, with Undo) — so two
 * messages at once drew in two places, or on top of each other. Both are now thin adapters over
 * this store, and `components/Toaster.tsx` draws whatever it holds: one position, a short stack,
 * one behaviour.
 *
 * Code that has no toast state of its own can call {@link showToast} directly.
 */
export interface ShownToast extends Toast {
  id: number
}

/** A toast that offers an action ("Undo") stays up long enough to reach it. */
const PLAIN_MS = 3000
const WITH_ACTION_MS = 6000
/** More than this at once and the oldest leaves — a wall of toasts is not read. */
const MAX_SHOWN = 3

let shown: ShownToast[] = []
let nextId = 1
const dismissedCallbacks = new Map<number, () => void>()
const timers = new Map<number, ReturnType<typeof setTimeout>>()
const listeners = new Set<() => void>()

/** The mounted `<Toaster>`s, oldest first. Only the first draws: an adapter brings its own
 *  Toaster so it works when rendered alone (a test, one view), and under `App` they would
 *  otherwise all draw the same stack. */
let hosts: number[] = []
let nextHost = 1

function emit(): void {
  for (const l of listeners) l()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function lifetimeOf(toast: Toast): number {
  return toast.action ? WITH_ACTION_MS : PLAIN_MS
}

function arm(toast: ShownToast): void {
  clearTimeout(timers.get(toast.id))
  timers.set(toast.id, setTimeout(() => dismissToast(toast.id), lifetimeOf(toast)))
}

/**
 * Shows a toast and returns its id. `dismissed` is called when it leaves by itself — its time
 * ran out, the user closed it or took its action, or newer toasts pushed it out — but not when
 * the caller dismisses it with `silent`.
 */
export function showToast(toast: Toast, dismissed?: () => void): number {
  const entry: ShownToast = { ...toast, id: nextId++ }
  shown = [...shown, entry]
  if (dismissed) dismissedCallbacks.set(entry.id, dismissed)
  arm(entry)
  emit()
  while (shown.length > MAX_SHOWN) dismissToast(shown[0].id)
  return entry.id
}

export function dismissToast(id: number, silent = false): void {
  if (!shown.some(t => t.id === id)) return
  shown = shown.filter(t => t.id !== id)
  clearTimeout(timers.get(id))
  timers.delete(id)
  const callback = dismissedCallbacks.get(id)
  dismissedCallbacks.delete(id)
  emit()
  if (!silent) callback?.()
}

/** The pointer is over the stack: nothing leaves while it is being read. */
export function holdToasts(): void {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
}

/** The pointer has left: every toast gets its full time again. */
export function releaseToasts(): void {
  for (const t of shown) arm(t)
}

/** Empties the stack without telling anyone — between tests (`src/test/setup.ts`). */
export function resetToasts(): void {
  holdToasts()
  dismissedCallbacks.clear()
  shown = []
  emit()
}

export function useToasts(): ShownToast[] {
  return useSyncExternalStore(subscribe, () => shown, () => shown)
}

/** True for the one mounted Toaster that should draw the stack. */
export function useIsPrimaryToaster(): boolean {
  const idRef = useRef(0)
  if (idRef.current === 0) idRef.current = nextHost++
  const id = idRef.current
  useEffect(() => {
    hosts = [...hosts, id]
    emit()
    return () => {
      hosts = hosts.filter(h => h !== id)
      emit()
    }
  }, [id])
  return useSyncExternalStore(subscribe, () => hosts[0] === id, () => false)
}

/**
 * The bridge for a component that keeps its toast in state (`toast` / `onClear`), which is how
 * every view was written: shows the toast while the prop holds one, replaces it when the prop
 * changes, and calls `onClear` once it has left by itself.
 */
export function useToastProp(toast: Toast | null, onClear: () => void): void {
  // Callers pass an inline arrow; depending on it would re-show the toast (and restart its
  // time) on every parent render.
  const clearRef = useRef(onClear)
  clearRef.current = onClear
  useEffect(() => {
    if (!toast) return
    const id = showToast(toast, () => clearRef.current())
    return () => dismissToast(id, true)
  }, [toast])
}
