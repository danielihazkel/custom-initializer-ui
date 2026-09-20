import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PreviewError } from '../../types'

/**
 * Explore / Generate / Cancel / Reset, rendered into the app header's slots.
 *
 * The fullstack tab used to hide the header's own copies of these buttons (App.tsx already
 * special-cases `view === 'fullstack'`) and reimplement them in a sticky bottom bar — paying the
 * cost of the portal convention without taking the benefit, and burning a band of viewport that
 * the entity modeller wants. The Frontend tab already portals; this matches it, so the three
 * generator tabs now read identically.
 *
 * Model-editing verbs (undo/redo, the issue pill) deliberately stay in the workspace toolbar:
 * they belong next to the thing they edit, and no other tab has an analogue.
 */
export interface HeaderActionsProps {
  previewLoading: boolean
  generating: boolean
  previewError: PreviewError | null
  /** Blocking validation errors — Explore/Generate stay enabled, but say why. */
  hasErrors: boolean
  blockedReason: string
  onExplore: () => void
  onGenerate: () => void
  onCancel: () => void
  onReset: () => void
}

export function HeaderActions({
  previewLoading, generating, previewError, hasErrors, blockedReason,
  onExplore, onGenerate, onCancel, onReset,
}: HeaderActionsProps) {
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null)
  const [resetSlot, setResetSlot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setActionsSlot(document.getElementById('header-frontend-actions'))
    setResetSlot(document.getElementById('header-frontend-reset'))
  }, [])

  const busy = previewLoading || generating

  return (
    <>
      {actionsSlot && createPortal(
        <>
          {busy && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded text-sm font-medium text-secondary hover:text-error transition-colors duration-200"
              title={previewLoading ? 'Stop building the preview' : 'Stop generating the ZIP'}
            >
              Cancel
            </button>
          )}
          {/* Explore / Generate stay clickable with validation errors: the click toasts the count
              and jumps to the first problem, which a disabled button could not do. They must not
              *look* disabled either — the issue pill in the workspace toolbar carries that signal. */}
          <button
            type="button"
            onClick={onExplore}
            disabled={previewLoading}
            aria-describedby={hasErrors ? 'fs-blocked-reason' : undefined}
            title={hasErrors ? blockedReason : 'Preview the generated file tree before downloading'}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-60 ${
              previewError ? 'text-error' : 'text-secondary hover:text-on-surface'}`}
          >
            {previewLoading
              ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>
              : 'Explore'}
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            aria-describedby={hasErrors ? 'fs-blocked-reason' : undefined}
            title={hasErrors ? blockedReason : 'Generate and download the backend + frontend ZIP'}
            className="px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ minWidth: '110px' }}
          >
            {generating ? 'Generating…' : 'Generate Fullstack ZIP'}
          </button>
        </>,
        actionsSlot,
      )}

      {resetSlot && createPortal(
        <button
          type="button"
          onClick={onReset}
          className="p-2 rounded text-secondary hover:text-on-surface transition-colors duration-200"
          aria-label="Reset to defaults"
          title="Reset the fullstack generator to defaults"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>restart_alt</span>
        </button>,
        resetSlot,
      )}
    </>
  )
}
