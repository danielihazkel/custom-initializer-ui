import type { FullstackPageDef } from '../../types'
import { describePage, pageLabel } from './pageLayout'

interface Props {
  pages: FullstackPageDef[]
  /** From pageLayoutProblems — shown in the panel and counted as errors by the caller. */
  problems: string[]
  /** Drops the layout, back to the classic shell (undoable by the caller). */
  onClear: () => void
}

const TYPE_META: Record<FullstackPageDef['type'], { icon: string; label: string }> = {
  dashboard: { icon: 'dashboard', label: 'Dashboard' },
  'entity-list': { icon: 'table_rows', label: 'List' },
  tabs: { icon: 'tab', label: 'Tabs' },
}

/**
 * The generated frontend's page layout, read-only for now: it comes with an example (or a preset /
 * shared link that carried one). Without a layout nothing is shown and the app gets the classic
 * shell — a dashboard plus one list page per entity.
 */
export function PageLayoutPanel({ pages, problems, onClear }: Props) {
  if (pages.length === 0) return null
  const visible = pages.filter(p => !p.hidden)
  const hidden = pages.filter(p => p.hidden)

  return (
    <section
      id="fs-pages"
      className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 space-y-3"
      aria-label="Frontend page layout"
      data-page-layout
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-outlined text-primary mt-0.5" style={{ fontSize: '20px' }}>web</span>
          <div>
            <h2 className="text-sm font-bold text-on-surface">Frontend pages</h2>
            <p className="text-[11px] text-secondary">
              The generated app opens on the first page; hidden pages appear only inside a tabs page.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant text-secondary hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors"
          title="Generate the default dashboard plus one list page per entity instead"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>restart_alt</span>
          Use classic layout
        </button>
      </div>

      {problems.length > 0 && (
        <ul className="rounded-lg border border-error/40 bg-error/5 px-3 py-2 space-y-1" role="alert" data-page-layout-problems>
          {problems.map(p => (
            <li key={p} className="flex items-start gap-1.5 text-[11px] text-error">
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>error</span>
              {p}
            </li>
          ))}
        </ul>
      )}

      <ol className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[...visible, ...hidden].map(page => {
          const meta = TYPE_META[page.type] ?? { icon: 'web_asset', label: page.type }
          return (
            <li
              key={page.id}
              className={`flex items-start gap-2.5 rounded-lg border border-outline-variant px-3 py-2 ${page.hidden ? 'opacity-70' : ''}`}
              data-page-id={page.id}
            >
              <span className="material-symbols-outlined text-secondary mt-0.5" style={{ fontSize: '18px' }}>{meta.icon}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-on-surface">{pageLabel(page)}</span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary">{meta.label}</span>
                  {page.hidden && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-surface-container text-secondary">Tab only</span>
                  )}
                </div>
                <p className="text-[11px] text-secondary truncate" title={describePage(page, pages)}>{describePage(page, pages)}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
