import type { FullstackPageDef } from '../../../types'
import type { EditTarget } from '../layoutPreviewModel'
import type { PageLayoutValidation } from '../pageLayout'
import { ICON_BUTTON } from '../pages/constants'
import { LayoutWarnings } from '../pages/LayoutWarnings'
import type { LayoutIssue, PagesModel } from '../pages/usePagesModel'

/**
 * The layout's problems (they stop Generate) and tips (advice, dismissable), as a sheet over the
 * bottom of the designer. Each one jumps to its page and control; a fix applies in one undo step.
 */
export function IssuesPanel({ pages, model, issues, validation, reveal, onClose, dismissedWarnings, onDismissedWarningsChange }: {
  pages: FullstackPageDef[]
  model: PagesModel
  issues: LayoutIssue[]
  validation: PageLayoutValidation
  reveal: (target: EditTarget) => void
  onClose: () => void
  dismissedWarnings?: string[]
  onDismissedWarningsChange?: (keys: string[]) => void
}) {
  const fixable = issues.filter(i => i.fix).length
  return (
    <section
      className="absolute inset-x-0 bottom-0 z-10 flex max-h-[45%] flex-col rounded-t-2xl border-t border-outline bg-surface-container-lowest shadow-[0_-12px_40px_rgba(0,0,0,0.35)]"
      aria-label="Layout issues"
      data-designer-issues
    >
      <div className="flex items-center gap-3 border-b border-outline-variant px-5 py-3">
        <h2 className="text-sm font-semibold text-on-surface">Issues</h2>
        <span className="text-[11px] text-secondary">
          {issues.length === 0 ? 'No problems — the layout is ready to generate.' : `${issues.length} problem${issues.length === 1 ? '' : 's'} stop Generate until fixed.`}
          {validation.warnings.length > 0 && ` ${validation.warnings.length} tip${validation.warnings.length === 1 ? '' : 's'} never do.`}
        </span>
        {fixable > 1 && (
          <button
            type="button"
            onClick={model.fixAll}
            className="ms-auto rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-on-primary"
            title="Apply each problem's own fix, one after another — one undo step"
            data-page-fix-all
          >
            Fix all ({fixable})
          </button>
        )}
        <button type="button" onClick={onClose} className={`${ICON_BUTTON} ${fixable > 1 ? '' : 'ms-auto'}`} aria-label="Close the issues">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>expand_more</span>
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3">
        {issues.length > 0 && (
          <ul className="space-y-1.5" aria-label="Layout problems" data-page-layout-problems>
            {issues.map((issue, i) => (
              <li key={`${i}:${issue.summary}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">error</span>
                <span className="min-w-0 flex-1 text-on-surface">{issue.summary}</span>
                {issue.page != null && (
                  <button
                    type="button"
                    onClick={() => reveal({ page: issue.page!, control: issue.field })}
                    className="rounded-md border border-outline-variant px-2 py-1 text-[11px] font-semibold text-on-surface hover:border-primary/50"
                  >
                    Jump to
                  </button>
                )}
                {issue.fix && (
                  <button type="button" onClick={() => model.applyFix(issue.fix!)} className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-on-primary" title="Apply this fix (undoable)" data-page-fix>
                    Fix: {issue.fix.label}
                  </button>
                )}
                {issue.alsoFix && (
                  <button type="button" onClick={() => model.applyFix(issue.alsoFix!)} className="rounded-md border border-outline-variant px-2 py-1 text-[11px] text-on-surface" title="Apply this fix instead (undoable)" data-page-fix-alt>
                    or {issue.alsoFix.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {(validation.warnings.length > 0 || (onDismissedWarningsChange && validation.dismissedWarnings.length > 0)) && (
          <LayoutWarnings
            warnings={validation.warnings}
            dismissed={validation.dismissedWarnings}
            pages={pages}
            reveal={reveal}
            pushUndo={model.pushUndo}
            onChange={model.onChange}
            onDismiss={onDismissedWarningsChange ? key => onDismissedWarningsChange([...(dismissedWarnings ?? []), key]) : undefined}
            onRestore={onDismissedWarningsChange ? keys => onDismissedWarningsChange((dismissedWarnings ?? []).filter(k => !keys.includes(k))) : undefined}
          />
        )}
        {issues.length === 0 && validation.warnings.length === 0 && (
          <p className="py-4 text-center text-xs text-secondary">Nothing to fix.</p>
        )}
      </div>
    </section>
  )
}
