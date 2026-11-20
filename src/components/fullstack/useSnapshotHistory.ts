import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { emptyHistory, record, redoStep, stepMany, undoStep, type History } from './undo'
import { t, tn } from '../../i18n'

/** How long a burst of edits to the same thing stays one undo step after the last of them. */
const BURST_IDLE_MS = 600

export interface SnapshotHistoryOptions<S> {
  /** The state as it is now: a new object whenever anything in it changed. */
  current: S
  /** Puts a state back. `keepView` is true for undo and redo, which keep the view (open rows,
   *  collapsed cards) where a load starts clean. Must keep its identity between renders. */
  apply: (snapshot: S, keepView: boolean) => void
  equal: (a: S, b: S) => boolean
  /** What a change touched: successive changes with the same key coalesce into one step. */
  changeKey: (prev: S, next: S) => string
  /** The label a change is filed under ("Renamed Customer"). */
  describe: (prev: S, next: S) => string
  /**
   * The state a change that is not the user's starts from — setup, or one already filed by
   * {@link SnapshotHistory.pushUndoEntry}. Matched by identity when the change arrives, then
   * cleared. The owner creates the ref so that it can set it from its own effects.
   */
  silentFromRef: MutableRefObject<S | null>
  /** Raised by whoever rewrote the state to follow the edit before it (a layout following a
   *  rename): that rewrite belongs to the edit's step and starts none of its own. */
  followsRef?: MutableRefObject<boolean>
  /** Says what an undo or a redo did. */
  notify: (message: string) => void
}

export interface SnapshotHistory<S> {
  history: History<S>
  /** Files the state as it is now under `label`, before a change that is then not recorded again
   *  (a removal, an import, a load, a reset). */
  pushUndoEntry: (label: string) => void
  undo: () => void
  redo: () => void
  /** Several undos (negative) or redos (positive) at once. */
  jumpHistory: (steps: number) => void
}

/**
 * Undo and redo over one snapshot of an editor's state.
 *
 * Every change to the snapshot is recorded automatically: the effect below sees the new
 * snapshot, and files the *previous* one as the "before" state. Rapid successive changes to
 * the *same thing* (typing a name, retyping a default) coalesce into one entry — a burst stays
 * open while changes keep arriving within BURST_IDLE_MS and keep hitting the same change key;
 * an edit elsewhere (another field's checkbox) commits the burst and starts a new one, so
 * three quick ticks on three fields stay three undo steps. Destructive actions (remove,
 * import, load, reset) still push an explicitly labelled entry first via pushUndoEntry; the
 * state change they cause is then skipped so it isn't recorded twice. Undo/redo restore
 * through `apply` and are skipped the same way.
 */
export function useSnapshotHistory<S>(options: SnapshotHistoryOptions<S>): SnapshotHistory<S> {
  const { current, silentFromRef, followsRef } = options
  // The callbacks below keep their identity; what they call is read as of the latest render.
  const latest = useRef(options)
  latest.current = options

  const [history, setHistory] = useState<History<S>>(() => emptyHistory())
  const historyRef = useRef(history)
  historyRef.current = history
  const lastSnapshotRef = useRef(current)
  const burstRef = useRef<{ before: S; label: string; key: string } | null>(null)
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushBurst = useCallback(() => {
    if (burstTimerRef.current) { clearTimeout(burstTimerRef.current); burstTimerRef.current = null }
    const burst = burstRef.current
    if (!burst) return
    burstRef.current = null
    // Update the ref as well as the state: undo() reads the ref right after flushing, and a
    // Ctrl+Z within the burst window must see the entry it just closed, not the pre-render one.
    const next = record(historyRef.current, { label: burst.label, snapshot: burst.before })
    historyRef.current = next
    setHistory(next)
  }, [])

  useEffect(() => {
    const prev = lastSnapshotRef.current
    if (prev === current) return
    lastSnapshotRef.current = current
    if (silentFromRef.current === prev) { silentFromRef.current = null; return }
    if (followsRef?.current) {
      // The layout following a model edit belongs to that edit's undo step (or to none, when
      // the edit itself was recorded explicitly): keep the open burst, start no new one.
      followsRef.current = false
      if (burstRef.current) {
        if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
        burstTimerRef.current = setTimeout(flushBurst, BURST_IDLE_MS)
      }
      return
    }
    if (latest.current.equal(prev, current)) return
    const key = latest.current.changeKey(prev, current)
    if (burstRef.current && burstRef.current.key !== key) flushBurst()
    if (!burstRef.current) burstRef.current = { before: prev, label: latest.current.describe(prev, current), key }
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
    burstTimerRef.current = setTimeout(flushBurst, BURST_IDLE_MS)
  }, [current, flushBurst, silentFromRef, followsRef])
  useEffect(() => () => { if (burstTimerRef.current) clearTimeout(burstTimerRef.current) }, [])

  const pushUndoEntry = useCallback((label: string) => {
    flushBurst()
    const before = latest.current.current
    silentFromRef.current = before
    setHistory(h => record(h, { label, snapshot: before }))
  }, [flushBurst, silentFromRef])

  const undo = useCallback(() => {
    flushBurst()
    const now = latest.current.current
    const step = undoStep(historyRef.current, now)
    if (!step) return
    silentFromRef.current = now
    setHistory(step.history)
    latest.current.apply(step.restore.snapshot, true)
    latest.current.notify(t('Undid: {change}', { change: step.restore.label }))
  }, [flushBurst, silentFromRef])

  const redo = useCallback(() => {
    flushBurst()
    const now = latest.current.current
    const step = redoStep(historyRef.current, now)
    if (!step) return
    silentFromRef.current = now
    setHistory(step.history)
    latest.current.apply(step.restore.snapshot, true)
    latest.current.notify(t('Redid: {change}', { change: step.restore.label }))
  }, [flushBurst, silentFromRef])

  const jumpHistory = useCallback((steps: number) => {
    flushBurst()
    const now = latest.current.current
    const step = stepMany(historyRef.current, now, steps)
    if (!step) return
    silentFromRef.current = now
    setHistory(step.history)
    latest.current.apply(step.restore.snapshot, true)
    latest.current.notify(steps < 0
      ? tn(step.labels.length, 'Undid {n} change', 'Undid {n} changes')
      : tn(step.labels.length, 'Redid {n} change', 'Redid {n} changes'))
  }, [flushBurst, silentFromRef])

  return { history, pushUndoEntry, undo, redo, jumpHistory }
}
