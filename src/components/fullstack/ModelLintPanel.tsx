import type { LintIssue } from './lint'

interface Props {
  issues: LintIssue[]
  onFix: (issue: LintIssue) => void
  /** Reveal the entity card an issue concerns (expand + scroll). */
  onJump: (uid: string) => void
  /** Owned by the parent so an entity card's amber badge can open the panel on its issues. */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, only that entity's issues are listed (with a "Show all" link). */
  filterUid?: string | null
  onFilterChange?: (uid: string | null) => void
  /** Entity names by uid, for the filtered heading. */
  entityName?: (uid: string) => string
}

/**
 * The model's non-blocking suggestions, collapsed to a one-line count until opened. Sits in the
 * Entities section header so it reads as advice about the model, not as a validation gate —
 * Generate stays enabled whatever is listed here.
 */
export function ModelLintPanel({ issues, onFix, onJump, open, onOpenChange, filterUid, onFilterChange, entityName }: Props) {
  if (issues.length === 0) return null
  const warns = issues.filter(i => i.severity === 'warn').length
  const infos = issues.length - warns
  const listed = filterUid ? issues.filter(i => i.entityUid === filterUid) : issues
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-low/60" data-model-lint>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px]"
      >
        <span className={`material-symbols-outlined ${warns > 0 ? 'text-warning' : 'text-secondary'}`} style={{ fontSize: '16px' }}>
          {warns > 0 ? 'lightbulb' : 'info'}
        </span>
        <span className="font-semibold text-on-surface">
          {issues.length} suggestion{issues.length === 1 ? '' : 's'}
        </span>
        <span className="text-secondary">
          {warns > 0 && `${warns} worth a look`}{warns > 0 && infos > 0 && ' · '}{infos > 0 && `${infos} FYI`}
        </span>
        <span className="ml-auto material-symbols-outlined text-secondary" style={{ fontSize: '16px' }}>
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {open && (
        <>
          {filterUid && (
            <p className="flex items-center gap-2 px-3 py-1.5 border-t border-outline-variant text-[11px] text-secondary" data-lint-filter>
              <span>Showing {listed.length} for <span className="font-mono text-on-surface">{entityName?.(filterUid) || 'this entity'}</span></span>
              <button type="button" onClick={() => onFilterChange?.(null)} className="underline hover:no-underline">
                Show all {issues.length}
              </button>
            </p>
          )}
          <ul className="border-t border-outline-variant divide-y divide-outline-variant/60">
            {listed.map(issue => (
              <li key={issue.id} className="flex items-start gap-2 px-3 py-2 text-[11px]" data-lint-rule={issue.rule}>
                <span
                  className={`material-symbols-outlined mt-px shrink-0 ${issue.severity === 'warn' ? 'text-warning' : 'text-secondary'}`}
                  style={{ fontSize: '14px' }}
                  aria-label={issue.severity === 'warn' ? 'Worth a look' : 'FYI'}
                >
                  {issue.severity === 'warn' ? 'warning' : 'info'}
                </span>
                <span className="flex-1 min-w-0 text-on-surface">{issue.message}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {issue.entityUid && (
                    <button
                      type="button"
                      onClick={() => onJump(issue.entityUid!)}
                      className="text-secondary hover:text-primary underline hover:no-underline"
                    >
                      Show
                    </button>
                  )}
                  {issue.fix && (
                    <button
                      type="button"
                      onClick={() => onFix(issue)}
                      className="font-semibold text-primary hover:underline"
                      title={issue.fix.label}
                    >
                      Fix: {issue.fix.label}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
