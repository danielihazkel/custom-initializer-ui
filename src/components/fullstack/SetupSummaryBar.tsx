import type { SetupChip } from './setupSummary'

/**
 * The collapsed face of the Setup panel: one row of chips naming what the project is configured
 * as, plus the disclosure control.
 *
 * Every chip is a button, not a label — clicking one opens the panel *and* jumps to the section
 * that owns that value, so the bar doubles as the section nav it replaces while closed.
 */
export interface SetupSummaryBarProps {
  open: boolean
  onToggle: () => void
  chips: SetupChip[]
  /** Blocking metadata errors hiding inside the panel; surfaced as a dot on the bar. */
  errorCount: number
  /** True when the panel is being held open by those errors rather than by the user. */
  forced?: boolean
  onChipJump: (target: SetupChip['target']) => void
}

export function SetupSummaryBar({ open, onToggle, chips, errorCount, forced, onChipJump }: SetupSummaryBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap px-5 py-2.5">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-secondary">
        <span className="material-symbols-outlined text-secondary" style={{ fontSize: '15px' }}>tune</span>
        Setup
      </span>

      {!open && chips.map(chip => (
        <button
          key={chip.key}
          type="button"
          data-setup-chip={chip.key}
          title={chip.title}
          onClick={() => onChipJump(chip.target)}
          className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-outline-variant text-[11px] text-secondary hover:border-primary hover:text-primary transition-colors max-w-[18rem]"
        >
          {chip.swatch
            ? <span className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-outline-variant" style={{ background: chip.swatch }} aria-hidden="true" />
            : <span className="material-symbols-outlined shrink-0" style={{ fontSize: '13px' }}>{chip.icon}</span>}
          <span className="truncate">{chip.label}</span>
        </button>
      ))}

      <div className="ml-auto flex items-center gap-2">
        {errorCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-error" role="status">
            <span className="h-1.5 w-1.5 rounded-full bg-error" aria-hidden="true" />
            {errorCount} issue{errorCount === 1 ? '' : 's'} here
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? 'Hide project setup' : 'Edit project setup'}
          aria-expanded={open}
          aria-controls="fs-setup-body"
          disabled={forced}
          title={forced ? 'Fix the errors above to collapse this' : undefined}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-secondary hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-secondary"
        >
          {open ? 'Hide' : 'Edit'}
          <span className={`material-symbols-outlined transition-transform ${open ? 'rotate-180' : ''}`} style={{ fontSize: '16px' }}>expand_more</span>
        </button>
      </div>
    </div>
  )
}
