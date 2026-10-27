import { useMemo, useState, type DragEvent, type Ref } from 'react'
import type { FullstackPageDef, FullstackPageType, FullstackWidgetDef } from '../../../types'
import { inputClass } from '../controls'
import { MAX_STEPS, MAX_WIDGETS, PAGE_TYPE_META, pageLabel, suggestWidgets, widgetKindDisabledReason } from '../pageLayout'
import { pageParts, wizardStepsOf, type PagePart, type PartCard } from '../pageParts'
import { WIDGET_KINDS } from '../pages/constants'
import { EntitySelect } from '../pages/fields'
import { TemplateGallery } from '../pages/TemplateGallery'
import type { PagesModel } from '../pages/usePagesModel'
import { fitWidget, widgetName, type WidgetClip } from '../widgetClipboard'
import { startLibraryDrag, type LibraryDrag } from './dragPayload'

export type LibraryTab = 'pages' | 'widgets' | 'templates'

const WIDGET_GROUPS: { label: string; kinds: FullstackWidgetDef['kind'][] }[] = [
  { label: 'Numbers', kinds: ['kpi', 'progress'] },
  { label: 'Charts', kinds: ['bar', 'donut', 'stacked', 'line', 'pivot'] },
  { label: 'Lists', kinds: ['recent', 'top', 'list', 'activity'] },
  { label: 'Other', kinds: ['text', 'links'] },
]

const CARD = 'flex w-full items-center gap-2.5 rounded-lg border border-outline-variant bg-surface-container px-2.5 py-2 text-start transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-transparent disabled:hover:border-outline-variant'
const HEADING = 'text-[10px] font-semibold uppercase tracking-wider text-secondary'

const matches = (query: string, ...texts: (string | undefined)[]) => {
  const q = query.trim().toLowerCase()
  return !q || texts.some(t => t?.toLowerCase().includes(q))
}

/**
 * The designer's library: page types, widgets and whole-layout templates. Every card is
 * draggable (onto the page strip, or a dashboard on the canvas) and clickable — a click or Enter
 * adds it where a drop at the end would. On a tabs, report, record or wizard page the widgets tab
 * holds that page's parts instead: pages to embed, charts, related lists and numbers, fields.
 */
export function DesignerLibrary({ pages, model, tab, onTab, page, pageIndex, entity, onEntity, onSelectPage, onAddWidget, onAddWidgetDef, onAddPart, onChooseType, onAddSuggestion, onAddMyTemplate, onTemplate, onDrag, searchRef, clip = null, onPaste }: {
  pages: FullstackPageDef[]
  model: PagesModel
  tab: LibraryTab
  onTab: (tab: LibraryTab) => void
  /** The page on the canvas — widgets go onto it when it is a dashboard. */
  page: FullstackPageDef | undefined
  /** Where that page sits in the layout. */
  pageIndex: number
  /** The entity new widgets read, and how the library's select changes it. */
  entity: string
  onEntity: (name: string) => void
  onSelectPage: (index: number) => void
  onAddWidget: (kind: FullstackWidgetDef['kind']) => void
  /** Adds a suggested widget, settings and all. */
  onAddWidgetDef: (widget: FullstackWidgetDef) => void
  /** Puts a part on the page on the canvas: at the end, or (a wizard field) into step `at`. */
  onAddPart: (part: PagePart, at?: number) => void
  onChooseType: (type: FullstackPageType) => void
  onAddSuggestion: (key: string) => void
  onAddMyTemplate: (name: string) => void
  onTemplate: (label: string, built: FullstackPageDef[]) => void
  onDrag: (drag: LibraryDrag | null) => void
  searchRef?: Ref<HTMLInputElement>
  /** Copied widgets, offered as a card that pastes them onto the dashboard. */
  clip?: WidgetClip | null
  onPaste?: () => void
}) {
  const [query, setQuery] = useState('')
  const { named, projectOpts } = model
  const entityDef = named.find(e => e.name === entity)
  const isDashboard = page?.type === 'dashboard'
  const widgetCap = (page?.widgets?.length ?? 0) >= MAX_WIDGETS
  const dashboards = pages.map((p, i) => ({ p, i })).filter(({ p }) => p.type === 'dashboard')
  // Ready-made widgets for the picked entity that this dashboard does not show yet.
  const suggested = useMemo(
    () => (isDashboard ? suggestWidgets(entityDef, pages, pageIndex, { entities: named, scaffoldOpts: projectOpts }) : []),
    [isDashboard, entityDef, pages, pageIndex, named, projectOpts],
  ).filter(s => matches(query, s.label, s.blurb))

  // Widgets saved in this browser, each fitted to this layout (or why it no longer fits).
  const myWidgets = model.widgetTemplates
    .filter(t => matches(query, t.name, WIDGET_KINDS.find(k => k.kind === t.widget.kind)?.label ?? ''))
    .map(t => ({ ...t, fit: fitWidget(t.widget, pages, named) }))

  // The page's own parts, when it is a page that takes some (tabs, report, record, wizard).
  const partGroups = useMemo(() => (page && !isDashboard ? pageParts(pages, pageIndex, named) : []), [page, isDashboard, pages, pageIndex, named])
  const steps = page?.type === 'wizard' ? wizardStepsOf(page, named) : []

  const dragProps = (payload: LibraryDrag, disabled: boolean) => (disabled ? {} : {
    draggable: true,
    onDragStart: (e: DragEvent<HTMLElement>) => { startLibraryDrag(e, payload); onDrag(payload) },
    onDragEnd: () => onDrag(null),
  })

  return (
    <aside className="@container flex min-h-0 flex-col border-outline-variant bg-surface-container-lowest lg:w-72 lg:shrink-0 lg:border-e" aria-label="Library" data-designer-library>
      <div className="space-y-2 border-b border-outline-variant p-3">
        <label className="relative block">
          <span className="material-symbols-outlined pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-secondary" style={{ fontSize: '16px' }} aria-hidden="true">search</span>
          <input
            ref={searchRef}
            type="search"
            aria-label="Search the library"
            placeholder="Search pages, widgets, templates"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape' && query) { e.preventDefault(); e.stopPropagation(); setQuery('') } }}
            className={`${inputClass()} py-1.5 ps-8 text-xs`}
          />
        </label>
        <div role="tablist" aria-label="Library" className="flex gap-0.5 rounded-lg border border-outline-variant bg-surface-container p-0.5">
          {(['pages', 'widgets', 'templates'] as const).map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => onTab(t)}
              className={`flex-1 rounded-md py-1.5 text-xs capitalize ${tab === t ? 'bg-surface-container-high font-semibold text-on-surface' : 'text-secondary hover:text-on-surface'}`}
            >
              {t === 'widgets' && partGroups.length > 0 ? 'parts' : t}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3" role="tabpanel" aria-label={`Library: ${tab}`}>
        {tab === 'widgets' && partGroups.length > 0 && partGroups.map(group => {
          const cards = group.cards.filter(c => matches(query, c.label, c.blurb))
          return (
            <section key={group.slot} className="space-y-1.5" aria-label={group.label} data-part-group={group.slot}>
              <h3 className={HEADING}>{group.label}</h3>
              <p className="text-[11px] text-secondary">{group.hint}</p>
              {group.cards.length === 0 && <p className="text-[11px] text-secondary">Nothing fits this page yet.</p>}
              <ul className="space-y-1.5">
                {cards.map(c => (
                  <li key={c.key}>
                    {c.part.kind === 'step-field'
                      ? <StepFieldCard card={c} steps={steps} dragProps={dragProps({ kind: 'part', part: c.part }, false)} onMove={at => onAddPart(c.part, at)} />
                      : (
                        <button
                          type="button"
                          {...dragProps({ kind: 'part', part: c.part }, Boolean(c.reason))}
                          onClick={() => onAddPart(c.part)}
                          disabled={Boolean(c.reason)}
                          title={c.reason ?? `${c.blurb} — drag onto the page, or click to add it at the end`}
                          aria-label={`Add ${c.label}`}
                          className={`${CARD} ${c.reason ? '' : 'cursor-grab'}`}
                          data-library-part={c.key}
                        >
                          <PartIcon icon={c.icon} off={Boolean(c.reason)} />
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-xs font-semibold ${c.reason ? 'text-secondary' : 'text-on-surface'}`}>{c.label}</span>
                            <span className="block text-[11px] text-secondary">{c.reason ?? c.blurb}</span>
                          </span>
                          {!c.reason && <span className="material-symbols-outlined text-secondary/70" style={{ fontSize: '16px' }} aria-hidden="true">drag_indicator</span>}
                        </button>
                      )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}

        {tab === 'widgets' && partGroups.length === 0 && (
          !isDashboard ? (
            <div className="space-y-2 text-[11px] text-secondary" data-library-no-dashboard>
              <p>Widgets go on a dashboard. Pick one on the canvas, or add a dashboard page.</p>
              {dashboards.length > 0 && (
                <ul className="space-y-1">
                  {dashboards.map(({ p, i }) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => onSelectPage(i)} className="text-xs font-semibold text-primary hover:underline">{pageLabel(p)}</button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => onChooseType('dashboard')} disabled={model.atPageCap} className="text-xs font-semibold text-primary hover:underline disabled:opacity-40">
                Add a dashboard
              </button>
            </div>
          ) : (
            <>
              <label className="block space-y-1">
                <span className={HEADING}>New widgets read</span>
                <EntitySelect label="New widget entity" value={entity} options={named.map(e => e.name)} onChange={onEntity} className="w-full" />
              </label>
              {widgetCap && <p className="text-[11px] text-secondary">This dashboard has the most widgets it can have ({MAX_WIDGETS}).</p>}
              {suggested.length > 0 && (
                <section className="space-y-1.5" aria-label={`Suggested for ${entity}`}>
                  <h3 className={HEADING}>Suggested for {entity}</h3>
                  <ul className="space-y-1.5" data-widget-suggestions>
                    {suggested.map(s => (
                      <li key={s.key}>
                        <button
                          type="button"
                          {...dragProps({ kind: 'widget', widget: s.widget.kind, def: s.widget }, false)}
                          onClick={() => onAddWidgetDef(s.widget)}
                          title={`${s.blurb} — drag onto the dashboard, or click to add it at the end`}
                          aria-label={`Add ${s.label}`}
                          className={`${CARD} cursor-grab border-primary/30 bg-primary/5`}
                          data-widget-suggestion={s.key}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <span className="material-symbols-outlined" style={{ fontSize: '17px' }} aria-hidden="true">{s.icon}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-on-surface">{s.label}</span>
                            <span className="block text-[11px] text-secondary">{s.blurb}</span>
                          </span>
                          <span className="material-symbols-outlined text-secondary/70" style={{ fontSize: '16px' }} aria-hidden="true">drag_indicator</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {clip && onPaste && (
                <section className="space-y-1.5" aria-label="Clipboard">
                  <h3 className={HEADING}>Clipboard</h3>
                  <button
                    type="button"
                    onClick={onPaste}
                    disabled={widgetCap}
                    title={widgetCap ? `At most ${MAX_WIDGETS} widgets` : 'Paste onto this dashboard, after the selected widget (Ctrl+V)'}
                    aria-label={`Paste ${clip.widgets.length === 1 ? `“${widgetName(clip.widgets[0])}”` : `${clip.widgets.length} widgets`}`}
                    className={`${CARD} border-primary/30`}
                    data-library-clipboard
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <span className="material-symbols-outlined" style={{ fontSize: '17px' }} aria-hidden="true">content_paste</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-on-surface">
                        {clip.widgets.length === 1 ? widgetName(clip.widgets[0]) : `${clip.widgets.length} widgets`}
                      </span>
                      <span className="block truncate text-[11px] text-secondary">Copied from {clip.from || 'a dashboard'} · click to paste</span>
                    </span>
                  </button>
                </section>
              )}
              {myWidgets.length > 0 && (
                <section className="space-y-1.5" aria-label="My widgets">
                  <h3 className={HEADING}>My widgets</h3>
                  <ul className="space-y-1.5" data-my-widgets>
                    {myWidgets.map(t => {
                      const kind = WIDGET_KINDS.find(k => k.kind === t.widget.kind)
                      const reason = 'reason' in t.fit ? t.fit.reason : widgetCap ? `At most ${MAX_WIDGETS} widgets` : undefined
                      const def = 'widget' in t.fit ? t.fit.widget : t.widget
                      return (
                        <li key={t.name} className="flex items-center gap-1">
                          <button
                            type="button"
                            {...dragProps({ kind: 'widget', widget: def.kind, def }, Boolean(reason))}
                            onClick={() => onAddWidgetDef(def)}
                            disabled={Boolean(reason)}
                            title={reason ?? 'Saved in this browser — drag onto the dashboard, or click to add it at the end'}
                            aria-label={`Add ${t.name}`}
                            className={`${CARD} ${reason ? '' : 'cursor-grab'}`}
                            data-my-widget={t.name}
                          >
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${reason ? 'bg-surface-container text-secondary' : 'bg-primary/10 text-primary'}`}>
                              <span className="material-symbols-outlined" style={{ fontSize: '17px' }} aria-hidden="true">{kind?.icon ?? 'widgets'}</span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-xs font-semibold ${reason ? 'text-secondary' : 'text-on-surface'}`}>{t.name}</span>
                              <span className="block truncate text-[11px] text-secondary">{reason ?? kind?.label}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => model.forgetWidgetTemplate(t.name)}
                            className="shrink-0 rounded p-1 text-secondary hover:bg-error/10 hover:text-error"
                            aria-label={`Forget ${t.name}`}
                            title="Forget this saved widget"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}
              {WIDGET_GROUPS.map(group => {
                const kinds = WIDGET_KINDS.filter(k => group.kinds.includes(k.kind) && matches(query, k.label, k.short, k.hint))
                if (kinds.length === 0) return null
                return (
                  <section key={group.label} className="space-y-1.5" aria-label={group.label}>
                    <h3 className={HEADING}>{group.label}</h3>
                    <ul className="space-y-1.5">
                      {kinds.map(k => {
                        const reason = widgetCap ? `At most ${MAX_WIDGETS} widgets` : widgetKindDisabledReason(k.kind, entityDef, { entities: named, scaffoldOpts: projectOpts })
                        return (
                          <li key={k.kind}>
                            <button
                              type="button"
                              {...dragProps({ kind: 'widget', widget: k.kind }, Boolean(reason))}
                              onClick={() => onAddWidget(k.kind)}
                              disabled={Boolean(reason)}
                              title={reason ?? `${k.hint} — drag onto the dashboard, or click to add it at the end`}
                              aria-label={`Add ${k.label.toLowerCase()}`}
                              className={`${CARD} ${reason ? '' : 'cursor-grab'}`}
                              data-library-widget={k.kind}
                            >
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${reason ? 'bg-surface-container text-secondary' : 'bg-primary/10 text-primary'}`}>
                                <span className="material-symbols-outlined" style={{ fontSize: '17px' }} aria-hidden="true">{k.icon}</span>
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className={`block text-xs font-semibold ${reason ? 'text-secondary' : 'text-on-surface'}`}>{k.label}</span>
                                <span className="block text-[11px] text-secondary">{reason ?? k.hint}</span>
                              </span>
                              {!reason && <span className="material-symbols-outlined text-secondary/70" style={{ fontSize: '16px' }} aria-hidden="true">drag_indicator</span>}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </>
          )
        )}

        {tab === 'pages' && (
          <>
            {model.named.length === 0 && <p className="text-[11px] text-secondary">Pages are built from your entities — name at least one entity first.</p>}
            {model.myTemplates.some(t => matches(query, t.name)) && (
              <section className="space-y-1.5" aria-label="My templates">
                <h3 className={HEADING}>My templates</h3>
                <ul className="space-y-1.5" data-my-templates>
                  {model.myTemplates.filter(t => matches(query, t.name)).map(t => (
                    <li key={t.name} className="flex items-center gap-1">
                      <button
                        type="button"
                        {...dragProps({ kind: 'my-template', name: t.name }, model.atPageCap)}
                        onClick={() => onAddMyTemplate(t.name)}
                        disabled={model.atPageCap}
                        className={CARD}
                        title={`Add a page like “${t.name}”`}
                      >
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }} aria-hidden="true">{PAGE_TYPE_META[t.page.type]?.icon ?? 'web_asset'}</span>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-on-surface">{t.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => model.forgetTemplate(t.name)}
                        className="rounded-lg p-1.5 text-secondary hover:bg-error/5 hover:text-error"
                        aria-label={`Forget the template “${t.name}”`}
                        title="Forget this template"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">close</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {model.suggestions.some(s => matches(query, s.label, s.blurb)) && (
              <section className="space-y-1.5" aria-label="Suggested for your entities">
                <h3 className={HEADING}>Suggested for your entities</h3>
                <ul className="space-y-1.5" data-page-suggestions>
                  {model.suggestions.filter(s => matches(query, s.label, s.blurb)).map(s => (
                    <li key={s.key}>
                      <button
                        type="button"
                        {...dragProps({ kind: 'suggestion', key: s.key }, model.atPageCap)}
                        onClick={() => onAddSuggestion(s.key)}
                        disabled={model.atPageCap}
                        className={`${CARD} border-primary/30 bg-primary/5`}
                        data-suggestion={s.key}
                      >
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '17px' }} aria-hidden="true">{s.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-on-surface">{s.label}</span>
                          <span className="block text-[11px] text-secondary">{s.blurb}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="space-y-1.5" aria-label="Page types">
              <h3 className={HEADING}>Page types</h3>
              <ul className="grid grid-cols-1 gap-1.5 @[15rem]:grid-cols-2" data-page-gallery>
                {(Object.keys(PAGE_TYPE_META) as FullstackPageType[]).filter(t => matches(query, PAGE_TYPE_META[t].label, PAGE_TYPE_META[t].blurb)).map(type => {
                  const meta = PAGE_TYPE_META[type]
                  const reason = model.atPageCap ? 'The layout has the most pages it can have' : model.newTypeReason(type)
                  return (
                    <li key={type}>
                      <button
                        type="button"
                        {...dragProps({ kind: 'page', type }, Boolean(reason))}
                        onClick={() => onChooseType(type)}
                        disabled={Boolean(reason)}
                        title={reason ?? `${meta.blurb} Drag into the page strip, or click to add it.`}
                        className={`${CARD} h-full flex-col items-start gap-0.5 ${reason ? '' : 'cursor-grab'}`}
                        data-library-page-type={type}
                      >
                        <span className={`flex items-center gap-1.5 text-xs font-semibold ${reason ? 'text-secondary' : 'text-on-surface'}`}>
                          <span className={`material-symbols-outlined ${reason ? '' : 'text-primary'}`} style={{ fontSize: '16px' }} aria-hidden="true">{meta.icon}</span>
                          {meta.label}
                        </span>
                        {reason && <span className="text-[10px] text-secondary">{reason}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          </>
        )}

        {tab === 'templates' && (
          <section className="space-y-2" aria-label="Whole layouts">
            <h3 className={HEADING}>Whole layouts</h3>
            <p className="text-[11px] text-secondary">
              {pages.length > 0 ? 'Builds a new layout from your entities in place of this one — Undo brings this one back.' : 'Builds a layout from your entities; every page stays editable.'}
            </p>
            {model.named.length === 0
              ? <p className="text-[11px] text-secondary">Name an entity first.</p>
              : <TemplateGallery templates={model.layoutTemplates.filter(t => matches(query, t.template.label, t.template.blurb))} onPick={onTemplate} />}
          </section>
        )}
      </div>
      <p className="border-t border-outline-variant px-3 py-2 text-[11px] text-secondary">
        {tab === 'widgets' && partGroups.length > 0 ? 'Drag a part onto the page, or click it to add it at the end.'
          : tab === 'widgets' ? 'Drag a widget onto the dashboard, or click it to add it at the end.'
          : tab === 'pages' ? 'Drag a page into the strip above the canvas, or click to add it.'
            : 'Pick a template to build the whole layout from it.'}
      </p>
    </aside>
  )
}


function PartIcon({ icon, off }: { icon: string; off?: boolean }) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${off ? 'bg-surface-container text-secondary' : 'bg-primary/10 text-primary'}`}>
      <span className="material-symbols-outlined" style={{ fontSize: '17px' }} aria-hidden="true">{icon}</span>
    </span>
  )
}

/** A wizard field: dragged onto a step on the canvas, or moved with its step picker. */
function StepFieldCard({ card, steps, dragProps, onMove }: {
  card: PartCard
  steps: { title?: string; fields: string[] }[]
  dragProps: Record<string, unknown>
  onMove: (step: number) => void
}) {
  const name = card.part.kind === 'step-field' ? card.part.field : ''
  const step = steps.findIndex(s => s.fields.includes(name))
  return (
    <div {...dragProps} className={`${CARD} cursor-grab`} title={`${card.blurb} — drag onto a step of the wizard`} data-library-part={card.key}>
      <PartIcon icon={card.icon} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-on-surface">{card.label}</span>
        <span className="block text-[11px] text-secondary">{card.blurb}</span>
      </span>
      <select
        aria-label={`Step for ${card.label}`}
        value={step}
        onChange={e => onMove(Number(e.target.value))}
        className="max-w-[6.5rem] shrink-0 rounded border border-outline-variant bg-surface-container-lowest px-1 py-0.5 text-[11px]"
      >
        {step < 0 && <option value={-1} disabled>Not asked</option>}
        {steps.map((s, i) => <option key={i} value={i}>Step {i + 1}{s.title ? ` · ${s.title}` : ''}</option>)}
        {steps.length < MAX_STEPS && <option value={steps.length}>New step</option>}
      </select>
    </div>
  )
}
