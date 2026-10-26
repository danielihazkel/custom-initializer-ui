import { useMemo, useState, type DragEvent, type Ref } from 'react'
import type { FullstackPageDef, FullstackPageType, FullstackWidgetDef } from '../../../types'
import { inputClass } from '../controls'
import { MAX_WIDGETS, PAGE_TYPE_META, pageLabel, suggestWidgets, widgetKindDisabledReason } from '../pageLayout'
import { WIDGET_KINDS } from '../pages/constants'
import { EntitySelect } from '../pages/fields'
import { TemplateGallery } from '../pages/TemplateGallery'
import type { PagesModel } from '../pages/usePagesModel'
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
 * adds it where a drop at the end would.
 */
export function DesignerLibrary({ pages, model, tab, onTab, page, pageIndex, entity, onEntity, onSelectPage, onAddWidget, onAddWidgetDef, onChooseType, onAddSuggestion, onAddMyTemplate, onTemplate, onDrag, searchRef }: {
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
  onChooseType: (type: FullstackPageType) => void
  onAddSuggestion: (key: string) => void
  onAddMyTemplate: (name: string) => void
  onTemplate: (label: string, built: FullstackPageDef[]) => void
  onDrag: (drag: LibraryDrag | null) => void
  searchRef?: Ref<HTMLInputElement>
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
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3" role="tabpanel" aria-label={`Library: ${tab}`}>
        {tab === 'widgets' && (
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
        {tab === 'widgets' ? 'Drag a widget onto the dashboard, or click it to add it at the end.'
          : tab === 'pages' ? 'Drag a page into the strip above the canvas, or click to add it.'
            : 'Pick a template to build the whole layout from it.'}
      </p>
    </aside>
  )
}

