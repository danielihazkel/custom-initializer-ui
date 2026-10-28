/**
 * What the canvas shows while the generated app is not on it: starting (no reason), or why it
 * cannot be shown — the layout's problems first, with a way to them, since fixing them is what
 * brings the app back.
 */
export function CanvasNotice({ reason, problems = 0, onShowProblems }: {
  /** Why the app is not shown; null while it starts. */
  reason: string | null
  /** The layout's problems: the generator refuses a layout that has any. */
  problems?: number
  onShowProblems?: () => void
}) {
  const starting = reason == null
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-background p-6" data-designer-canvas data-canvas-notice={starting ? 'starting' : 'blocked'}>
      <div className="flex max-w-md flex-col items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest px-8 py-10 text-center shadow-sm" role="status">
        <span className={`material-symbols-outlined ${starting ? 'animate-spin text-primary' : problems > 0 ? 'text-error' : 'text-secondary'}`} style={{ fontSize: '28px' }} aria-hidden="true">
          {starting ? 'progress_activity' : problems > 0 ? 'error' : 'visibility_off'}
        </span>
        <h2 className="text-sm font-semibold text-on-surface">{starting ? 'Starting the generated app…' : 'The generated app cannot be shown yet'}</h2>
        {!starting && <p className="text-xs text-secondary">{reason}</p>}
        {!starting && problems > 0 && onShowProblems && (
          <button type="button" onClick={onShowProblems} className="mt-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary" data-canvas-show-problems>
            Show the {problems} problem{problems === 1 ? '' : 's'}
          </button>
        )}
        {!starting && <p className="text-[11px] text-secondary">Every setting is still in the panes beside the canvas.</p>}
      </div>
    </div>
  )
}
