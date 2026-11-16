import { useState } from 'react'
import { EMPTY_ACTIVITY_FILTER, downloadActivityCsv, useActivity, useActivityEvents } from '../../../hooks/useActivity'
import type { ActivityFilter, ActivitySummary, GenerationEvent } from '../../../types'

const DAY_OPTIONS = [1, 7, 30, 90, 365]
const PAGE_SIZE = 50

/** The kinds, in the order the chart stacks them, each with its colour. */
export const KINDS: { id: string; label: string; bar: string; dot: string }[] = [
  { id: 'backend', label: 'Backend', bar: 'bg-primary', dot: 'bg-primary' },
  { id: 'wizard', label: 'Wizard', bar: 'bg-tertiary', dot: 'bg-tertiary' },
  { id: 'multimodule', label: 'Multi-module', bar: 'bg-secondary', dot: 'bg-secondary' },
  { id: 'fullstack', label: 'Fullstack', bar: 'bg-warning', dot: 'bg-warning' },
  { id: 'frontend', label: 'Frontend', bar: 'bg-outline', dot: 'bg-outline' },
]

const ACTIONS = [
  { id: '', label: 'Any action' },
  { id: 'generation', label: 'Generations' },
  { id: 'download', label: 'Downloads' },
  { id: 'patch', label: 'Updates' },
  { id: 'preview', label: 'Previews' },
]

export function ActivityTab() {
  const [days, setDays] = useState<number>(30)
  const { summary, loading, error, reload } = useActivity(days)
  const [filter, setFilter] = useState<ActivityFilter>(EMPTY_ACTIVITY_FILTER)
  const [page, setPage] = useState(0)
  const [tick, setTick] = useState(0)

  function narrow(change: Partial<ActivityFilter>) {
    setFilter(f => ({ ...f, ...change }))
    setPage(0)
  }

  function reloadAll() {
    reload()
    setTick(t => t + 1)
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">Generation Activity</h2>
          <p className="text-sm text-secondary mt-1">
            Every project generated, updated or previewed through this service.
            {summary && summary.retentionDays > 0 && <> Events are kept {summary.retentionDays} days.</>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-surface border border-outline-variant rounded-xl overflow-hidden" role="group" aria-label="Period">
            {DAY_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                aria-pressed={days === d}
                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  days === d ? 'bg-primary/10 text-primary' : 'text-secondary hover:text-on-surface'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={reloadAll}
            className="p-2 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors border border-outline-variant"
            title="Reload"
            aria-label="Reload"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error/10 border border-error/30 text-error text-sm">
          Failed to load activity: {error}
        </div>
      )}

      <SummaryCards summary={summary} loading={loading} />

      <PerDayChart summary={summary} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TopList
          title="By kind"
          icon="category"
          loading={loading}
          items={(summary?.byKind ?? []).filter(k => k.generations + k.previews > 0)
            .map(k => ({ key: kindLabel(k.kind), value: k.generations, note: k.previews ? `+${k.previews} previews` : undefined }))}
          emptyLabel="Nothing generated in this period."
          onPick={label => narrow({ kind: KINDS.find(k => k.label === label)?.id ?? '' })}
        />
        <TopList
          title="By department"
          icon="apartment"
          loading={loading}
          items={(summary?.byDepartment ?? []).map(d => ({ key: d.department, value: d.count }))}
          emptyLabel="Nothing generated in this period."
          onPick={key => narrow({ department: key === '(none)' ? '' : key })}
        />
        <TopList
          title="Top users"
          icon="person"
          loading={loading}
          items={(summary?.topUsers ?? []).map(u => ({ key: u.username, value: u.count }))}
          emptyLabel="No signed-in generations in this period."
          onPick={key => narrow({ username: key })}
        />
        <TopList
          title="Top dependencies"
          icon="trending_up"
          loading={loading}
          items={(summary?.topDependencies ?? []).map(d => ({ key: d.depId, value: d.count }))}
          emptyLabel="Nothing generated in this period."
        />
        <TopList
          title="Boot versions"
          icon="filter_list"
          loading={loading}
          items={(summary?.topBootVersions ?? []).map(v => ({ key: v.bootVersion || '—', value: v.count }))}
          emptyLabel="Nothing generated in this period."
        />
        <TopList
          title="Endpoints"
          icon="api"
          loading={loading}
          items={(summary?.byEndpoint ?? []).map(e => ({ key: e.endpoint, value: e.count }))}
          emptyLabel="Nothing recorded in this period."
          mono
        />
      </div>

      <FailureList summary={summary} loading={loading} onShow={message => narrow({ status: 'FAILURE', q: message.slice(0, 60) })} />

      <EventsSection filter={filter} page={page} tick={tick} onFilter={narrow} onPage={setPage} />
    </div>
  )
}

function kindLabel(kind: string): string {
  return KINDS.find(k => k.id === kind)?.label ?? kind
}

function SummaryCards({ summary, loading }: { summary: ActivitySummary | null; loading: boolean }) {
  const successPct = summary ? Math.round(summary.successRate * 1000) / 10 : 0
  const cards = [
    { label: 'Generations', value: summary ? summary.totalCount.toLocaleString() : '—', icon: 'stacks', color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Previews', value: summary ? summary.previewCount.toLocaleString() : '—', icon: 'visibility', color: 'text-secondary', bg: 'bg-secondary/10' },
    { label: 'Success rate', value: summary ? `${successPct}%` : '—', icon: 'verified', color: 'text-tertiary', bg: 'bg-tertiary/10' },
    { label: 'P50 duration', value: summary ? `${summary.p50Ms} ms` : '—', icon: 'speed', color: 'text-secondary', bg: 'bg-secondary/10' },
    { label: 'P95 duration', value: summary ? `${summary.p95Ms} ms` : '—', icon: 'bolt', color: 'text-error', bg: 'bg-error/10' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map(c => (
        <div key={c.label} className="glass-panel p-5 rounded-2xl flex items-center justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">{c.label}</p>
            <h3 className="text-2xl font-black text-on-surface truncate">{loading ? '…' : c.value}</h3>
          </div>
          <div className={`p-3 rounded-xl ${c.bg} shrink-0`}>
            <span className={`material-symbols-outlined ${c.color}`} style={{ fontSize: '24px' }}>{c.icon}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Generations per day, stacked by kind; a day's previews in its tooltip. */
function PerDayChart({ summary, loading }: { summary: ActivitySummary | null; loading: boolean }) {
  const days = summary?.perDay ?? []
  const max = days.reduce((m, d) => Math.max(m, d.generations), 0)
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm" data-activity-chart>
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>bar_chart</span>
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">Generations per day</h3>
        </div>
        <ul className="flex items-center gap-3 flex-wrap text-[11px] text-secondary">
          {KINDS.map(k => (
            <li key={k.id} className="flex items-center gap-1.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-sm ${k.dot}`} />{k.label}
            </li>
          ))}
        </ul>
      </div>
      {loading ? (
        <p className="text-xs text-secondary">Loading…</p>
      ) : max === 0 ? (
        <p className="text-xs text-secondary">Nothing generated in this period.</p>
      ) : (
        <>
          <div className="flex items-end gap-px h-40" role="img" aria-label={`Generations per day, at most ${max} in a day`}>
            {days.map(d => (
              <div
                key={d.date}
                className="flex-1 min-w-0 h-full flex flex-col justify-end"
                title={`${d.date}: ${d.generations} generation${d.generations === 1 ? '' : 's'}`
                  + KINDS.filter(k => d.byKind[k.id]).map(k => `\n  ${k.label}: ${d.byKind[k.id]}`).join('')
                  + (d.previews ? `\n  (${d.previews} preview${d.previews === 1 ? '' : 's'})` : '')}
                data-day={d.date}
              >
                {KINDS.slice().reverse().map(k => {
                  const n = d.byKind[k.id] ?? 0
                  if (!n) return null
                  return <div key={k.id} className={`${k.bar} w-full first:rounded-t-sm`} style={{ height: `${(n / max) * 100}%` }} />
                })}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-secondary tabular-nums">
            <span>{days[0]?.date}</span>
            <span>at most {max} a day</span>
            <span>{days[days.length - 1]?.date}</span>
          </div>
        </>
      )}
    </div>
  )
}

function TopList({ title, icon, items, loading, emptyLabel, onPick, mono }: {
  title: string
  icon: string
  items: { key: string; value: number; note?: string }[]
  loading: boolean
  emptyLabel: string
  /** Narrows the events list to the row picked. */
  onPick?: (key: string) => void
  mono?: boolean
}) {
  const max = items.reduce((m, i) => Math.max(m, i.value), 0)
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>{icon}</span>
        <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">{title}</h3>
      </div>
      {loading ? (
        <p className="text-xs text-secondary">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-secondary">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {items.map(item => (
            <li key={item.key} className="flex items-center gap-3 text-sm">
              {onPick ? (
                <button
                  type="button"
                  onClick={() => onPick(item.key)}
                  title={`Show the events of ${item.key}`}
                  className={`flex-1 min-w-0 truncate text-left text-on-surface font-medium hover:text-primary hover:underline ${mono ? 'font-mono text-xs' : ''}`}
                >
                  {item.key}
                </button>
              ) : (
                <span className={`flex-1 min-w-0 truncate text-on-surface font-medium ${mono ? 'font-mono text-xs' : ''}`}>{item.key}</span>
              )}
              <div className="flex-1 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${max === 0 ? 0 : Math.round((item.value / max) * 100)}%` }} />
              </div>
              <span className="text-xs font-bold text-secondary w-10 text-right tabular-nums">{item.value}</span>
              {item.note && <span className="text-[10px] text-secondary whitespace-nowrap">{item.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FailureList({ summary, loading, onShow }: { summary: ActivitySummary | null; loading: boolean; onShow: (message: string) => void }) {
  const failures = summary?.failures ?? []
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface shadow-sm overflow-hidden" data-activity-failures>
      <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2">
        <span className="material-symbols-outlined text-error" style={{ fontSize: '20px' }}>error</span>
        <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">Failures by reason</h3>
        {failures.length > 0 && <span className="text-[10px] font-bold py-0.5 px-2 bg-error/10 text-error rounded-full">{failures.reduce((n, f) => n + f.count, 0)}</span>}
      </div>
      {loading ? (
        <p className="px-5 py-6 text-xs text-secondary">Loading…</p>
      ) : failures.length === 0 ? (
        <p className="px-5 py-6 text-xs text-secondary">No failures in this period.</p>
      ) : (
        <ul className="divide-y divide-outline-variant">
          {failures.map(f => (
            <li key={f.message} className="px-5 py-3 flex items-start gap-4">
              <span className="text-xs font-bold text-error tabular-nums w-8 text-right shrink-0">{f.count}×</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface break-words">{f.message}</p>
                <p className="text-[11px] text-secondary mt-0.5">
                  Latest {formatTimestamp(f.lastAt)}
                  {f.lastEndpoint && <> · <span className="font-mono">{f.lastEndpoint}</span></>}
                  {f.lastArtifactId && <> · {f.lastArtifactId}</>}
                  {f.lastUsername && <> · {f.lastUsername}</>}
                </p>
              </div>
              <button type="button" onClick={() => onShow(f.message)} className="text-xs text-primary hover:underline shrink-0">
                Show events
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EventsSection({ filter, page, tick, onFilter, onPage }: {
  filter: ActivityFilter
  page: number
  tick: number
  onFilter: (change: Partial<ActivityFilter>) => void
  onPage: (page: number) => void
}) {
  const { data, loading, error } = useActivityEvents(filter, page, PAGE_SIZE, tick)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const total = data?.totalElements ?? 0
  const first = total === 0 ? 0 : page * PAGE_SIZE + 1
  const last = Math.min(total, (page + 1) * PAGE_SIZE)
  const filtered = Object.values(filter).some(v => v.trim() !== '')

  async function exportCsv() {
    setExporting(true)
    setExportError(null)
    try {
      await downloadActivityCsv(filter)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(false)
    }
  }

  const input = 'bg-surface-container-highest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none'

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface shadow-sm overflow-hidden" data-activity-events>
      <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>history</span>
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">Events</h3>
          <span className="text-[11px] text-secondary tabular-nums">{loading ? '…' : `${first}–${last} of ${total.toLocaleString()}`}</span>
        </div>
        <div className="flex items-center gap-2">
          {filtered && (
            <button type="button" onClick={() => onFilter(EMPTY_FILTER_CHANGE)} className="text-xs text-secondary hover:text-on-surface">
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface hover:border-primary/60 disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-outline-variant grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2" role="search" aria-label="Filter events">
        <input aria-label="From" type="date" value={filter.from} onChange={e => onFilter({ from: e.target.value })} className={input} />
        <input aria-label="To" type="date" value={filter.to} onChange={e => onFilter({ to: e.target.value })} className={input} />
        <select aria-label="Kind" value={filter.kind} onChange={e => onFilter({ kind: e.target.value })} className={input}>
          <option value="">Any kind</option>
          {KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <select aria-label="Action" value={filter.action} onChange={e => onFilter({ action: e.target.value })} className={input}>
          {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <select aria-label="Status" value={filter.status} onChange={e => onFilter({ status: e.target.value })} className={input}>
          <option value="">Any status</option>
          <option value="SUCCESS">Succeeded</option>
          <option value="FAILURE">Failed</option>
        </select>
        <input aria-label="Department" placeholder="Department" value={filter.department} onChange={e => onFilter({ department: e.target.value })} className={input} />
        <input aria-label="User" placeholder="User" value={filter.username} onChange={e => onFilter({ username: e.target.value })} className={input} />
        <input aria-label="Search events" placeholder="Search…" value={filter.q} onChange={e => onFilter({ q: e.target.value })} className={input} />
      </div>

      {(error || exportError) && (
        <div className="px-5 py-3 text-xs text-error bg-error/10">{error ? `Failed to load events: ${error}` : `Export failed: ${exportError}`}</div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant text-[11px] font-bold uppercase tracking-widest text-secondary">
              <th className="px-5 py-3 text-left">When</th>
              <th className="px-5 py-3 text-left">User</th>
              <th className="px-5 py-3 text-left">What</th>
              <th className="px-5 py-3 text-left">Artifact</th>
              <th className="px-5 py-3 text-left">Boot</th>
              <th className="px-5 py-3 text-left">Deps</th>
              <th className="px-5 py-3 text-right">Duration</th>
              <th className="px-5 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-secondary">Loading events…</td></tr>
            ) : (data?.content.length ?? 0) === 0 ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-secondary">
                {filtered ? 'No event matches these filters.' : 'No events recorded yet. Generate a project and check back.'}
              </td></tr>
            ) : data!.content.map(ev => <EventRow key={ev.id} ev={ev} />)}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <div className="px-5 py-3 border-t border-outline-variant flex items-center justify-end gap-2 text-xs">
          <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)}
            className="px-3 py-1.5 rounded-lg border border-outline-variant disabled:opacity-40 hover:border-primary/60">Previous</button>
          <span className="text-secondary tabular-nums">Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
          <button type="button" disabled={last >= total} onClick={() => onPage(page + 1)}
            className="px-3 py-1.5 rounded-lg border border-outline-variant disabled:opacity-40 hover:border-primary/60">Next</button>
        </div>
      )}
    </div>
  )
}

const EMPTY_FILTER_CHANGE: Partial<ActivityFilter> = { ...EMPTY_ACTIVITY_FILTER }

function EventRow({ ev }: { ev: GenerationEvent }) {
  const depList = (ev.dependencyIds || '').split(',').filter(Boolean)
  const extra = [
    ev.wizards ? ev.wizards.split(',').join(', ') : '',
    ev.entityCount != null ? `${ev.entityCount} entit${ev.entityCount === 1 ? 'y' : 'ies'}` : '',
    ev.department ?? '',
  ].filter(Boolean).join(' · ')
  return (
    <tr className="border-t border-outline-variant hover:bg-primary/5 transition-colors align-top">
      <td className="px-5 py-3 text-on-surface whitespace-nowrap">{formatTimestamp(ev.eventTimestamp)}</td>
      <td className="px-5 py-3 whitespace-nowrap">
        {ev.username
          ? <span className="text-on-surface font-medium">{ev.username}</span>
          : <span className="text-secondary italic">anonymous</span>}
      </td>
      <td className="px-5 py-3">
        <div className="flex flex-col">
          <span className="text-on-surface font-medium whitespace-nowrap">
            {kindLabel(ev.kind ?? '')} <span className="text-secondary font-normal">{actionLabel(ev.action)}</span>
          </span>
          <span className="text-[10px] text-secondary font-mono">{ev.endpoint}</span>
          {extra && <span className="text-[10px] text-secondary">{extra}</span>}
        </div>
      </td>
      <td className="px-5 py-3 text-on-surface">
        <div className="flex flex-col">
          <span className="font-medium">{ev.artifactId || '—'}</span>
          <span className="text-[10px] text-secondary">{ev.groupId || ''}</span>
        </div>
      </td>
      <td className="px-5 py-3 text-on-surface whitespace-nowrap">{ev.bootVersion || '—'}</td>
      <td className="px-5 py-3 text-on-surface">
        {depList.length === 0 ? <span className="text-secondary">—</span> : (
          <span title={depList.join(', ')} className="text-xs">
            {depList.slice(0, 3).join(', ')}{depList.length > 3 ? ` +${depList.length - 3}` : ''}
          </span>
        )}
      </td>
      <td className="px-5 py-3 text-on-surface text-right tabular-nums">{ev.durationMs} ms</td>
      <td className="px-5 py-3">
        <StatusBadge status={ev.status} />
        {ev.status === 'FAILURE' && ev.errorMessage && (
          <p className="text-[10px] text-error mt-1 max-w-xs break-words">{ev.errorMessage}</p>
        )}
      </td>
    </tr>
  )
}

function actionLabel(action: string | null): string {
  switch (action) {
    case 'download': return 'download'
    case 'patch': return 'update'
    case 'preview': return 'preview'
    default: return action ?? ''
  }
}

function StatusBadge({ status }: { status: GenerationEvent['status'] }) {
  const ok = status === 'SUCCESS'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
        ok ? 'bg-tertiary/15 text-tertiary' : 'bg-error/15 text-error'
      }`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
        {ok ? 'check_circle' : 'error'}
      </span>
      {status}
    </span>
  )
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
