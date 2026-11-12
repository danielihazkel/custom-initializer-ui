import { useMemo } from 'react'
import type { FullstackSnapshot } from './snapshot'
import { NextSteps } from '../shared/NextSteps'

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
 * The Fullstack tab's card after a successful Generate: how to run the backend and the frontend,
 * every endpoint the backend exposes, and the ways to keep the model (preset, team, curl, link).
 * The card itself is the shared `NextSteps`; this supplies the fullstack commands and the
 * endpoint list.
 */
export function NextStepsPanel({ run, stale, onDismiss, onSavePreset, onSaveTeam, onCopyCurl, onShareLink, onCopied }: Props) {
  const folder = run.artifactId || 'project'
  const byEntity = useMemo(() => {
    const groups = new Map<string, { method: string; path: string }[]>()
    for (const ep of run.endpoints) {
      const list = groups.get(ep.entity) ?? []
      list.push({ method: ep.method, path: ep.path })
      groups.set(ep.entity, list)
    }
    return [...groups.entries()]
  }, [run.endpoints])

  return (
    <NextSteps
      title={`${folder}.zip is downloaded — ${run.entityCount} entit${run.entityCount === 1 ? 'y' : 'ies'}, ${run.endpoints.length} endpoint${run.endpoints.length === 1 ? '' : 's'}`}
      hint={<>Run it in two terminals, then open <a className="underline" href="http://localhost:5173" target="_blank" rel="noreferrer">http://localhost:5173</a>.</>}
      stale={stale}
      staleText="The model has changed since — generate again to get the current version."
      commands={[
        { label: 'Unpack', cmd: `unzip ${folder}.zip -d ${folder} && cd ${folder}` },
        { label: 'Backend', cmd: 'cd backend && mvn spring-boot:run' },
        { label: 'Frontend', cmd: 'cd frontend && npm install && npm run dev' },
      ]}
      actionsLabel="Keep this model:"
      actions={[
        { id: 'preset', label: 'Save as preset', icon: 'bookmark_add', onClick: onSavePreset },
        { id: 'team', label: 'Save to Team', icon: 'groups', onClick: onSaveTeam },
        { id: 'curl', label: 'Copy as curl', icon: 'terminal', onClick: onCopyCurl },
        { id: 'link', label: 'Copy share link', icon: 'link', onClick: onShareLink },
      ]}
      onDismiss={onDismiss}
      onCopied={onCopied}
    >
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
    </NextSteps>
  )
}
