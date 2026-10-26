import type { FullstackPageDef } from '../../../types'
import type { EditTarget } from '../LayoutPreview'
import type { PageLayoutValidation } from '../pageLayout'

/** Advice about the layout (never blocks Generate): each line jumps to its page, and a fix applies in one undo step. */
export function LayoutWarnings({ warnings, pages, reveal, pushUndo, onChange }: {
  warnings: PageLayoutValidation['warnings']
  pages: FullstackPageDef[]
  reveal: (target: EditTarget) => void
  pushUndo: (label: string) => void
  onChange: (next: FullstackPageDef[]) => void
}) {
  return (
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
        </li>
      ))}
    </ul>
  )
}
