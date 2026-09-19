import { useMemo } from 'react'
import type { FullstackSnapshot } from './snapshot'
import { copyToClipboard } from '../../utils/clipboard'

/** What the last successful Generate produced — kept in memory only, so a refresh clears it. */
export interface GeneratedRun {
  at: number
  artifactId: string
  entityCount: number
  endpoints: { entity: string; method: string; path: string }[]
  /** The model the ZIP was built from, so the panel can say when the editor has moved on. */
  snapshot: FullstackSnapshot
}

interface Props {
  run: GeneratedRun
  /** True once the editor differs from `run.snapshot` — the ZIP on disk is no longer this model. */
  stale: boolean
  onDismiss: () => void
  onSavePreset: () => void
  onSaveTeam: () => void
  onCopyCurl: () => void
  onShareLink: () => void
  /** Outcome of a Copy click, for the caller's toast. */
  onCopied?: (ok: boolean, what: string) => void
}

/** Beyond this many entities the endpoint list starts collapsed. */
const ENDPOINTS_OPEN_MAX = 3

/**
 * The card that follows a successful Generate: how to run what was just downloaded, every
 * endpoint the backend exposes, and the ways to keep the model (preset, team, curl, link). A
 * toast says "downloaded"; this is the part the user actually needs next.
 */
export function NextStepsPanel({ run, stale, onDismiss, onSavePreset, onSaveTeam, onCopyCurl, onShareLink, onCopied }: Props) {
  const folder = run.artifactId || 'project'
  const commands = [
    { label: 'Unpack', cmd: `unzip ${folder}.zip -d ${folder} && cd ${folder}` },
    { label: 'Backend', cmd: 'cd backend && mvn spring-boot:run' },
    { label: 'Frontend', cmd: 'cd frontend && npm install && npm run dev' },
  ]
  const byEntity = useMemo(() => {
    const groups = new Map<string, { method: string; path: string }[]>()
    for (const ep of run.endpoints) {
      const list = groups.get(ep.entity) ?? []
      list.push({ method: ep.method, path: ep.path })
      groups.set(ep.entity, list)
    }
    return [...groups.entries()]
  }, [run.endpoints])

  async function copy(text: string, what: string) {
    onCopied?.(await copyToClipboard(text), what)
  }

  const action = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant text-secondary hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors'

  return (
    <section
      className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3"
      aria-label="Next steps"
      data-next-steps
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-outlined text-primary mt-0.5" style={{ fontSize: '20px' }}>rocket_launch</span>
          <div>
            <h2 className="text-sm font-bold text-on-surface">
              {folder}.zip is downloaded — {run.entityCount} entit{run.entityCount === 1 ? 'y' : 'ies'}, {run.endpoints.length} endpoint{run.endpoints.length === 1 ? '' : 's'}
            </h2>
            <p className="text-[11px] text-secondary">Run it in two terminals, then open <a className="underline" href="http://localhost:5173" target="_blank" rel="noreferrer">http://localhost:5173</a>.</p>
            {stale && (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-warning" data-next-steps-stale>
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>history</span>
                The model has changed since — generate again to get the current version.
              </p>
            )}
          </div>
        </div>
        <button type="button" onClick={onDismiss} aria-label="Dismiss next steps" className="p-1 rounded text-secondary hover:text-on-surface shrink-0">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
        </button>
      </div>

      <ol className="space-y-1">
        {commands.map(c => (
          <li key={c.label} className="flex items-center gap-2 min-w-0">
            <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider text-secondary">{c.label}</span>
            <code className="flex-1 min-w-0 truncate px-2 py-1 rounded bg-surface-container-low border border-outline-variant font-mono text-[11px] text-on-surface">{c.cmd}</code>
            <button
              type="button"
              onClick={() => { void copy(c.cmd, `${c.label} command`) }}
              aria-label={`Copy ${c.label} command`}
              className="p-1 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>content_copy</span>
            </button>
          </li>
        ))}
      </ol>

      <details className="text-[11px]" open={byEntity.length <= ENDPOINTS_OPEN_MAX} data-next-steps-endpoints>
        <summary className="cursor-pointer select-none text-secondary hover:text-on-surface inline-flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>list_alt</span>
          Endpoints ({run.endpoints.length})
        </summary>
        <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          {byEntity.map(([entity, eps]) => (
            <div key={entity} className="min-w-0">
              <p className="font-semibold text-on-surface">{entity}</p>
              <ul className="font-mono text-on-surface">
                {eps.map(ep => (
                  <li key={`${ep.method} ${ep.path}`} className="flex items-baseline gap-2 min-w-0">
                    <span className="w-14 shrink-0 text-[10px] font-bold tracking-wide text-secondary">{ep.method}</span>
                    <span className="truncate">{ep.path}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[11px] text-secondary mr-1">Keep this model:</span>
        <button type="button" onClick={onSavePreset} className={action}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bookmark_add</span>Save as preset
        </button>
        <button type="button" onClick={onSaveTeam} className={action}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>groups</span>Save to Team
        </button>
        <button type="button" onClick={onCopyCurl} className={action}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>terminal</span>Copy as curl
        </button>
        <button type="button" onClick={onShareLink} className={action}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>link</span>Copy share link
        </button>
      </div>
    </section>
  )
}
