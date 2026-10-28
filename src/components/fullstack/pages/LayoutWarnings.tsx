import { useState } from 'react'
import type { FullstackPageDef } from '../../../types'
import type { EditTarget } from '../layoutPreviewModel'
import type { LayoutWarning, PageLayoutValidation } from '../pageLayout'

/** Advice about the layout (never blocks Generate): each line jumps to its page, and a fix applies in one undo step. */
export function LayoutWarnings({ warnings, dismissed = [], pages, reveal, pushUndo, onChange, onDismiss, onRestore }: {
  warnings: PageLayoutValidation['warnings']
  /** The warnings dismissed so far, listed under "Show dismissed" with a way back. */
  dismissed?: LayoutWarning[]
  pages: FullstackPageDef[]
  reveal: (target: EditTarget) => void
  pushUndo: (label: string) => void
  onChange: (next: FullstackPageDef[]) => void
  /** Given, each warning can be dismissed (it is advice the user may have weighed already). */
  onDismiss?: (key: string) => void
  onRestore?: (keys: string[]) => void
}) {
  const [showDismissed, setShowDismissed] = useState(false)
  if (warnings.length === 0) {
    return dismissed.length > 0 && onRestore ? (
      <DismissedList dismissed={dismissed} open={showDismissed} onToggle={() => setShowDismissed(o => !o)} onRestore={onRestore} />
    ) : null
  }
  return (
    <div className="space-y-1">
    <ul
      className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 space-y-1"
      role="status"
      aria-label="Layout warnings"
      data-page-layout-warnings
    >
      {warnings.map((warning, i) => (
        <li key={`${i}:${warning.summary}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 text-[11px] text-amber-800 dark:text-amber-200">
          {warning.page != null ? (
            <button
              type="button"
              onClick={() => reveal({ page: warning.page!, control: warning.field })}
              className="flex items-start gap-1.5 text-start hover:underline"
              title="Open this page at the warning"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }} aria-hidden="true">warning</span>
              {warning.summary}
            </button>
          ) : (
            <span className="flex items-start gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }} aria-hidden="true">warning</span>
              {warning.summary}
            </span>
          )}
          {warning.fix && (
            <button
              type="button"
              onClick={() => {
                pushUndo(warning.fix!.label)
                onChange(warning.fix!.apply(pages))
              }}
              className="inline-flex items-center gap-1 rounded border border-amber-500/50 px-1.5 py-0.5 text-[10px] font-semibold hover:bg-amber-400/20"
              title="Apply this fix (undoable)"
              data-page-fix
            >
              <span className="material-symbols-outlined" style={{ fontSize: '12px' }} aria-hidden="true">auto_fix_high</span>
              Fix: {warning.fix.label}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(warning.key)}
              className="ms-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold hover:bg-amber-400/20"
              title="Dismiss this warning (undoable; Show dismissed brings it back)"
              aria-label={`Dismiss: ${warning.summary}`}
              data-warning-dismiss
            >
              <span className="material-symbols-outlined" style={{ fontSize: '12px' }} aria-hidden="true">close</span>
              Dismiss
            </button>
          )}
        </li>
      ))}
    </ul>
    {dismissed.length > 0 && onRestore && (
      <DismissedList dismissed={dismissed} open={showDismissed} onToggle={() => setShowDismissed(o => !o)} onRestore={onRestore} />
    )}
    </div>
  )
}

function DismissedList({ dismissed, open, onToggle, onRestore }: {
  dismissed: LayoutWarning[]
  open: boolean
  onToggle: () => void
  onRestore: (keys: string[]) => void
}) {
  return (
    <div className="text-[11px] text-secondary" data-dismissed-warnings>
      <button type="button" onClick={onToggle} aria-expanded={open} className="hover:underline">
        {open ? 'Hide' : 'Show'} {dismissed.length} dismissed warning{dismissed.length === 1 ? '' : 's'}
      </button>
      {open && (
        <ul className="mt-1 space-y-1 ps-3">
          {dismissed.map(w => (
            <li key={w.key} className="flex flex-wrap items-start gap-x-3">
              <span className="line-through decoration-secondary/50">{w.summary}</span>
              <button type="button" onClick={() => onRestore([w.key])} className="font-semibold hover:underline" data-warning-restore>
                Restore
              </button>
            </li>
          ))}
          {dismissed.length > 1 && (
            <li>
              <button type="button" onClick={() => onRestore(dismissed.map(w => w.key))} className="font-semibold hover:underline">
                Restore all
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
