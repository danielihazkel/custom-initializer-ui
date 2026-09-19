import { useEffect } from 'react'

/** Every keyboard shortcut the fullstack tab answers to — the cheat sheet renders this list and
 *  the tests pin it, so a new binding in `FullstackView` must be added here too. */
export const FULLSTACK_SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Ctrl+Enter', action: 'Generate the fullstack ZIP' },
  { keys: 'Ctrl+Shift+E', action: 'Explore the generated files' },
  { keys: 'Ctrl+S', action: 'Save the current model as a preset' },
  { keys: 'Ctrl+Z', action: 'Undo' },
  { keys: 'Ctrl+Shift+Z / Ctrl+Y', action: 'Redo' },
  { keys: 'Ctrl+K', action: 'Command palette — every action on this tab' },
  { keys: '↑ / ↓ / Enter', action: 'Move through the entity outline and open a card' },
  { keys: 'Esc', action: 'Close a dialog, panel or the import drawer' },
  { keys: '?', action: 'Show this list' },
]

/**
 * The `?` cheat sheet: a glass dialog listing {@link FULLSTACK_SHORTCUTS}. Escape and the
 * backdrop close it. Marked `data-shortcuts` so the view's global key handler can tell it apart
 * from the confirm dialogs that own the keyboard while open.
 */
export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 bg-background/60 z-[60]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        data-shortcuts
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-md glass-panel border border-outline-variant rounded-xl shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary mt-0.5" style={{ fontSize: '22px' }}>keyboard</span>
            <div>
              <h3 className="text-sm font-bold text-on-surface">Keyboard shortcuts</h3>
              <p className="text-[11px] text-secondary mt-0.5">Ctrl is ⌘ on a Mac. Chords work while typing; the bare keys wait until you leave the field.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded text-secondary hover:text-on-surface">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
          {FULLSTACK_SHORTCUTS.map(s => (
            <div key={s.keys} className="contents">
              <dt>
                <kbd className="inline-block px-1.5 py-0.5 rounded border border-outline-variant bg-surface-container-low font-mono text-[11px] text-on-surface whitespace-nowrap">{s.keys}</kbd>
              </dt>
              <dd className="text-secondary self-center">{s.action}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  )
}
