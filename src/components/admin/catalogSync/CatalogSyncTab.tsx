import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAuthHeaders, handle401, invalidateAdminCache } from '../../../hooks/useAdminResource'
import { invalidateMetadata } from '../../../hooks/useMetadata'
import { DiffContentViewer } from '../../DiffContentViewer'
import { useAdminKind } from '../AdminKindContext'
import type { CatalogSyncDetail, CatalogSyncReport, CatalogSyncRow, CatalogSyncStatus, CatalogSyncTable } from '../../../types'

/**
 * Where the catalog's rows — dependency groups and entries, sub-options, compatibility rules, file
 * contributions and build customizations — stand against the ones this release ships
 * (`/admin/catalog-sync`, *Catalog sync* in backend/CLAUDE.md). A row nobody edited follows the
 * release by itself; this screen is for the rest: take the shipped version, or keep your own (it is
 * then no longer reported, and never replaced).
 */
export const STATUSES: Record<CatalogSyncStatus, { label: string; tone: string; hint: string }> = {
  DIFFERS: { label: 'Differs', tone: 'bg-warning/15 text-warning', hint: 'Edited here, or from before the release tracked it' },
  MISSING: { label: 'Missing', tone: 'bg-primary/15 text-primary', hint: 'Shipped, never added to this database' },
  PARENT_GONE: { label: 'Parent gone', tone: 'bg-error/15 text-error', hint: 'Its dependency (or its group) is not in this catalog, so it is not added' },
  DELETED: { label: 'Deleted', tone: 'bg-error/15 text-error', hint: 'Added once, deleted since' },
  KEPT: { label: 'Kept', tone: 'bg-tertiary/15 text-tertiary', hint: 'Yours: no longer replaced' },
  IN_STEP: { label: 'In step', tone: 'bg-surface-container-high text-secondary', hint: 'The shipped row' },
}
const ORDER: CatalogSyncStatus[] = ['DIFFERS', 'MISSING', 'PARENT_GONE', 'DELETED', 'KEPT', 'IN_STEP']
/** In the order the sync writes them: a row comes after what it needs. */
const TABLES: Record<CatalogSyncTable, string> = {
  DEPENDENCY_GROUP: 'Dependency group',
  DEPENDENCY_ENTRY: 'Dependency',
  SUB_OPTION: 'Sub-option',
  COMPATIBILITY_RULE: 'Compatibility rule',
  FILE_CONTRIBUTION: 'File contribution',
  BUILD_CUSTOMIZATION: 'Build customization',
}
const TABLE_ORDER = Object.keys(TABLES) as CatalogSyncTable[]
/** Fields shown in the detail table; `content` gets a diff of its own and `id` says nothing. */
const HIDDEN_FIELDS = new Set(['id', 'content'])

async function getJson<T>(url: string): Promise<T> {
  const res = handle401(await fetch(url, { headers: { Accept: 'application/json', ...getAuthHeaders() } }))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

async function post(url: string, body: object): Promise<{ ok: true; count: number; skipped: CatalogSyncRow[] } | { error: string }> {
  const res = handle401(await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  }))
  const data = (await res.json().catch(() => null)) as
    { detail?: string; written?: number; marked?: number; skipped?: CatalogSyncRow[] } | null
  if (!res.ok) return { error: data?.detail ?? `HTTP ${res.status}` }
  // The catalog moved: the other admin tabs and the generator read it afresh.
  invalidateAdminCache()
  invalidateMetadata()
  return { ok: true, count: data?.written ?? data?.marked ?? 0, skipped: data?.skipped ?? [] }
}

export function CatalogSyncTab() {
  const { kind } = useAdminKind()
  const [report, setReport] = useState<CatalogSyncReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState<Set<CatalogSyncStatus>>(() => new Set(['DIFFERS', 'MISSING']))
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [open, setOpen] = useState<CatalogSyncRow | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  // What the last "take shipped" could not write: rows whose dependency or group is not there.
  const [skipped, setSkipped] = useState<CatalogSyncRow[]>([])
  const [table, setTable] = useState<CatalogSyncTable | 'ALL'>('ALL')
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    setError(null)
    getJson<CatalogSyncReport>('/admin/catalog-sync')
      .then(r => { if (live) setReport(r) })
      .catch(e => { if (live) setError(String(e.message ?? e)) })
    return () => { live = false }
  }, [tick])

  // The rows of the kind the admin is looking at (the sidebar's Backend / Frontend switch).
  const ofKind = useMemo(() => (report?.rows ?? []).filter(r => r.kind === kind), [report, kind])
  // …and of the table picked. The status counts follow it; the table counts say what is out of step where.
  const ofTable = useMemo(() => (table === 'ALL' ? ofKind : ofKind.filter(r => r.table === table)), [ofKind, table])
  const counts = useMemo(() => {
    const out: Partial<Record<CatalogSyncStatus, number>> = {}
    for (const r of ofTable) out[r.status] = (out[r.status] ?? 0) + 1
    return out
  }, [ofTable])
  const openByTable = useMemo(() => {
    const out: Partial<Record<CatalogSyncTable, number>> = {}
    for (const r of ofKind) if (r.status !== 'IN_STEP' && r.status !== 'KEPT') out[r.table] = (out[r.table] ?? 0) + 1
    return out
  }, [ofKind])
  const rows = useMemo(() => ofTable.filter(r => shown.has(r.status)), [ofTable, shown])
  const pickedRows = rows.filter(r => picked.has(r.key))
  const outOfStep = (counts.DIFFERS ?? 0) + (counts.MISSING ?? 0)
  // What "every shipped row" takes: both catalogs, as the server counts them.
  const outOfStepAll = (report?.summary.DIFFERS ?? 0) + (report?.summary.MISSING ?? 0)

  const act = useCallback(async (url: string, body: object, done: (n: number) => string) => {
    setBusy(true)
    try {
      const result = await post(url, body)
      if ('error' in result) {
        setMessage(`Failed: ${result.error}`)
        return
      }
      setMessage(done(result.count))
      setSkipped(result.skipped)
      setPicked(new Set())
      setOpen(null)
      setConfirmAll(false)
      setTick(t => t + 1)
    } finally {
      setBusy(false)
    }
  }, [])

  const apply = (keys: string[]) => act('/admin/catalog-sync/apply', { keys },
    n => `Took the shipped version of ${n} row${n === 1 ? '' : 's'}.`)
  const keep = (keys: string[], kept: boolean) => act('/admin/catalog-sync/keep', { keys, kept },
    n => kept ? `Kept ${n} row${n === 1 ? '' : 's'} as your own.` : `${n} row${n === 1 ? ' follows' : 's follow'} the release again.`)

  const toggleStatus = (s: CatalogSyncStatus) => {
    setShown(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s); else next.add(s)
      return next
    })
  }
  const togglePick = (key: string) => {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }
  const allPicked = rows.length > 0 && rows.every(r => picked.has(r.key))

  return (
    <div className="space-y-6 animate-fade-in-up" data-catalog-sync>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">Catalog Sync</h2>
          <p className="text-sm text-secondary mt-1 max-w-3xl">
            The catalog this release ships — dependency groups and dependencies, sub-options, compatibility rules, file contributions and
            build customizations — against this database. A row nobody edited follows the release on start; the rows below are the ones
            that need your call — take the shipped version, or keep your own.
          </p>
        </div>
        <button type="button" disabled={busy || outOfStepAll === 0} onClick={() => setConfirmAll(true)} data-sync-apply-all
          className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-40">
          Take every shipped row ({outOfStepAll})
        </button>
      </div>

      {report && !report.enabled && (
        <div role="status" data-sync-off className="p-3 rounded-xl bg-warning/10 border border-warning/30 text-sm text-on-surface">
          The sync is switched off on this server (<code className="font-mono">initializr.catalog.sync=off</code>): nothing follows the release by
          itself. You can still take shipped rows here.
        </div>
      )}
      {message && (
        <div role="status" className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/30 text-sm text-on-surface">
          {message}
          <button type="button" onClick={() => { setMessage(null); setSkipped([]) }} className="text-xs text-secondary hover:text-on-surface">Dismiss</button>
        </div>
      )}
      {skipped.length > 0 && (
        <div role="status" data-sync-skipped className="p-3 rounded-xl bg-warning/10 border border-warning/30 text-sm text-on-surface space-y-1">
          <p className="font-semibold">
            {skipped.length} row{skipped.length === 1 ? ' was' : 's were'} not written: what {skipped.length === 1 ? 'it belongs' : 'they belong'} to is not in this catalog.
            Take the dependency (or the group) as well, and they can follow.
          </p>
          <ul className="list-disc ps-5 text-xs">
            {skipped.map(r => (
              <li key={r.key}><span className="font-mono">{r.label}</span>{r.reason ? ` — ${r.reason}` : ''}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">Failed to load the catalog sync: {error}</div>}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show rows of">
        {(['ALL', ...TABLE_ORDER] as const).map(id => (
          <button key={id} type="button" aria-pressed={table === id} onClick={() => setTable(id)} data-sync-table={id}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${table === id
              ? 'border-primary/40 bg-primary/10 text-on-surface' : 'border-outline-variant text-secondary hover:text-on-surface'}`}>
            {id === 'ALL' ? 'Every table' : TABLES[id]}
            {id !== 'ALL' && (openByTable[id] ?? 0) > 0 && <span className="tabular-nums opacity-70"> {openByTable[id]}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Show rows that are">
        {ORDER.map(s => (
          <button key={s} type="button" aria-pressed={shown.has(s)} onClick={() => toggleStatus(s)} title={STATUSES[s].hint}
            data-sync-status={s}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${shown.has(s)
              ? 'border-primary/40 bg-primary/10 text-on-surface' : 'border-outline-variant text-secondary hover:text-on-surface'}`}>
            {STATUSES[s].label} <span className="tabular-nums opacity-70">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {pickedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-outline-variant bg-surface-container-low" data-sync-bulk>
          <span className="text-sm text-on-surface mr-2">{pickedRows.length} picked</span>
          <button type="button" disabled={busy} onClick={() => apply(pickedRows.map(r => r.key))}
            className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold disabled:opacity-40">Take shipped</button>
          <button type="button" disabled={busy} onClick={() => keep(pickedRows.filter(r => r.status !== 'KEPT').map(r => r.key), true)}
            className="px-3 py-1.5 rounded-lg border border-outline-variant text-xs font-semibold disabled:opacity-40">Keep mine</button>
          {pickedRows.some(r => r.status === 'KEPT') && (
            <button type="button" disabled={busy} onClick={() => keep(pickedRows.filter(r => r.status === 'KEPT').map(r => r.key), false)}
              className="px-3 py-1.5 rounded-lg border border-outline-variant text-xs disabled:opacity-40">Follow the release again</button>
          )}
          <button type="button" onClick={() => setPicked(new Set())} className="ml-auto text-xs text-secondary hover:text-on-surface">Clear</button>
        </div>
      )}

      <div className="rounded-2xl border border-outline-variant bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-sync-rows>
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant text-[11px] font-bold uppercase tracking-widest text-secondary">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" aria-label="Pick every row shown" checked={allPicked} disabled={rows.length === 0}
                    onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map(r => r.key)))} />
                </th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Row</th>
                <th className="px-4 py-3 text-left">Dependency</th>
                <th className="px-4 py-3 text-left">Table</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-secondary">
                  {!report ? 'Loading…' : outOfStep === 0 ? 'Every shipped row is in step, or kept as yours.' : 'No row with the statuses picked.'}
                </td></tr>
              ) : rows.map(r => (
                <tr key={r.key} className="border-t border-outline-variant align-top" data-sync-row={r.key}>
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Pick ${r.label}`} checked={picked.has(r.key)} onChange={() => togglePick(r.key)} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUSES[r.status].tone}`}>{STATUSES[r.status].label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="font-mono break-all">{r.label}</span>
                    {r.reason && <span className="block text-error mt-0.5" data-sync-reason>{r.reason}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-secondary">{r.dependencyId ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-secondary whitespace-nowrap">{TABLES[r.table]}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setOpen(r)} className="text-xs text-primary hover:underline">Compare</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <RowDetail row={open} busy={busy} onClose={() => setOpen(null)}
          onApply={() => apply([open.key])}
          onKeep={kept => keep([open.key], kept)} />
      )}

      {confirmAll && (
        <div role="alertdialog" aria-label="Take every shipped row" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-lg w-full rounded-2xl bg-surface border border-outline-variant p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-on-surface">Take every shipped row?</h3>
            <p className="text-sm text-secondary">
              {outOfStepAll} row{outOfStepAll === 1 ? '' : 's'} that differ or are missing — of both the backend and the frontend catalog — become what this
              release ships. Edits made here to those rows are replaced (the History tab can undo it). Rows you kept and rows deleted on purpose are
              left alone.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmAll(false)} className="px-4 py-2 rounded-lg border border-outline-variant text-sm">Cancel</button>
              <button type="button" disabled={busy} data-sync-confirm-all
                onClick={() => act('/admin/catalog-sync/apply', { all: true }, n => `Took the shipped version of ${n} row${n === 1 ? '' : 's'}.`)}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold disabled:opacity-40">Take them all</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** One row: the shipped entity beside the database's, field by field, and its content as a diff. */
function RowDetail({ row, busy, onClose, onApply, onKeep }: {
  row: CatalogSyncRow
  busy: boolean
  onClose: () => void
  onApply: () => void
  onKeep: (kept: boolean) => void
}) {
  const [detail, setDetail] = useState<CatalogSyncDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    getJson<CatalogSyncDetail>(`/admin/catalog-sync/${encodeURIComponent(row.key)}`)
      .then(d => { if (live) setDetail(d) })
      .catch(e => { if (live) setError(String(e.message ?? e)) })
    return () => { live = false }
  }, [row.key])

  const shipped = detail?.shipped ?? null
  const current = detail?.current ?? null
  const fields = [...new Set([...Object.keys(shipped ?? {}), ...Object.keys(current ?? {})])].filter(f => !HIDDEN_FIELDS.has(f))
  const shippedContent = text(shipped?.content)
  const currentContent = text(current?.content)
  const hasContent = shippedContent !== null || currentContent !== null

  return (
    <div role="dialog" aria-label="Compare row" className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-4xl h-full overflow-y-auto bg-surface border-l border-outline-variant p-6 space-y-5" onClick={e => e.stopPropagation()}
        data-sync-detail>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-secondary">{TABLES[row.table]}{row.dependencyId ? ` · ${row.dependencyId}` : ''}</p>
            <h3 className="text-lg font-bold text-on-surface font-mono break-all">{row.label}</h3>
            <p className="text-sm text-secondary mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase mr-2 ${STATUSES[row.status].tone}`}>{STATUSES[row.status].label}</span>
              {row.reason ?? STATUSES[row.status].hint}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-secondary hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {row.status !== 'IN_STEP' && (
            // Alone, a row whose dependency or group is gone cannot be written: pick it with that row in the list.
            <button type="button" disabled={busy || row.status === 'PARENT_GONE'} onClick={onApply}
              title={row.status === 'PARENT_GONE' ? `Take what it belongs to first: ${row.reason ?? ''}` : undefined}
              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold disabled:opacity-40">
              Take shipped
            </button>
          )}
          {row.status === 'KEPT' ? (
            <button type="button" disabled={busy} onClick={() => onKeep(false)} className="px-3 py-1.5 rounded-lg border border-outline-variant text-xs disabled:opacity-40">
              Follow the release again
            </button>
          ) : row.status !== 'IN_STEP' && (
            <button type="button" disabled={busy} onClick={() => onKeep(true)} className="px-3 py-1.5 rounded-lg border border-outline-variant text-xs font-semibold disabled:opacity-40">
              Keep mine
            </button>
          )}
        </div>

        {error && <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">Failed to load the row: {error}</div>}
        {!detail && !error && <p className="text-sm text-secondary">Loading…</p>}

        {detail && (
          <>
            <table className="w-full text-xs" data-sync-fields>
              <thead>
                <tr className="text-[11px] uppercase tracking-widest text-secondary border-b border-outline-variant">
                  <th className="py-2 text-left w-40">Field</th>
                  <th className="py-2 text-left">This database</th>
                  <th className="py-2 text-left">Shipped</th>
                </tr>
              </thead>
              <tbody>
                {fields.map(f => {
                  const changed = JSON.stringify(current?.[f] ?? null) !== JSON.stringify(shipped?.[f] ?? null)
                  return (
                    <tr key={f} className={`border-b border-outline-variant align-top ${changed ? 'bg-primary/5' : ''}`} data-changed={changed || undefined}>
                      <td className="py-2 pr-3 font-mono text-secondary">{f}</td>
                      <td className="py-2 pr-3"><Value v={current?.[f]} absent={!current} /></td>
                      <td className="py-2"><Value v={shipped?.[f]} absent={!shipped} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {hasContent && (
              <div className="space-y-2" data-sync-content>
                <p className="text-[11px] uppercase tracking-widest text-secondary">Content — this database → shipped</p>
                {currentContent === shippedContent ? (
                  <p className="text-sm text-secondary">The content is the same; the difference is in the fields above.</p>
                ) : (
                  <div className="rounded-xl border border-outline-variant overflow-hidden">
                    <DiffContentViewer
                      status={currentContent === null ? 'added' : shippedContent === null ? 'removed' : 'modified'}
                      oldContent={currentContent ?? ''}
                      newContent={shippedContent ?? ''}
                      path={String(shipped?.targetPath ?? current?.targetPath ?? '')}
                      wrap
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function text(v: unknown): string | null {
  return typeof v === 'string' ? v.replace(/\r\n/g, '\n') : null
}

function Value({ v, absent }: { v: unknown; absent: boolean }) {
  if (absent) return <span className="text-secondary italic">—</span>
  if (v === null || v === undefined) return <span className="text-secondary italic">null</span>
  const t = typeof v === 'string' ? v : JSON.stringify(v)
  return t.includes('\n') || t.length > 120
    ? <pre className="whitespace-pre-wrap break-words font-mono text-[11px] max-h-48 overflow-y-auto bg-surface-container-low rounded p-2">{t}</pre>
    : <span className="break-words font-mono">{t}</span>
}
