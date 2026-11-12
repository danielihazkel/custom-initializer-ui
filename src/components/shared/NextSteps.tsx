import type { ReactNode } from 'react'
import { CopyButton } from './CopyButton'

export interface NextStepCommand {
  /** Short name of the step ("Unpack", "Run"); also names its Copy button. */
  label: string
  cmd: string
}

export interface NextStepAction {
  id: string
  label: string
  /** Material Symbols icon name. */
  icon: string
  onClick: () => void
}

interface Props {
  /** What was produced: "demo.zip is downloaded — 5 dependencies". */
  title: string
  /** A line under the title: how to run it, where to look. */
  hint?: ReactNode
  /** The setup has changed since: the ZIP on disk is no longer what the screen shows. */
  stale?: boolean
  staleText?: string
  commands: NextStepCommand[]
  /** Lead-in of the action row ("Keep this setup:"). */
  actionsLabel?: string
  actions: NextStepAction[]
  onDismiss: () => void
  /** Outcome of a Copy click, for the caller's toast. */
  onCopied?: (ok: boolean, what: string) => void
  /** Anything specific to the generator, between the commands and the actions. */
  children?: ReactNode
}

/**
 * The card that follows a successful Generate, on every generator tab: how to run what was just
 * downloaded, and the ways to keep or share the setup. A toast says "downloaded"; this is the
 * part the user needs next. It started as the Fullstack tab's `NextStepsPanel`, which is now a
 * wrapper around it.
 */
export function NextSteps({
  title, hint, stale = false, staleText, commands, actionsLabel, actions, onDismiss, onCopied, children,
}: Props) {
  const action = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant text-secondary hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors'

  return (
    <section
      className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 next-steps-enter"
      aria-label="Next steps"
      data-next-steps
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-outlined text-primary mt-0.5" style={{ fontSize: '20px' }} aria-hidden="true">rocket_launch</span>
          <div>
            <h2 className="text-sm font-bold text-on-surface">{title}</h2>
            {hint && <p className="text-[11px] text-secondary">{hint}</p>}
            {stale && (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-warning" data-next-steps-stale>
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }} aria-hidden="true">history</span>
                {staleText ?? 'The setup has changed since — generate again to get the current version.'}
              </p>
            )}
          </div>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss next steps" className="p-1 rounded text-secondary hover:text-on-surface shrink-0">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">close</span>
        </button>
      </div>

      <ol className="space-y-1">
        {commands.map(c => (
          <li key={c.label} className="flex items-center gap-2 min-w-0">
            <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider text-secondary">{c.label}</span>
            <code className="flex-1 min-w-0 truncate px-2 py-1 rounded bg-surface-container-low border border-outline-variant font-mono text-[11px] text-on-surface">{c.cmd}</code>
            <CopyButton text={c.cmd} label={`Copy ${c.label} command`} onCopied={ok => onCopied?.(ok, `${c.label} command`)} />
          </li>
        ))}
      </ol>

      {children}

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {actionsLabel && <span className="text-[11px] text-secondary mr-1">{actionsLabel}</span>}
          {actions.map(a => (
            <button key={a.id} type="button" onClick={a.onClick} className={action}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">{a.icon}</span>{a.label}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
