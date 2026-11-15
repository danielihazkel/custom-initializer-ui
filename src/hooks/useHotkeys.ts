import { useEffect, useRef } from 'react'

/**
 * Keyboard shortcuts for a view, by the rule the Fullstack tab already follows:
 *
 * - a **chord** (Ctrl/⌘ + key) fires even while typing in a field — Ctrl+Enter generates from
 *   wherever the cursor is, and Ctrl+S beats the browser's save dialog;
 * - a **bare key** (`/`, `?`) fires only when no field has focus, or it could never be typed;
 * - nothing fires while a modal dialog is open: the dialog owns the keyboard.
 *
 * `ctrl` means Ctrl or ⌘. A binding's `run` may be replaced every render; the listener is
 * attached once.
 */
export interface Hotkey {
  /** `KeyboardEvent.key`, compared ignoring case: 'Enter', 's', '/', '?'. */
  key: string
  ctrl?: boolean
  shift?: boolean
  run: (e: KeyboardEvent) => void
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function useHotkeys(hotkeys: Hotkey[], enabled = true): void {
  const ref = useRef(hotkeys)
  ref.current = hotkeys

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey) return
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      for (const h of ref.current) {
        if (h.key.toLowerCase() !== key || Boolean(h.ctrl) !== ctrl) continue
        // Shift is part of typing '?': only chords are held to it.
        if (h.ctrl && Boolean(h.shift) !== e.shiftKey) continue
        if (!h.ctrl && isTyping(e.target)) return
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
        e.preventDefault()
        h.run(e)
        return
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
