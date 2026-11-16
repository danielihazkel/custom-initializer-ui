import { useCallback, useEffect, useState } from 'react'
import { getAuthHeaders, handle401, invalidateAdminCache } from '../../../hooks/useAdminResource'
import { invalidateMetadata } from '../../../hooks/useMetadata'
import type { CatalogChange, CatalogRequest, Paged } from '../../../types'

/** The catalog tables, as an admin calls them. */
export const TABLES: Record<string, string> = {
  DependencyGroupEntity: 'Dependency group',
  DependencyEntryEntity: 'Dependency',
  FileContributionEntity: 'File contribution',
  BuildCustomizationEntity: 'Build customization',
  DependencySubOptionEntity: 'Sub-option',
  DependencyCompatibilityEntity: 'Compatibility rule',
  StarterTemplateEntity: 'Starter template',
  StarterTemplateDepEntity: 'Starter template dependency',
  ModuleTemplateEntity: 'Module template',
  ModuleDependencyMappingEntity: 'Module dependency',
  EntityTemplateSetEntity: 'Entity template set',
  EntityTemplateFileEntity: 'Entity template file',
  EntityTemplateSetDefaultDepEntity: 'Template set default dependency',
  ColorPaletteEntity: 'Palette',
  VersionDefinitionEntity: 'Version',
  DepartmentEntity: 'Department',
  FullstackExampleEntity: 'Fullstack example',
}

const SOURCES: Record<string, string> = {
  admin: 'Admin edit',
  import: 'Import',
  'catalog-sync': 'Catalog sync',
  'template-reset': 'Template reset',
  'release-sync': 'Release update',
  restore: 'Restore',
  system: 'System',
}

const ACTIONS: Record<CatalogChange['action'], { label: string; tone: string }> = {
  CREATE: { label: 'Created', tone: 'bg-tertiary/15 text-tertiary' },
  UPDATE: { label: 'Changed', tone: 'bg-primary/15 text-primary' },
  DELETE: { label: 'Deleted', tone: 'bg-error/15 text-error' },
}

const PAGE = 50

interface Filter { entityType: string; actor: string; source: string; requestId: string; q: string }
const EMPTY: Filter = { entityType: '', actor: '', source: '', requestId: '', q: '' }

async function getJson<T>(url: string): Promise<T> {
  const res = handle401(await fetch(url, { headers: { Accept: 'application/json', ...getAuthHeaders() } }))
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json() as Promise<T>
}

/** A refused undo: the rows somebody changed since, for the admin to confirm overwriting. */
interface Conflict { detail: string; rows: string[]; retry: () => Promise<void> }

async function post(url: string, body: object): Promise<{ ok: true } | { conflict: { detail: string; rows: string[] } } | { error: string }> {
  const res = handle401(await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  }))
  const data = (await res.json().catch(() => null)) as { detail?: string; rows?: string[] } | null
  if (res.status === 409) return { conflict: { detail: data?.detail ?? 'Changed since', rows: data?.rows ?? [] } }
  if (!res.ok) return { error: data?.detail ?? `HTTP ${res.status}` }
  // The catalog moved: the other admin tabs and the generator read it afresh.
  invalidateAdminCache()
  invalidateMetadata()
  return { ok: true }
}

export function HistoryTab() {
  const [view, setView] = useState<'changes' | 'requests'>('changes')
  const [filter, setFilter] = useState<Filter>(EMPTY)
  const [page, setPage] = useState(0)
  const [changes, setChanges] = useState<Paged<CatalogChange> | null>(null)
  const [requests, setRequests] = useState<Paged<CatalogRequest> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<CatalogChange | null>(null)
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const narrow = (change: Partial<Filter>) => {
    setFilter(f => ({ ...f, ...change }))
    setPage(0)
    setView('changes')
  }

  useEffect(() => {
    setError(null)
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(filter)) if (v.trim()) params.set(k, v.trim())
    params.set('page', String(page))
    params.set('size', String(PAGE))
    const handle = setTimeout(() => {
      if (view === 'changes') {
        getJson<Paged<CatalogChange>>(`/admin/history?${params}`).then(setChanges).catch(e => setError(String(e.message ?? e)))
      } else {
        getJson<Paged<CatalogRequest>>(`/admin/history/requests?page=${page}&size=${PAGE}`).then(setRequests).catch(e => setError(String(e.message ?? e)))
      }
    }, 200)
    return () => clearTimeout(handle)
  }, [view, filter, page, tick])

  const run = useCallback(async (url: string, done: string) => {
    const attempt = async (force: boolean): Promise<void> => {
      const result = await post(url, { force })
      if ('conflict' in result) {
        setConflict({ ...result.conflict, retry: () => attempt(true) })
        return
      }
      setConflict(null)
      if ('error' in result) {
        setMessage(`Failed: ${result.error}`)
        return
      }
      setMessage(done)
      setSelected(null)
      setTick(t => t + 1)
    }
    await attempt(false)
  }, [])

  const data = view === 'changes' ? changes : requests
  const total = data?.totalElements ?? 0

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">Catalog History</h2>
          <p className="text-sm text-secondary mt-1">
            Every change to the catalog — who made it, from where, and the row before and after. Undo a change, take a row back to a
            version, or undo everything one request did.
          </p>
        </div>
        <div className="flex items-center bg-surface border border-outline-variant rounded-xl overflow-hidden" role="group" aria-label="View">
          {(['changes', 'requests'] as const).map(v => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); setPage(0) }}
              className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${view === v ? 'bg-primary/10 text-primary' : 'text-secondary hover:text-on-surface'}`}>
              {v === 'changes' ? 'Changes' : 'Requests'}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div role="status" className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/30 text-sm text-on-surface">
          {message}
          <button type="button" onClick={() => setMessage(null)} className="text-xs text-secondary hover:text-on-surface">Dismiss</button>
        </div>
      )}
      {error && <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">Failed to load the history: {error}</div>}

      {view === 'changes' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2" role="search" aria-label="Filter changes">
          <select aria-label="Table" value={filter.entityType} onChange={e => narrow({ entityType: e.target.value })} className={input}>
            <option value="">Every table</option>
            {Object.entries(TABLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select aria-label="Source" value={filter.source} onChange={e => narrow({ source: e.target.value })} className={input}>
            <option value="">Every source</option>
            {Object.entries(SOURCES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <input aria-label="Who" placeholder="Who" value={filter.actor} onChange={e => narrow({ actor: e.target.value })} className={input} />
          <input aria-label="Search changes" placeholder="Search…" value={filter.q} onChange={e => narrow({ q: e.target.value })} className={input} />
          {filter.requestId ? (
            <button type="button" onClick={() => narrow({ requestId: '' })} className="text-xs text-primary hover:underline text-left">
              One request · show all
            </button>
          ) : <span />}
        </div>
      )}

      <div className="rounded-2xl border border-outline-variant bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {view === 'changes' ? (
            <table className="w-full text-sm" data-history-changes>
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[11px] font-bold uppercase tracking-widest text-secondary">
                  <th className="px-5 py-3 text-left">When</th>
                  <th className="px-5 py-3 text-left">Who</th>
                  <th className="px-5 py-3 text-left">What</th>
                  <th className="px-5 py-3 text-left">Row</th>
                  <th className="px-5 py-3 text-left">Fields</th>
                  <th className="px-5 py-3 text-left">From</th>
                </tr>
              </thead>
              <tbody>
                {(changes?.content ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-secondary">{changes ? 'No change matches.' : 'Loading…'}</td></tr>
                ) : changes!.content.map(c => (
                  <tr key={c.id} onClick={() => setSelected(c)} className="border-t border-outline-variant hover:bg-primary/5 cursor-pointer align-top">
                    <td className="px-5 py-3 whitespace-nowrap">{when(c.changedAt)}</td>
                    <td className="px-5 py-3 whitespace-nowrap font-medium">{c.actor}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${ACTIONS[c.action].tone}`}>{ACTIONS[c.action].label}</span>
                      <span className="ml-2 text-secondary text-xs">{TABLES[c.entityType] ?? c.entityType}</span>
                    </td>
                    <td className="px-5 py-3">{c.label ?? `#${c.rowId}`}</td>
                    <td className="px-5 py-3 text-xs text-secondary">{c.changedFields.join(', ')}</td>
                    <td className="px-5 py-3 text-xs text-secondary whitespace-nowrap">{SOURCES[c.source] ?? c.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm" data-history-requests>
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-[11px] font-bold uppercase tracking-widest text-secondary">
                  <th className="px-5 py-3 text-left">When</th>
                  <th className="px-5 py-3 text-left">Who</th>
                  <th className="px-5 py-3 text-left">From</th>
                  <th className="px-5 py-3 text-right">Changes</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {(requests?.content ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-secondary">{requests ? 'No change recorded yet.' : 'Loading…'}</td></tr>
                ) : requests!.content.map(r => (
                  <tr key={r.requestId} className="border-t border-outline-variant">
                    <td className="px-5 py-3 whitespace-nowrap">{when(r.at)}</td>
                    <td className="px-5 py-3 font-medium">{r.actor}</td>
                    <td className="px-5 py-3 text-secondary">{SOURCES[r.source] ?? r.source}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{r.changes}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap space-x-3">
                      <button type="button" onClick={() => narrow({ requestId: r.requestId })} className="text-xs text-primary hover:underline">Show changes</button>
                      <button type="button" onClick={() => run(`/admin/history/requests/${r.requestId}/undo`, `Undid the ${r.changes} change${r.changes === 1 ? '' : 's'} of that request.`)}
                        className="text-xs text-error hover:underline">Undo</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {total > PAGE && (
          <div className="px-5 py-3 border-t border-outline-variant flex items-center justify-end gap-2 text-xs">
            <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-outline-variant disabled:opacity-40">Previous</button>
            <span className="text-secondary tabular-nums">Page {page + 1} of {Math.ceil(total / PAGE)}</span>
            <button type="button" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-outline-variant disabled:opacity-40">Next</button>
          </div>
        )}
      </div>

      {selected && (
        <ChangeDetail
          change={selected}
          onClose={() => setSelected(null)}
          onUndo={() => run(`/admin/history/${selected.id}/undo`, 'Change undone.')}
          onRestore={() => run(`/admin/history/${selected.id}/restore`, 'Row restored to that version.')}
          onRequest={() => narrow({ requestId: selected.requestId })}
          onRow={() => narrow({ entityType: selected.entityType, q: '', requestId: '', actor: '', source: '' })}
        />
      )}

      {conflict && (
        <div role="alertdialog" aria-label="Changed since" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-lg w-full rounded-2xl bg-surface border border-outline-variant p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-on-surface">Changed since</h3>
            <p className="text-sm text-secondary">
              Somebody changed {conflict.rows.length === 1 ? 'this row' : 'these rows'} after the change you are undoing. Undoing anyway
              overwrites their work.
            </p>
            <ul className="text-sm text-on-surface list-disc pl-5 max-h-48 overflow-y-auto">
              {conflict.rows.map(r => <li key={r}>{r}</li>)}
            </ul>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConflict(null)} className="px-4 py-2 rounded-lg border border-outline-variant text-sm">Keep their changes</button>
              <button type="button" onClick={() => conflict.retry()} className="px-4 py-2 rounded-lg bg-error text-white text-sm font-semibold">Undo anyway</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChangeDetail({ change, onClose, onUndo, onRestore, onRequest, onRow }: {
  change: CatalogChange
  onClose: () => void
  onUndo: () => void
  onRestore: () => void
  onRequest: () => void
  onRow: () => void
}) {
  const fields = [...new Set([...Object.keys(change.before ?? {}), ...Object.keys(change.after ?? {})])]
  const changed = new Set(change.action === 'UPDATE' ? change.changedFields : fields)
  return (
    <div role="dialog" aria-label="Change" className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-3xl h-full overflow-y-auto bg-surface border-l border-outline-variant p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-secondary">{TABLES[change.entityType] ?? change.entityType} #{change.rowId}</p>
            <h3 className="text-xl font-bold text-on-surface">{change.label ?? `#${change.rowId}`}</h3>
            <p className="text-sm text-secondary mt-1">
              {ACTIONS[change.action].label} by <span className="font-semibold text-on-surface">{change.actor}</span> · {when(change.changedAt)} · {SOURCES[change.source] ?? change.source}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-secondary hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onUndo} className="px-3 py-1.5 rounded-lg bg-error text-white text-xs font-semibold">
            Undo this change
          </button>
          {change.action !== 'DELETE' && (
            <button type="button" onClick={onRestore} className="px-3 py-1.5 rounded-lg border border-outline-variant text-xs font-semibold">
              Restore this version
            </button>
          )}
          <button type="button" onClick={onRequest} className="px-3 py-1.5 rounded-lg border border-outline-variant text-xs">Its whole request</button>
          <button type="button" onClick={onRow} className="px-3 py-1.5 rounded-lg border border-outline-variant text-xs">This table's changes</button>
        </div>

        <table className="w-full text-xs" data-change-fields>
          <thead>
            <tr className="text-[11px] uppercase tracking-widest text-secondary border-b border-outline-variant">
              <th className="py-2 text-left w-40">Field</th>
              <th className="py-2 text-left">Before</th>
              <th className="py-2 text-left">After</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(f => (
              <tr key={f} className={`border-b border-outline-variant align-top ${changed.has(f) ? 'bg-primary/5' : ''}`} data-changed={changed.has(f) || undefined}>
                <td className="py-2 pr-3 font-mono text-secondary">{f}</td>
                <td className="py-2 pr-3"><Value v={change.before?.[f]} absent={!change.before} /></td>
                <td className="py-2"><Value v={change.after?.[f]} absent={!change.after} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Value({ v, absent }: { v: unknown; absent: boolean }) {
  if (absent) return <span className="text-secondary italic">—</span>
  if (v === null || v === undefined) return <span className="text-secondary italic">null</span>
  const text = typeof v === 'string' ? v : JSON.stringify(v)
  return text.includes('\n') || text.length > 120
    ? <pre className="whitespace-pre-wrap break-words font-mono text-[11px] max-h-64 overflow-y-auto bg-surface-container-low rounded p-2">{text}</pre>
    : <span className="break-words font-mono">{text}</span>
}

const input = 'bg-surface-container-highest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none'

function when(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
