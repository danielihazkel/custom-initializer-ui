import { useRef } from 'react'
import { useModal } from '../../hooks/useModal'
import { t, useLang } from '../../i18n'

/** Every keyboard shortcut the fullstack tab answers to — the cheat sheet renders this list and
 *  the tests pin it, so a new binding in `FullstackView` must be added here too. Each `action` is
 *  a getter, so it reads in the site's language at the moment the sheet draws it. */
export const FULLSTACK_SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Ctrl+Enter', get action() { return t('Generate the fullstack ZIP') } },
  { keys: 'Ctrl+Shift+E', get action() { return t('Explore the generated files') } },
  { keys: 'Ctrl+S', get action() { return t('Save the current model as a preset') } },
  { keys: 'Ctrl+Z', get action() { return t('Undo') } },
  { keys: 'Ctrl+Shift+Z / Ctrl+Y', get action() { return t('Redo') } },
  { keys: 'Ctrl+K', get action() { return t('Command palette — every action on this tab') } },
  { keys: '↑ / ↓ / Enter', get action() { return t('Move through the entity outline and open a card') } },
  { keys: '/', get action() { return t('Search the library (in the layout designer)') } },
  { keys: 'Delete', get action() { return t('Remove the selected widget (layout designer)') } },
  { keys: 'Alt+← / Alt+→', get action() { return t('Move the selected widget (layout designer)') } },
  { keys: 'Alt+Shift+← / →', get action() { return t('Make the selected widget narrower or wider') } },
  { keys: 'Ctrl+C / Ctrl+X', get action() { return t('Copy or cut the selected widget — or, with none selected, copy every widget of the dashboard') } },
  { keys: 'Double-click / F2', get action() { return t('Rename a title on the canvas in place — Enter saves, Esc cancels (layout designer)') } },
  { keys: 'Ctrl+D', get action() { return t('Duplicate the selected widget (layout designer)') } },
  { keys: 'Ctrl+V', get action() { return t('Paste copied widgets onto the dashboard on the canvas (after the selected one)') } },
  { keys: 'Delete / Alt+← / →', get action() { return t('On a focused page chip: remove the page, or move it (layout designer)') } },
  { keys: 'P', get action() { return t('Play the layout: click through it as the app would (layout designer)') } },
  { keys: 'Shift+F10', get action() { return t('Open a focused page chip’s menu; Ctrl/Shift-click picks several pages (layout designer)') } },
  { keys: 'Esc', get action() { return t('Close a dialog, panel or the import drawer; in the designer, deselect first') } },
  { keys: '?', get action() { return t('Show this list') } },
]

/** The Backend tab's shortcuts — bound in `App.tsx`, `DependencySelector` and `PresetPicker`. */
export const BACKEND_SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Ctrl+K', get action() { return t('Command palette — every action, dependency and setting') } },
  { keys: 'Ctrl+Enter', get action() { return t('Generate and download the project') } },
  { keys: 'Ctrl+Shift+E', get action() { return t('Explore the generated files') } },
  { keys: 'Ctrl+S', get action() { return t('Save the current setup as a preset') } },
  { keys: '/', get action() { return t('Search dependencies') } },
  { keys: '↓ / ↑', get action() { return t('From the search box, move through the results') } },
  { keys: 'Enter', get action() { return t('In the search box: add (or remove) the first result') } },
  { keys: 'Space', get action() { return t('On a dependency: select it') } },
  { keys: 'Esc', get action() { return t('Clear the search; close a dialog, drawer or menu') } },
  { keys: '?', get action() { return t('Show this list') } },
]

/** The Frontend tab's shortcuts — bound in `FrontendView` and `AvailableDependenciesFE`. */
export const FRONTEND_SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Ctrl+K', get action() { return t('Command palette') } },
  { keys: 'Ctrl+Enter', get action() { return t('Generate and download the project') } },
  { keys: 'Ctrl+Shift+E', get action() { return t('Explore the generated files') } },
  { keys: '/', get action() { return t('Search dependencies') } },
  { keys: 'Esc', get action() { return t('Close a dialog or menu') } },
  { keys: '?', get action() { return t('Show this list') } },
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
  useLang()
  const sheetRef = useRef<HTMLDivElement>(null)
  useModal(sheetRef, { onClose, lockScroll: false })

  return (
    <>
      <div className="fixed inset-0 bg-background/60 z-[60]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('Keyboard shortcuts')}
        data-shortcuts
        ref={sheetRef}
        tabIndex={-1}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-md max-h-[85vh] overflow-y-auto glass-panel border border-outline-variant rounded-xl shadow-2xl p-6 space-y-4 outline-none dialog-enter"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary mt-0.5" style={{ fontSize: '22px' }}>keyboard</span>
            <div>
              <h3 className="text-sm font-bold text-on-surface">{t('Keyboard shortcuts')}</h3>
              <p className="text-[11px] text-secondary mt-0.5">{t('Ctrl is ⌘ on a Mac. Chords work while typing; the bare keys wait until you leave the field.')}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Close')} className="p-1 rounded text-secondary hover:text-on-surface">
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
