import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import { highlights, type EditTarget, type LayoutPreview as LayoutPreviewModel, type PreviewBar, type PreviewScreen, type PreviewTable, type PreviewWidget } from './layoutPreviewModel'
import { dropIndicatorClass, useDragReorder, type DragReorder } from './useDragReorder'

export type { EditTarget }

interface Props {
  preview: LayoutPreviewModel
  /** The page shown — follows the row opened in the editor, and the preview's own nav. */
  selected: number
  onSelect: (index: number) => void
  onEdit: (target: EditTarget) => void
  /** The editor part under the pointer (or keyboard focus): its counterpart here is ringed. */
  highlight?: EditTarget | null
  /** The frontend set's look: the default dark-sidebar shell, or the Menora Digital top bar. */
  skin: 'tailwind' | 'menora'
  /** Why the selected page is not in the nav, when it is not ("Tab only", "Opens from a row"). */
  offNavNote?: string
  /** A dashboard widget dragged to another slot of its page. Absent: no grips. */
  onReorderWidget?: (page: number, from: number, to: number) => void
  /** A dashboard widget given another width (1–4 columns). Absent: no handles. */
  onResizeWidget?: (page: number, index: number, span: number) => void
  /** The tailwind shell's navigation: the default sidebar, or a top bar. */
  navStyle?: 'sidebar' | 'topbar'
  /** Sidebar sections with a group name fold. */
  collapsibleGroups?: boolean
}

const MENORA = { purple: '#684eed', yellow: '#ffc700', ink: '#37374e' }
const WIDGET_LIST = 'preview-widgets:'

/**
 * A wireframe of the generated frontend for the page layout being edited — the shell with its
 * nav, and the selected screen with sample data. Everything is drawn from `buildLayoutPreview`;
 * a click on a part of a screen asks the editor to open that page on the matching control.
 */
export function LayoutPreview({ preview, selected, onSelect, onEdit, highlight, skin, offNavNote, onReorderWidget, onResizeWidget, navStyle, collapsibleGroups }: Props) {
  const screen = preview.screens[selected]
  const menora = skin === 'menora'
  const accent = menora ? MENORA.purple : 'var(--color-primary)'
  // The tailwind shell's top bar lays the nav out like the Menora one, on the dark shell colour.
  const topbar = !menora && navStyle === 'topbar'
  const horizontal = menora || topbar
  // One drag context for every dashboard drawn (a tab may embed another): the list key names the page.
  const dnd = useDragReorder((list, from, to) => onReorderWidget?.(Number(list.slice(WIDGET_LIST.length)), from, to))

  const navButton = (item: LayoutPreviewModel['nav'][number]) => {
    const active = item.index === selected
    // The page row itself hovered in the editor (no control under the pointer): its nav entry.
    const lit = highlight != null && highlight.page === item.index && highlight.control === undefined
    return (
      <button
        key={item.index}
        type="button"
        onClick={() => onSelect(item.index)}
        aria-current={active ? 'page' : undefined}
        data-preview-nav={item.index}
        data-preview-highlight={lit ? '' : undefined}
        title={item.start ? `${item.label} — ${preview.strings.startPage}` : item.label}
        className={`${menora
          ? `shrink-0 whitespace-nowrap border-b-2 px-1.5 py-1 text-[10px] font-semibold ${active ? 'border-[#684eed] text-[#684eed]' : 'border-transparent text-[#37374e]/70'}`
          : topbar
            ? `flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-1.5 py-1 text-[10px] ${active ? 'border-amber-300 text-white' : 'border-transparent text-slate-300 hover:text-white'}`
            : `flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-start text-[10px] ${active ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/5'}`
        } ${lit ? 'ring-2 ring-inset ring-primary' : ''}`}
      >
        {!menora && <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{item.icon}</span>}
        <span className="truncate">{item.label}</span>
        {item.start && (
          <span className="material-symbols-outlined ms-auto text-amber-300" style={{ fontSize: '10px' }} aria-label={preview.strings.startPage}>home</span>
        )}
        {item.warning && (
          <span className={`${item.start ? '' : 'ms-auto '}h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400`} aria-label="Has a warning" data-preview-warning />
        )}
      </button>
    )
  }
  // Grouped like the generated nav: a labelled section in the sidebar, a caret item in the Menora
  // top bar (its menu is not drawn — the pages are listed after it, dimmed, instead).
  const navItems = preview.sections.map((section, i) => (
    <div key={i} className={horizontal ? 'flex shrink-0 items-center gap-1' : 'space-y-0.5'} data-preview-nav-group={section.group ?? ''}>
      {section.group && (
        menora ? (
          <span className="shrink-0 whitespace-nowrap px-1 text-[10px] font-semibold text-[#37374e]">
            {section.group}<span aria-hidden="true"> ▾</span>
          </span>
        ) : topbar ? (
          <span className="shrink-0 whitespace-nowrap px-1 text-[8px] font-semibold uppercase tracking-wider text-slate-500">{section.group}</span>
        ) : (
          <div className="px-1.5 pt-1 text-[8px] font-semibold uppercase tracking-wider text-slate-500">
            {collapsibleGroups && <span aria-hidden="true" data-preview-fold>▾ </span>}{section.group}
          </div>
        )
      )}
      {section.items.map(navButton)}
    </div>
  ))

  const body = (
    <div className="min-w-0 flex-1 overflow-hidden p-2.5 space-y-2" data-preview-screen={screen?.type}>
      {offNavNote && (
        <p className="rounded bg-surface-container px-2 py-1 text-[10px] text-secondary">{offNavNote}</p>
      )}
      {screen ? (
        <Screen screen={screen} page={selected} preview={preview} onEdit={onEdit} highlight={highlight} onSelect={onSelect} accent={accent} menora={menora} dnd={onReorderWidget ? dnd : undefined} onResizeWidget={onResizeWidget} />
      ) : (
        <p className="text-[11px] text-secondary">Nothing to show.</p>
      )}
    </div>
  )

  return (
    <div
      dir={preview.rtl ? 'rtl' : 'ltr'}
      className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-sm"
      data-layout-preview
    >
      {/* Window chrome, so the mock reads as "the app", not as part of the editor. */}
      <div className="flex items-center gap-1 border-b border-outline-variant bg-surface-container px-2 py-1" dir="ltr">
        <span className="h-1.5 w-1.5 rounded-full bg-error/60" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
        <span className="ms-2 truncate font-mono text-[9px] text-secondary">localhost:5173</span>
      </div>
      {menora ? (
        <div className="flex min-h-[18rem] flex-col">
          <div className="flex items-center gap-2 border-b border-outline-variant bg-white px-2.5 py-1.5">
            <span className="shrink-0 rounded px-1 text-[10px] font-black" style={{ color: MENORA.purple }}>menora</span>
            <nav className="flex min-w-0 gap-1 overflow-x-auto" aria-label="Preview navigation">{navItems}</nav>
          </div>
          {body}
          <div className="h-3" style={{ background: MENORA.ink }} />
        </div>
      ) : topbar ? (
        <div className="flex min-h-[18rem] flex-col">
          <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ background: '#2B2F4C' }}>
            <span className="h-1 w-6 shrink-0 rounded-full" style={{ background: 'linear-gradient(90deg,#9A83F7,#FEDB41)' }} />
            <nav className="flex min-w-0 gap-1 overflow-x-auto" aria-label="Preview navigation" data-preview-topbar>{navItems}</nav>
          </div>
          {body}
        </div>
      ) : (
        <div className="flex min-h-[18rem]">
          <nav
            className="w-28 shrink-0 space-y-0.5 p-1.5"
            style={{ background: '#2B2F4C' }}
            aria-label="Preview navigation"
          >
            <div className="mb-1.5 h-1 rounded-full" style={{ background: 'linear-gradient(90deg,#9A83F7,#FEDB41)' }} />
            {navItems}
          </nav>
          {body}
        </div>
      )}
    </div>
  )
}

// ── Screens ─────────────────────────────────────────────────────────────────

interface ScreenProps {
  screen: PreviewScreen
  page: number
  preview: LayoutPreviewModel
  onEdit: (target: EditTarget) => void
  highlight: EditTarget | null | undefined
  onSelect: (index: number) => void
  accent: string
  menora: boolean
  /** Inside a tabs page: no second heading. */
  embedded?: boolean
  dnd?: DragReorder
  onResizeWidget?: (page: number, index: number, span: number) => void
}

function Screen({ screen, page, preview, onEdit, highlight, onSelect, accent, menora, embedded, dnd, onResizeWidget }: ScreenProps) {
  // Every part of this screen jumps to its editor control, and lights when that control is hovered.
  const link = { page, onEdit, highlight }
  // The dashboard grid, measured while a widget's edge is dragged to a new width.
  const gridRef = useRef<HTMLDivElement>(null)
  const heading = !embedded && (
    <Editable {...link} control="title" label="Edit the page title" className="block text-start">
      <h3 className="text-[13px] font-bold text-on-surface">
        {screen.title}
        {menora && <span style={{ color: MENORA.yellow }}>.</span>}
      </h3>
      {'description' in screen && screen.description && (
        <p className="text-[10px] text-secondary">{screen.description}</p>
      )}
    </Editable>
  )

  switch (screen.type) {
    case 'broken':
      return (
        <div className="space-y-1">
          {heading}
          <p className="rounded border border-error/40 bg-error/5 px-2 py-1.5 text-[10px] text-error">{screen.message}</p>
        </div>
      )
    case 'dashboard':
      return (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            {heading}
            {screen.period && (
              <Editable {...link} control="dateRange" label="Edit the period picker" className="shrink-0">
                <span className="inline-flex items-center gap-0.5 rounded border border-outline-variant px-1 py-0.5 text-[9px] text-secondary" data-preview-period>
                  <span className="material-symbols-outlined" style={{ fontSize: '10px' }} aria-hidden="true">date_range</span>
                  {screen.period}
                </span>
              </Editable>
            )}
          </div>
          <div ref={gridRef} className="grid grid-cols-4 gap-1.5">
            {screen.widgets.map(w => (
              <Widget
                key={w.index}
                widget={w}
                accent={accent}
                viewAll={preview.strings.viewAll}
                preview={preview}
                menora={menora}
                dnd={dnd}
                list={`${WIDGET_LIST}${page}`}
                gridRef={gridRef}
                onResize={onResizeWidget ? span => onResizeWidget(page, w.index, span) : undefined}
                {...link}
              />
            ))}
          </div>
          {screen.widgets.length === 0 && (
            <Editable {...link} control="widgets" label="Add a widget" className="block w-full">
              <p className="rounded border border-dashed border-outline-variant px-2 py-3 text-center text-[10px] text-secondary">No widgets yet — click to add one</p>
            </Editable>
          )}
        </div>
      )
    case 'entity-list':
      return (
        <div className="space-y-2">
          {heading}
          <MiniTable table={screen.table} preview={preview} accent={accent} menora={menora} link={link} />
        </div>
      )
    case 'tabs':
      return <TabsScreen screen={screen} page={page} preview={preview} onEdit={onEdit} highlight={highlight} onSelect={onSelect} accent={accent} menora={menora} heading={heading} dnd={dnd} onResizeWidget={onResizeWidget} />
    case 'master-detail':
      return (
        <div className="space-y-2">
          {heading}
          <div className="flex gap-1.5">
            <Editable {...link} control="parent" label="Edit the parent entity" className="w-[34%] shrink-0">
              <div className="rounded border border-outline-variant p-1">
                <p className="px-1 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-secondary">{screen.parentTitle}</p>
                {screen.parentItems.map((item, i) => (
                  <p
                    key={i}
                    className={`truncate rounded px-1 py-0.5 text-[10px] ${i === 0 ? 'font-semibold text-white' : 'text-on-surface'}`}
                    style={i === 0 ? { background: accent } : undefined}
                  >
                    {item}
                  </p>
                ))}
              </div>
            </Editable>
            <div className="min-w-0 flex-1 space-y-1">
              {screen.parentDetails && (
                <Editable {...link} control="showParent" label="Edit the parent card" className="block w-full">
                  <div className="rounded border border-outline-variant px-1.5 py-1 text-[8px]" data-preview-parent-card>
                    <p className="mb-0.5 text-[9px] font-semibold text-on-surface">{screen.parentItems[0]}</p>
                    {screen.parentDetails.map(item => (
                      <p key={item.label} className="truncate"><span className="text-secondary">{item.label}:</span> <span className="text-on-surface">{item.value}</span></p>
                    ))}
                  </div>
                </Editable>
              )}
              <Editable {...link} control="child" label="Edit the child entity" className="block w-full">
                <MiniTable table={screen.child} preview={preview} accent={accent} menora={menora} compact />
              </Editable>
            </div>
          </div>
        </div>
      )
    case 'record':
      return <RecordScreen screen={screen} link={link} preview={preview} accent={accent} menora={menora} />
    case 'wizard':
      return <WizardScreen screen={screen} link={link} heading={heading} accent={accent} menora={menora} />
    case 'report':
      return (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            {heading}
            {screen.exportLabel && <FakeButton outline>{screen.exportLabel}</FakeButton>}
          </div>
          <FilterRow filters={screen.filters} chips={screen.presetChips} label={preview.strings.filters} />
          <Editable {...link} control="chart.groupBy" label="Edit the chart" className="block w-full">
            <div className="rounded border border-outline-variant p-2">
              <p className="mb-1 text-[10px] font-semibold text-on-surface">{screen.chartTitle}</p>
              {screen.chart.line
                ? <LineChart points={screen.chart.bars} accent={accent} />
                : <Bars bars={screen.chart.bars} accent={accent} />}
            </div>
          </Editable>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-secondary">
                <th className="text-start font-semibold">{screen.groupLabel}</th>
                <th className="text-end font-semibold">{screen.valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {screen.chart.bars.slice(0, 4).map(b => (
                <tr key={b.label} className="border-t border-outline-variant/60">
                  <td className="truncate text-on-surface">{b.label}</td>
                  <td className="text-end tabular-nums text-on-surface">{b.value}</td>
                </tr>
              ))}
              <tr className="border-t border-outline-variant font-semibold">
                <td className="text-on-surface">{screen.totalLabel}</td>
                <td className="text-end tabular-nums text-on-surface">{screen.chart.bars.reduce((s, b) => s + b.value, 0)}</td>
              </tr>
            </tbody>
          </table>
          {screen.moreCharts.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {screen.moreCharts.map((c, ci) => (
                <Editable key={ci} {...link} control={`chart${ci + 2}.groupBy`} label={`Edit chart ${ci + 2}`} className="block min-w-0">
                  <div className="rounded border border-outline-variant p-1.5" data-preview-chart={ci + 1}>
                    <p className="mb-1 truncate text-[9px] font-semibold text-on-surface">{c.title}</p>
                    {c.line ? <LineChart points={c.bars} accent={accent} /> : <Bars bars={c.bars.slice(0, 4)} accent={accent} />}
                  </div>
                </Editable>
              ))}
            </div>
          )}
        </div>
      )
  }
}

function TabsScreen({ screen, page, preview, onEdit, highlight, onSelect, accent, menora, heading, dnd, onResizeWidget }:
  Omit<ScreenProps, 'screen'> & { screen: Extract<PreviewScreen, { type: 'tabs' }>; heading: ReactNode }) {
  const [active, setActive] = useState(0)
  const current = Math.min(active, Math.max(screen.tabs.length - 1, 0))
  const target = screen.tabs[current]?.target
  const embedded = target != null ? preview.screens[target] : undefined
  return (
    <div className="space-y-2">
      {heading}
      {screen.tabs.length === 0 ? (
        <Editable page={page} onEdit={onEdit} highlight={highlight} control="tabs" label="Add tabs" className="block w-full">
          <p className="rounded border border-dashed border-outline-variant px-2 py-3 text-center text-[10px] text-secondary">No tabs yet</p>
        </Editable>
      ) : (
        <div role="tablist" className="flex gap-3 border-b border-outline-variant">
          {screen.tabs.map((tab, i) => {
            // The tab's card hovered in the editor rings the tab, like an Editable would.
            const lit = highlights(highlight, { page, control: `tab.${i}` })
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === current}
                onClick={() => setActive(i)}
                data-preview-highlight={lit ? '' : undefined}
                className={`-mb-px border-b-2 pb-1 text-[10px] font-semibold ${i === current ? '' : 'border-transparent text-secondary'} ${lit ? HIGHLIGHT : ''}`}
                style={i === current ? { borderColor: accent, color: accent } : undefined}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      )}
      {embedded && target != null && embedded.type !== 'tabs' && (
        <Screen screen={embedded} page={target} preview={preview} onEdit={onEdit} highlight={highlight} onSelect={onSelect} accent={accent} menora={menora} dnd={dnd} onResizeWidget={onResizeWidget} embedded />
      )}
      {screen.tabs.length > 0 && target == null && (
        <p className="text-[10px] text-error">This tab points at no page.</p>
      )}
    </div>
  )
}

/** A record page: its tabs switch between the details and each related list. */
function RecordScreen({ screen, link, preview, accent, menora }: {
  screen: Extract<PreviewScreen, { type: 'record' }>
  link: LinkProps
  preview: LayoutPreviewModel
  accent: string
  menora: boolean
}) {
  const [active, setActive] = useState(0)
  const current = Math.min(active, screen.tabs.length - 1)
  const tabTable = current > 0 ? screen.tabTables[current - 1] : undefined
  return (
    <div className="space-y-2">
      {screen.back && <p className="text-[10px] text-secondary">{preview.rtl ? '→' : '←'} {screen.back}</p>}
      <Editable {...link} control="entity" label="Edit the record entity" className="block text-start">
        <h3 className="text-[13px] font-bold text-on-surface">{screen.heading}</h3>
      </Editable>
      {screen.stats.length > 0 && (
        <Editable {...link} control="headerStats" label="Edit the header numbers" className="block w-full">
          <div className="grid grid-cols-4 gap-1.5" data-preview-stats>
            {screen.stats.map((s, i) => (
              <div key={i} className="min-w-0 rounded border border-outline-variant p-1">
                <p className="truncate text-[8px] text-secondary">{s.title}</p>
                <p className="text-[12px] font-bold tabular-nums text-on-surface">{s.value}</p>
              </div>
            ))}
          </div>
        </Editable>
      )}
      <div className="flex items-end gap-1">
        <div role="tablist" className="flex min-w-0 flex-1 gap-3 border-b border-outline-variant" data-preview-record-tabs>
          {screen.tabs.map((label, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === current}
              onClick={() => setActive(i)}
              className={`-mb-px truncate border-b-2 pb-1 text-[10px] font-semibold ${i === current ? '' : 'border-transparent text-secondary'}`}
              style={i === current ? { borderColor: accent, color: accent } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
        <Editable {...link} control="childTabs" label="Edit the related tabs" className="shrink-0 px-1 text-secondary">
          <span className="material-symbols-outlined" style={{ fontSize: '12px' }} aria-hidden="true">edit</span>
        </Editable>
      </div>
      {current === 0 ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded border border-outline-variant p-2">
          {screen.details.map(d => (
            <div key={d.label} className="min-w-0">
              <dt className="truncate text-[9px] uppercase tracking-wide text-secondary">{d.label}</dt>
              <dd className="truncate text-[10px] text-on-surface">{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : tabTable ? (
        <div data-preview-record-tab={current}>
          <MiniTable table={tabTable} preview={preview} accent={accent} menora={menora} />
        </div>
      ) : (
        <p className="text-[10px] text-error">This tab lists no entity.</p>
      )}
    </div>
  )
}

/** A wizard: its steps can be walked through, ending on the review. */
function WizardScreen({ screen, link, heading, accent, menora }: {
  screen: Extract<PreviewScreen, { type: 'wizard' }>
  link: LinkProps
  heading: ReactNode
  accent: string
  menora: boolean
}) {
  const [active, setActive] = useState(0)
  const last = screen.steps.length - 1
  const step = Math.min(active, last)
  const reviewing = step === last
  const primary = menora ? { background: MENORA.yellow, color: MENORA.ink } : { background: accent, color: 'white' }
  return (
    <div className="space-y-2">
      {heading}
      <div className="flex items-start gap-1">
        <ol className="flex min-w-0 flex-1 flex-wrap gap-1" data-preview-steps>
          {screen.steps.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                aria-current={i === step ? 'step' : undefined}
                onClick={() => setActive(i)}
                className="rounded-full border px-1.5 py-0.5 text-[9px] font-semibold"
                style={i === step ? { borderColor: accent, color: accent } : undefined}
              >
                {i + 1} {s}
              </button>
            </li>
          ))}
        </ol>
        <Editable {...link} control="steps" label="Edit the steps" className="shrink-0 px-1 text-secondary">
          <span className="material-symbols-outlined" style={{ fontSize: '12px' }} aria-hidden="true">edit</span>
        </Editable>
      </div>
      <div className="space-y-1 rounded border border-outline-variant p-2" data-preview-step={reviewing ? 'review' : step}>
        {reviewing ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            {screen.review.map((r, i) => (
              <div key={i} className="min-w-0">
                <dt className="truncate text-[9px] text-secondary">{r.label}</dt>
                <dd className="truncate text-[10px] text-on-surface">{r.value}</dd>
              </div>
            ))}
          </dl>
        ) : (screen.stepFields[step] ?? []).map(label => (
          <div key={label}>
            <p className="text-[9px] text-secondary">{label}</p>
            <div className="h-3 rounded border border-outline-variant bg-surface-container-lowest" />
          </div>
        ))}
        <div className="flex justify-between pt-1">
          <button type="button" onClick={() => setActive(Math.max(0, step - 1))} disabled={step === 0} className="disabled:opacity-40" aria-label="Previous step">
            <FakeButton outline>{screen.back}</FakeButton>
          </button>
          <button type="button" onClick={() => setActive(Math.min(last, step + 1))} disabled={reviewing} aria-label={reviewing ? screen.save : 'Next step'}>
            <FakeButton style={primary}>{reviewing ? screen.save : screen.next}</FakeButton>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/** The ring on the part whose editor control is hovered (a literal, so Tailwind keeps it). */
const HIGHLIGHT = 'outline outline-2 outline-primary ring-4 ring-primary/15'

interface LinkProps {
  page: number
  onEdit: (target: EditTarget) => void
  /** The editor part under the pointer, if any. */
  highlight: EditTarget | null | undefined
}

/** A part of the mock that jumps to its control in the editor, and is ringed while that control
 *  is hovered or focused there. */
function Editable({ page, control, onEdit, highlight, label, className, children }: LinkProps & { control: string; label: string; className?: string; children: ReactNode }) {
  const target = { page, control }
  const lit = highlights(highlight, target)
  return (
    <button
      type="button"
      onClick={() => onEdit(target)}
      title={label}
      aria-label={label}
      data-preview-highlight={lit ? '' : undefined}
      className={`rounded outline-offset-2 hover:outline hover:outline-1 hover:outline-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${lit ? HIGHLIGHT : ''} ${className ?? ''}`}
    >
      {children}
    </button>
  )
}

/** Literal classes, so Tailwind's scanner keeps them. */
const SPAN = ['col-span-1', 'col-span-2', 'col-span-3', 'col-span-4']

const MAX_SPAN = SPAN.length
const TOOL = 'rounded px-1 text-[10px] font-semibold leading-4 text-secondary hover:bg-primary/10 hover:text-primary disabled:opacity-30'

function Widget({ widget, accent, viewAll, preview, menora, dnd, list, gridRef, onResize, ...link }: LinkProps & {
  widget: PreviewWidget
  accent: string
  viewAll: string
  preview: LayoutPreviewModel
  menora: boolean
  /** Drag-to-reorder over the dashboard's widgets, when the editor takes reorders. */
  dnd?: DragReorder
  list: string
  gridRef: RefObject<HTMLDivElement | null>
  /** Sets the widget's width (1–4 columns), when the editor takes resizes. */
  onResize?: (span: number) => void
}) {
  // While the end edge is dragged the card follows the pointer; the width is committed on release.
  const [liveSpan, setLiveSpan] = useState<number | null>(null)
  const span = liveSpan ?? widget.span
  const indicator = dnd?.indicatorFor(list, widget.index) ?? null
  const dragging = dnd?.isDragging(list, widget.index) ?? false
  const spanAt = (clientX: number): number | null => {
    const grid = gridRef.current?.getBoundingClientRect()
    if (!grid || grid.width === 0) return null
    const x = preview.rtl ? grid.right - clientX : clientX - grid.left
    return Math.min(MAX_SPAN, Math.max(1, Math.ceil(x / (grid.width / MAX_SPAN))))
  }
  const startResize = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setLiveSpan(widget.span)
  }
  const moveResize = (e: ReactPointerEvent<HTMLElement>) => {
    if (liveSpan == null) return
    const next = spanAt(e.clientX)
    if (next != null && next !== liveSpan) setLiveSpan(next)
  }
  const endResize = () => {
    if (liveSpan != null && liveSpan !== widget.span) onResize?.(liveSpan)
    setLiveSpan(null)
  }
  return (
    <div
      {...(dnd ? dnd.rowProps(list, widget.index) : {})}
      className={`group relative ${SPAN[span - 1] ?? 'col-span-1'} min-w-0 ${dragging ? 'opacity-40' : ''} ${dropIndicatorClass(indicator)}`}
      data-preview-widget-slot={widget.index}
    >
    <Editable {...link} control={`widget.${widget.index}`} label={`Edit widget ${widget.index + 1}`} className="block h-full w-full min-w-0 text-start">
      <div
        className={`h-full rounded border p-1.5 ${widget.kind === 'broken' ? 'border-error/50 bg-error/5' : 'border-outline-variant bg-surface-container-lowest'}`}
        data-preview-widget={widget.index}
      >
        <p className="truncate text-[9px] font-semibold text-secondary">{widget.title}</p>
        {widget.filters.length > 0 && (
          <p className="truncate text-[8px] text-secondary" data-preview-widget-filter>{widget.filters.join(' · ')}</p>
        )}
        {widget.kind === 'kpi' && <p className="text-[15px] font-bold tabular-nums text-on-surface">{widget.value}</p>}
        {widget.kind === 'kpi' && widget.delta && (
          <p className={`text-[8px] font-semibold ${widget.delta.startsWith('▲') ? 'text-emerald-600' : 'text-error'}`} data-preview-delta>{widget.delta}</p>
        )}
        {widget.kind === 'progress' && (
          <>
            <p className="text-[13px] font-bold tabular-nums text-on-surface">
              {widget.value} <span className="text-[9px] font-normal text-secondary">/ {widget.target}</span>
            </p>
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-surface-container" data-preview-progress>
              <div className="h-full rounded-full" style={{ width: `${Math.min(widget.percent, 100)}%`, background: accent }} />
            </div>
          </>
        )}
        {widget.kind === 'top' && (
          <ol className="mt-0.5 space-y-0.5">
            {widget.rows.slice(0, 4).map((r, i) => (
              <li key={i} className="flex justify-between gap-1 text-[10px] text-on-surface">
                <span className="truncate"><span className="text-secondary">{i + 1}.</span> {r.label}</span>
                <span className="tabular-nums">{r.value}</span>
              </li>
            ))}
          </ol>
        )}
        {widget.kind === 'bar' && <Bars bars={widget.bars.slice(0, 4)} accent={accent} />}
        {widget.kind === 'donut' && <Donut bars={widget.bars} accent={accent} />}
        {widget.kind === 'stacked' && (
          <div className="mt-0.5 space-y-0.5" data-preview-stacked>
            {widget.rows.slice(0, 4).map(row => {
              const max = Math.max(1, ...widget.rows.map(r => r.parts.reduce((a, b) => a + b, 0)))
              return (
                <div key={row.label} className="flex items-center gap-1">
                  <span className="w-12 shrink-0 truncate text-[9px] text-secondary">{row.label}</span>
                  <span className="flex h-1.5 flex-1 overflow-hidden rounded-full">
                    {row.parts.map((v, i) => (
                      <span key={i} style={{ width: `${(v / max) * 100}%`, background: accent, opacity: 1 - (i % 4) * 0.22 }} />
                    ))}
                  </span>
                </div>
              )
            })}
            <p className="truncate text-[8px] text-secondary">{widget.series.join(' · ')}</p>
          </div>
        )}
        {widget.kind === 'text' && (
          <div className="mt-0.5 space-y-0.5" data-preview-text>
            {widget.paragraphs.slice(0, 3).map((p, i) => <p key={i} className="line-clamp-2 text-[9px] text-on-surface">{p}</p>)}
            {widget.paragraphs.length === 0 && <p className="text-[9px] text-secondary">Empty note</p>}
          </div>
        )}
        {widget.kind === 'links' && (
          <div className="mt-0.5 grid grid-cols-3 gap-1" data-preview-links>
            {widget.tiles.slice(0, 6).map((tile, i) => (
              <span key={i} className="flex min-w-0 flex-col items-center gap-0.5 rounded border border-outline-variant px-1 py-1 text-[8px] text-on-surface">
                <span className="material-symbols-outlined" style={{ fontSize: '12px', color: accent }}>{tile.icon}</span>
                <span className="w-full truncate text-center">{tile.label}</span>
              </span>
            ))}
            {widget.tiles.length === 0 && <span className="col-span-3 text-[9px] text-secondary">No pages picked</span>}
          </div>
        )}
        {widget.kind === 'list' && (
          <div className="mt-0.5" data-preview-list>
            <MiniTable table={widget.table} preview={preview} accent={accent} menora={menora} compact />
          </div>
        )}
        {widget.kind === 'line' && <LineChart points={widget.points} accent={accent} />}
        {widget.kind === 'recent' && (
          <ul className="mt-0.5 space-y-0.5">
            {widget.rows.slice(0, 4).map((r, i) => <li key={i} className="truncate text-[10px] text-on-surface">{r}</li>)}
            <li className="text-[9px] font-semibold" style={{ color: accent }}>{viewAll}</li>
          </ul>
        )}
        {widget.kind === 'broken' && <p className="text-[10px] text-error">{widget.message}</p>}
      </div>
    </Editable>
    {(dnd || onResize) && (
      <span
        className="absolute end-1 top-1 flex items-center gap-0.5 rounded bg-surface-container-lowest/90 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
        data-preview-widget-tools
      >
        {dnd && (
          <span
            {...dnd.handleProps(list, widget.index)}
            role="button"
            tabIndex={-1}
            aria-label={`Drag widget ${widget.index + 1}`}
            title="Drag to reorder"
            className="cursor-grab text-secondary"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>drag_indicator</span>
          </span>
        )}
        {onResize && (
          <>
            <button type="button" onClick={() => onResize(widget.span - 1)} disabled={widget.span <= 1} aria-label={`Narrower: widget ${widget.index + 1}`} title="Narrower" className={TOOL}>−</button>
            <button type="button" onClick={() => onResize(widget.span + 1)} disabled={widget.span >= MAX_SPAN} aria-label={`Wider: widget ${widget.index + 1}`} title="Wider" className={TOOL}>+</button>
          </>
        )}
      </span>
    )}
    {onResize && (
      <span
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        className="absolute inset-y-1 end-0 w-1.5 cursor-ew-resize rounded opacity-0 hover:bg-primary/40 group-hover:opacity-100"
        title="Drag to resize"
        aria-hidden="true"
        data-preview-widget-resize
      />
    )}
    </div>
  )
}

/** A small ring of shares, shaded from the accent. */
function Donut({ bars, accent }: { bars: PreviewBar[]; accent: string }) {
  const total = bars.reduce((a, b) => a + b.value, 0) || 1
  const c = 2 * Math.PI * 14
  let offset = 0
  return (
    <div className="mt-0.5 flex items-center gap-1.5" data-preview-donut>
      <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx={18} cy={18} r={14} fill="none" strokeWidth={6} className="stroke-surface-container" />
        {bars.map((b, i) => {
          const length = (b.value / total) * c
          const arc = (
            <circle key={b.label} cx={18} cy={18} r={14} fill="none" strokeWidth={6} stroke={accent}
              strokeOpacity={1 - (i % 5) * 0.18} strokeDasharray={`${length} ${c - length}`} strokeDashoffset={-offset} />
          )
          offset += length
          return arc
        })}
      </svg>
      <ul className="min-w-0 space-y-0.5">
        {bars.slice(0, 3).map(b => <li key={b.label} className="truncate text-[9px] text-secondary">{b.label}</li>)}
      </ul>
    </div>
  )
}

function Bars({ bars, accent }: { bars: PreviewBar[]; accent: string }) {
  const max = Math.max(1, ...bars.map(b => b.value))
  return (
    <div className="mt-0.5 space-y-0.5">
      {bars.map(b => (
        <div key={b.label} className="flex items-center gap-1">
          <span className="w-12 shrink-0 truncate text-[9px] text-secondary">{b.label}</span>
          <span className="h-1.5 rounded-full" style={{ width: `${Math.max(4, (b.value / max) * 100)}%`, background: accent, opacity: 0.85 }} />
        </div>
      ))}
      {bars.length === 0 && <p className="text-[9px] text-secondary">No groups</p>}
    </div>
  )
}

function LineChart({ points, accent }: { points: PreviewBar[]; accent: string }) {
  if (points.length < 2) return <p className="text-[9px] text-secondary">No data</p>
  const max = Math.max(...points.map(p => p.value))
  const min = Math.min(...points.map(p => p.value))
  const span = max - min || 1
  const xy = points.map((p, i) => [(i / (points.length - 1)) * 100, 36 - ((p.value - min) / span) * 30] as const)
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <div className="mt-0.5">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-10 w-full" aria-hidden="true" style={{ direction: 'ltr' }}>
        <path d={`${d} L100,40 L0,40 Z`} fill={accent} opacity={0.12} />
        <path d={d} fill="none" stroke={accent} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[8px] text-secondary" dir="ltr">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  )
}

function FilterRow({ filters, chips, label }: { filters: string[]; chips: string[]; label: string }) {
  if (filters.length === 0 && chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      {filters.length > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded border border-outline-variant px-1 py-0.5 text-[9px] text-secondary">
          <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>filter_alt</span>
          {label}
        </span>
      )}
      {chips.map(c => (
        <span key={c} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary" data-preview-chip>{c}</span>
      ))}
    </div>
  )
}

function FakeButton({ children, outline, style }: { children: ReactNode; outline?: boolean; style?: React.CSSProperties }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${outline ? 'border border-outline-variant text-secondary' : ''}`}
      style={style}
    >
      {children}
    </span>
  )
}

function MiniTable({ table, preview, accent, menora, compact, link }: {
  table: PreviewTable
  preview: LayoutPreviewModel
  accent: string
  menora: boolean
  compact?: boolean
  /** A list page's own table: the column headings, the sort and the side pane jump to their own
   *  controls, the rows to the entity. Without it the table is drawn as one inert block. */
  link?: LinkProps
}) {
  const primary = menora ? { background: MENORA.yellow, color: MENORA.ink } : { background: accent, color: 'white' }
  const part = (control: string, label: string, children: ReactNode, className = 'block w-full') =>
    link ? <Editable {...link} control={control} label={label} className={className}>{children}</Editable> : children
  return (
    <div className="space-y-1 text-start">
      <div className="flex items-center gap-1">
        {compact && <span className="truncate text-[10px] font-semibold text-on-surface">{table.title}</span>}
        {table.showSearch && (
          <span className="min-w-0 flex-1 truncate rounded border border-outline-variant px-1.5 py-0.5 text-[9px] text-secondary">
            {preview.strings.search}
          </span>
        )}
        {!table.showSearch && <span className="flex-1" />}
        {table.hasExport && <FakeButton outline>CSV</FakeButton>}
        {table.newLabel && <FakeButton style={primary}>{table.newLabel}</FakeButton>}
      </div>
      {link ? (
        <div className="flex flex-wrap items-center gap-1">
          <FilterRow filters={table.filters} chips={table.presetChips} label={preview.strings.filters} />
          {part('sort', 'Edit the sort', (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary" data-preview-chip data-preview-sort>
              {table.sort ?? '⇅'}
            </span>
          ), 'inline-flex')}
        </div>
      ) : (
        <FilterRow filters={table.filters} chips={[...table.presetChips, ...(table.sort ? [table.sort] : [])]} label={preview.strings.filters} />
      )}
      <div className={table.sidePane ? 'grid grid-cols-[minmax(0,1fr)_6rem] gap-1' : ''}>
      <div className="min-w-0 space-y-0.5">
      {link && table.view !== 'cards' && table.view !== 'kanban' && table.view !== 'calendar' && part('columns', 'Edit the columns', (
        <div className="grid gap-x-1 text-start text-[9px] font-semibold text-secondary" style={{ gridTemplateColumns: `repeat(${Math.max(1, table.columns.length)}, minmax(0, 1fr))` }} data-preview-columns>
          {table.columns.map(c => <span key={c} className="truncate">{c}</span>)}
        </div>
      ))}
      {part('entity', 'Edit the listed entity', (
      <>
      {table.view === 'cards' ? (
        <div className="grid grid-cols-3 gap-1" data-preview-view="cards">
          {table.rows.map((row, i) => (
            <div key={i} className="rounded border border-outline-variant/60 px-1.5 py-1 text-[9px]">
              <p className="truncate font-semibold text-on-surface">{row[0]}</p>
              {row.slice(1, 3).map((cell, j) => (
                <p key={j} className="truncate text-secondary"><span className="text-secondary/70">{table.columns[j + 1]}:</span> {cell}</p>
              ))}
            </div>
          ))}
        </div>
      ) : table.view === 'kanban' ? (
        <div className="grid gap-1 text-[9px]" style={{ gridTemplateColumns: `repeat(${Math.max(1, table.lanes.length)}, minmax(0, 1fr))` }} data-preview-view="kanban">
          {table.lanes.map((lane, li) => (
            <div key={lane} className="rounded bg-surface-container px-1 py-1">
              <p className="mb-1 truncate font-semibold text-secondary">{lane}</p>
              {table.rows.filter((_, i) => (table.rowLanes.length ? table.rowLanes[i] === li : i % table.lanes.length === li)).map((row, i) => (
                <div key={i} className="mb-1 truncate rounded border border-outline-variant/60 bg-surface-container-lowest px-1 py-0.5 text-on-surface">{row[0]}</div>
              ))}
            </div>
          ))}
        </div>
      ) : table.view === 'calendar' ? (
        <div className="grid grid-cols-7 gap-px rounded border border-outline-variant/60 bg-outline-variant/40 text-[8px]" data-preview-view="calendar">
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="min-h-[1.6rem] bg-surface-container-lowest p-0.5">
              <span className="text-secondary/70">{i + 1}</span>
              {i % 5 === 2 && <div className="mt-0.5 truncate rounded-sm px-0.5 text-[7px] font-semibold" style={primary}>{table.rows[(i / 5) | 0]?.[0]}</div>}
            </div>
          ))}
        </div>
      ) : (
        <table className="w-full table-fixed text-[9px]">
          {!link && (
            <thead>
              <tr className="text-secondary">
                {table.columns.map(c => <th key={c} className="truncate pb-0.5 text-start font-semibold">{c}</th>)}
              </tr>
            </thead>
          )}
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className={`border-t border-outline-variant/60 ${table.sidePane && i === 0 ? 'bg-primary/5' : ''}`}>
                {row.map((cell, j) => <td key={j} className="truncate py-0.5 text-on-surface">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </>
      ))}
      </div>
      {table.sidePane && part('detail', 'Edit where rows open', (
        <aside className="rounded border border-outline-variant px-1.5 py-1 text-start text-[8px]" data-preview-side-pane>
          {table.sidePane.map(item => (
            <p key={item.label} className="truncate"><span className="text-secondary">{item.label}:</span> <span className="text-on-surface">{item.value}</span></p>
          ))}
        </aside>
      ))}
      </div>
    </div>
  )
}
