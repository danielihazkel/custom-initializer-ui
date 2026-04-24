import { useState } from 'react'
import { useActivity } from '../../../hooks/useActivity'
import type { GenerationEvent } from '../../../types'

const DAY_OPTIONS = [1, 7, 30, 90]

export function ActivityTab() {
  const [days, setDays] = useState<number>(30)
  const { summary, recent, loading, error, reload } = useActivity(days, 50)

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">Generation Activity</h2>
          <p className="text-sm text-secondary mt-1">
            Audit trail for every project generated via this service. Use it to see what teams actually build.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-surface border border-outline-variant rounded-xl overflow-hidden">
            {DAY_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  days === d ? 'bg-primary/10 text-primary' : 'text-secondary hover:text-on-surface'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={reload}
            className="p-2 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors border border-outline-variant"
            title="Reload"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopList
          title="Top Dependencies"
          icon="trending_up"
          loading={loading}
          items={(summary?.topDependencies ?? []).map(d => ({ key: d.depId, value: d.count }))}
          emptyLabel="No generations in this window yet."
        />
        <TopList
          title="Boot Versions"
          icon="filter_list"
          loading={loading}
          items={(summary?.topBootVersions ?? []).map(v => ({ key: v.bootVersion || '—', value: v.count }))}
          emptyLabel="No generations in this window yet."
        />
      </div>

      <RecentEventsTable events={recent} loading={loading} />
    </div>
  )
}

function SummaryCards({ summary, loading }: { summary: ReturnType<typeof useActivity>['summary']; loading: boolean }) {
  const successPct = summary ? Math.round(summary.successRate * 1000) / 10 : 0
  const cards = [
    { label: 'Total Generations', value: summary ? summary.totalCount.toLocaleString() : '—', icon: 'stacks', color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Success Rate', value: summary ? `${successPct}%` : '—', icon: 'verified', color: 'text-tertiary', bg: 'bg-tertiary/10' },
    { label: 'P50 Duration', value: summary ? `${summary.p50Ms} ms` : '—', icon: 'speed', color: 'text-secondary', bg: 'bg-secondary/10' },
    { label: 'P95 Duration', value: summary ? `${summary.p95Ms} ms` : '—', icon: 'bolt', color: 'text-error', bg: 'bg-error/10' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

function TopList({ title, icon, items, loading, emptyLabel }: {
  title: string
  icon: string
  items: { key: string; value: number }[]
  loading: boolean
  emptyLabel: string
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
              <span className="flex-1 truncate text-on-surface font-medium">{item.key}</span>
              <div className="flex-1 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full"
                  style={{ width: `${max === 0 ? 0 : Math.round((item.value / max) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-secondary w-10 text-right tabular-nums">{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RecentEventsTable({ events, loading }: { events: GenerationEvent[]; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>history</span>
        <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">Recent Events</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant text-[11px] font-bold uppercase tracking-widest text-secondary">
              <th className="px-5 py-3 text-left">When</th>
              <th className="px-5 py-3 text-left">Endpoint</th>
              <th className="px-5 py-3 text-left">Artifact</th>
              <th className="px-5 py-3 text-left">Boot</th>
              <th className="px-5 py-3 text-left">Deps</th>
              <th className="px-5 py-3 text-right">Duration</th>
              <th className="px-5 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-secondary">Loading events…</td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-secondary">No events recorded yet. Generate a project and check back.</td></tr>
            ) : events.map(ev => {
              const depList = (ev.dependencyIds || '').split(',').filter(Boolean)
              return (
                <tr key={ev.id} className="border-t border-outline-variant hover:bg-primary/5 transition-colors">
                  <td className="px-5 py-3 text-on-surface whitespace-nowrap">{formatTimestamp(ev.eventTimestamp)}</td>
                  <td className="px-5 py-3 text-on-surface font-mono text-xs">{ev.endpoint}</td>
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
                    <StatusBadge status={ev.status} errorMessage={ev.errorMessage} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusBadge({ status, errorMessage }: { status: GenerationEvent['status']; errorMessage: string | null }) {
  const ok = status === 'SUCCESS'
  return (
    <span
      title={ok ? undefined : errorMessage || 'Failure'}
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
