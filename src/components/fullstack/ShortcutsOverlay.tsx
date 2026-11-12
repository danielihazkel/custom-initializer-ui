import { useRef } from 'react'
import { useModal } from '../../hooks/useModal'

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
  { keys: '/', action: 'Search the library (in the layout designer)' },
  { keys: 'Delete', action: 'Remove the selected widget (layout designer)' },
  { keys: 'Alt+← / Alt+→', action: 'Move the selected widget (layout designer)' },
  { keys: 'Alt+Shift+← / →', action: 'Make the selected widget narrower or wider' },
  { keys: 'Ctrl+C / Ctrl+X', action: 'Copy or cut the selected widget — or, with none selected, copy every widget of the dashboard' },
  { keys: 'Double-click / F2', action: 'Rename a title on the canvas in place — Enter saves, Esc cancels (layout designer)' },
  { keys: 'Ctrl+D', action: 'Duplicate the selected widget (layout designer)' },
  { keys: 'Ctrl+V', action: 'Paste copied widgets onto the dashboard on the canvas (after the selected one)' },
  { keys: 'Delete / Alt+← / →', action: 'On a focused page chip: remove the page, or move it (layout designer)' },
  { keys: 'P', action: 'Play the layout: click through it as the app would (layout designer)' },
  { keys: 'Shift+F10', action: 'Open a focused page chip’s menu; Ctrl/Shift-click picks several pages (layout designer)' },
  { keys: 'Esc', action: 'Close a dialog, panel or the import drawer; in the designer, deselect first' },
  { keys: '?', action: 'Show this list' },
]

/** The Backend tab's shortcuts — bound in `App.tsx`, `DependencySelector` and `PresetPicker`. */
export const BACKEND_SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Ctrl+K', action: 'Command palette — every action, dependency and setting' },
  { keys: 'Ctrl+Enter', action: 'Generate and download the project' },
  { keys: 'Ctrl+Shift+E', action: 'Explore the generated files' },
  { keys: 'Ctrl+S', action: 'Save the current setup as a preset' },
  { keys: '/', action: 'Search dependencies' },
  { keys: '↓ / ↑', action: 'From the search box, move through the results' },
  { keys: 'Enter', action: 'In the search box: add (or remove) the first result' },
  { keys: 'Space', action: 'On a dependency: select it' },
  { keys: 'Esc', action: 'Clear the search; close a dialog, drawer or menu' },
  { keys: '?', action: 'Show this list' },
]

/** The Frontend tab's shortcuts — bound in `FrontendView` and `AvailableDependenciesFE`. */
export const FRONTEND_SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Ctrl+K', action: 'Command palette' },
  { keys: 'Ctrl+Enter', action: 'Generate and download the project' },
  { keys: 'Ctrl+Shift+E', action: 'Explore the generated files' },
  { keys: '/', action: 'Search dependencies' },
  { keys: 'Esc', action: 'Close a dialog or menu' },
  { keys: '?', action: 'Show this list' },
]

/**
 * The `?` cheat sheet: a glass dialog listing a tab's shortcuts ({@link FULLSTACK_SHORTCUTS}
 * unless another list is given). Escape and the backdrop close it. Marked `data-shortcuts` so the
 * Fullstack view's global key handler can tell it apart from the confirm dialogs that own the
 * keyboard while open.
 */
export function ShortcutsOverlay({ onClose, shortcuts = FULLSTACK_SHORTCUTS }: {
  onClose: () => void
  shortcuts?: { keys: string; action: string }[]
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  useModal(sheetRef, { onClose, lockScroll: false })

  return (
    <>
      <div className="fixed inset-0 bg-background/60 z-[60]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        data-shortcuts
        ref={sheetRef}
        tabIndex={-1}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-md max-h-[85vh] overflow-y-auto glass-panel border border-outline-variant rounded-xl shadow-2xl p-6 space-y-4 outline-none dialog-enter"
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
          {shortcuts.map(s => (
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
