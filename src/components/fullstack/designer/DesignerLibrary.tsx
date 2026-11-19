import { useMemo, useState, type DragEvent, type Ref } from 'react'
import type { FullstackPageDef, FullstackPageType, FullstackWidgetDef, TeamTemplate } from '../../../types'
import type { TeamShare } from '../../../hooks/useTeamTemplates'
import { inputClass } from '../controls'
import { MAX_STEPS, MAX_WIDGETS, PAGE_TYPE_META, pageLabel, suggestWidgets, widgetKindDisabledReason } from '../pageLayout'
import { pageParts, wizardStepsOf, type PagePart, type PartCard } from '../pageParts'
import { WIDGET_KINDS } from '../pages/constants'
import { EntitySelect } from '../pages/fields'
import { TemplateGallery } from '../pages/TemplateGallery'
import { useDrawnPages, type PagesModel } from '../pages/usePagesModel'
import { fitWidget, widgetName, type WidgetClip } from '../widgetClipboard'
import { startLibraryDrag, type LibraryDrag } from './dragPayload'
import { t, tn, useLang } from '../../../i18n'

export type LibraryTab = 'pages' | 'widgets' | 'templates'

const WIDGET_GROUPS: { key: string; label: () => string; kinds: FullstackWidgetDef['kind'][] }[] = [
  { key: 'numbers', label: () => t('Numbers'), kinds: ['kpi', 'progress', 'gauge'] },
  { key: 'charts', label: () => t('Charts'), kinds: ['bar', 'donut', 'stacked', 'line', 'pivot', 'funnel', 'timeInState'] },
  { key: 'lists', label: () => t('Lists'), kinds: ['recent', 'top', 'list', 'activity'] },
  { key: 'other', label: () => t('Other'), kinds: ['text', 'links'] },
]

/** The library's tab names, lowercase like the tab ids (the tab capitalises them). */
const TAB_LABELS: Record<LibraryTab | 'parts', () => string> = {
  pages: () => t('pages'),
  widgets: () => t('widgets'),
  templates: () => t('templates'),
  parts: () => t('parts'),
}

const CARD = 'flex w-full items-center gap-2.5 rounded-lg border border-outline-variant bg-surface-container px-2.5 py-2 text-start transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-transparent disabled:hover:border-outline-variant'
const HEADING = 'text-[10px] font-semibold uppercase tracking-wider text-secondary'

const matches = (query: string, ...texts: (string | undefined)[]) => {
  const q = query.trim().toLowerCase()
  return !q || texts.some(text => text?.toLowerCase().includes(q))
}

const atMostWidgets = () => t('At most {n} widgets', { n: MAX_WIDGETS })

/**
 * The designer's library: page types, widgets and whole-layout templates. Every card is
 * draggable (onto the page strip, or a dashboard on the canvas) and clickable — a click or Enter
 * adds it where a drop at the end would. On a tabs, report, record or wizard page the widgets tab
 * holds that page's parts instead: pages to embed, charts, related lists and numbers, fields.
 */
export function DesignerLibrary({ pages, model, tab, onTab, page, pageIndex, entity, onEntity, onSelectPage, onAddWidget, onAddWidgetDef, onAddPart, onChooseType, onAddSuggestion, onAddMyTemplate, onTemplate, onDrag, searchRef, clip = null, onPaste, team }: {
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
  /** Templates shared with the team, and what can be done with them. Absent: no team sections. */
  team?: {
    templates: TeamTemplate[]
    loading: boolean
    error: string | null
    onRetry: () => void
    onShare: (item: TeamShare) => void
    onRemove: (id: number) => void
    onAddPage: (id: number) => void
  }
}) {
  const lang = useLang()
  // A team template whose delete was asked for once — the second click deletes it for everyone.
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const { named, projectOpts } = model
  const entityDef = named.find(e => e.name === entity)
  const isDashboard = page?.type === 'dashboard'
  const widgetCap = (page?.widgets?.length ?? 0) >= MAX_WIDGETS
  const dashboards = pages.map((p, i) => ({ p, i })).filter(({ p }) => p.type === 'dashboard')
  // Ready-made widgets for the picked entity that this dashboard does not show yet.
  const drawnPages = useDrawnPages(pages)
  const suggested = useMemo(
    () => (isDashboard ? suggestWidgets(entityDef, drawnPages, pageIndex, { entities: named, scaffoldOpts: projectOpts }) : []),
    // `lang`: the suggestions' labels and blurbs are in it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDashboard, entityDef, drawnPages, pageIndex, named, projectOpts, lang],
  ).filter(s => matches(query, s.label, s.blurb))

  // Widgets saved in this browser, each fitted to this layout (or why it no longer fits).
  const myWidgets = model.widgetTemplates
    .filter(saved => matches(query, saved.name, WIDGET_KINDS.find(k => k.kind === saved.widget.kind)?.label ?? ''))
    .map(saved => ({ ...saved, fit: fitWidget(saved.widget, pages, named) }))

  const teamPages = (team?.templates ?? []).filter((tpl): tpl is Extract<TeamTemplate, { kind: 'page' }> => tpl.kind === 'page' && matches(query, tpl.name, tpl.createdBy ?? ''))
  const teamWidgets = (team?.templates ?? [])
    .filter((tpl): tpl is Extract<TeamTemplate, { kind: 'widget' }> => tpl.kind === 'widget' && matches(query, tpl.name, tpl.createdBy ?? ''))
    .map(tpl => ({ ...tpl, fit: fitWidget(tpl.content, pages, named) }))
  const by = (tpl: TeamTemplate) => (tpl.createdBy ? ` · ${t('by {name}', { name: tpl.createdBy })}` : '')
  const teamRemove = (tpl: TeamTemplate) => (
    <button
      type="button"
      onClick={() => { if (confirmRemove === tpl.id) { setConfirmRemove(null); team?.onRemove(tpl.id) } else setConfirmRemove(tpl.id) }}
      onBlur={() => setConfirmRemove(prev => (prev === tpl.id ? null : prev))}
      className={`shrink-0 rounded-lg p-1.5 ${confirmRemove === tpl.id ? 'bg-error/10 text-[10px] font-semibold text-error' : 'text-secondary hover:bg-error/5 hover:text-error'}`}
      aria-label={confirmRemove === tpl.id ? t('Delete “{name}” for everyone', { name: tpl.name }) : t('Delete the team template “{name}”', { name: tpl.name })}
      title={confirmRemove === tpl.id ? t('Click again: it goes for the whole team') : t('Delete for the whole team')}
    >
      {confirmRemove === tpl.id ? t('Delete?') : <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">delete</span>}
    </button>
  )
  const shareButton = (item: TeamShare) => {
    const replaces = (team?.templates ?? []).some(tpl => tpl.kind === item.kind && tpl.name.toLowerCase() === item.name.toLowerCase())
    return (
      <button
        type="button"
        onClick={() => team?.onShare(item)}
        className="shrink-0 rounded-lg p-1.5 text-secondary hover:bg-primary/5 hover:text-primary"
        aria-label={replaces ? t('Update the team\'s “{name}”', { name: item.name }) : t('Share “{name}” with the team', { name: item.name })}
        title={replaces ? t('Replace the team’s template of this name with yours') : t('Share with the team')}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">group_add</span>
      </button>
    )
  }

  // The page's own parts, when it is a page that takes some (tabs, report, record, wizard).
  const partGroups = useMemo(
    () => (page && !isDashboard ? pageParts(pages, pageIndex, named) : []),
    // `lang`: the groups' labels and hints are in it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, isDashboard, pages, pageIndex, named, lang],
  )
  const steps = page?.type === 'wizard' ? wizardStepsOf(page, named) : []

  const dragProps = (payload: LibraryDrag, disabled: boolean) => (disabled ? {} : {
    draggable: true,
    onDragStart: (e: DragEvent<HTMLElement>) => { startLibraryDrag(e, payload); onDrag(payload) },
    onDragEnd: () => onDrag(null),
  })

  const tabLabel = (id: LibraryTab) => TAB_LABELS[id === 'widgets' && partGroups.length > 0 ? 'parts' : id]()

  return (
    <aside className="@container flex min-h-0 flex-col border-outline-variant bg-surface-container-lowest lg:w-72 lg:shrink-0 lg:border-e" aria-label={t('Library')} data-designer-library>
      <div className="space-y-2 border-b border-outline-variant p-3">
        <label className="relative block">
          <span className="material-symbols-outlined pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-secondary" style={{ fontSize: '16px' }} aria-hidden="true">search</span>
          <input
            ref={searchRef}
            type="search"
            aria-label={t('Search the library')}
            placeholder={t('Search pages, widgets, templates')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape' && query) { e.preventDefault(); e.stopPropagation(); setQuery('') } }}
            className={`${inputClass()} py-1.5 ps-8 text-xs`}
          />
        </label>
        <div role="tablist" aria-label={t('Library')} className="flex gap-0.5 rounded-lg border border-outline-variant bg-surface-container p-0.5">
          {(['pages', 'widgets', 'templates'] as const).map(id => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => onTab(id)}
              className={`flex-1 rounded-md py-1.5 text-xs capitalize ${tab === id ? 'bg-surface-container-high font-semibold text-on-surface' : 'text-secondary hover:text-on-surface'}`}
            >
              {tabLabel(id)}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3" role="tabpanel" aria-label={t('Library: {tab}', { tab: tabLabel(tab) })}>
        {tab === 'widgets' && partGroups.length > 0 && partGroups.map(group => {
          const cards = group.cards.filter(c => matches(query, c.label, c.blurb))
          return (
            <section key={group.slot} className="space-y-1.5" aria-label={group.label} data-part-group={group.slot}>
              <h3 className={HEADING}>{group.label}</h3>
              <p className="text-[11px] text-secondary">{group.hint}</p>
              {group.cards.length === 0 && <p className="text-[11px] text-secondary">{t('Nothing fits this page yet.')}</p>}
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
                          title={c.reason ?? t('{blurb} — drag onto the page, or click to add it at the end', { blurb: c.blurb })}
                          aria-label={t('Add {name}', { name: c.label })}
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
              <p>{t('Widgets go on a dashboard. Pick one on the canvas, or add a dashboard page.')}</p>
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
                {t('Add a dashboard')}
              </button>
            </div>
          ) : (
            <>
              <label className="block space-y-1">
                <span className={HEADING}>{t('New widgets read')}</span>
                <EntitySelect label={t('New widget entity')} value={entity} options={named.map(e => e.name)} onChange={onEntity} className="w-full" />
              </label>
              {widgetCap && <p className="text-[11px] text-secondary">{t('This dashboard has the most widgets it can have ({n}).', { n: MAX_WIDGETS })}</p>}
              {suggested.length > 0 && (
                <section className="space-y-1.5" aria-label={t('Suggested for {entity}', { entity })}>
                  <h3 className={HEADING}>{t('Suggested for {entity}', { entity })}</h3>
                  <ul className="space-y-1.5" data-widget-suggestions>
                    {suggested.map(s => (
                      <li key={s.key}>
                        <button
                          type="button"
                          {...dragProps({ kind: 'widget', widget: s.widget.kind, def: s.widget }, false)}
                          onClick={() => onAddWidgetDef(s.widget)}
                          title={t('{blurb} — drag onto the dashboard, or click to add it at the end', { blurb: s.blurb })}
                          aria-label={t('Add {name}', { name: s.label })}
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
                <section className="space-y-1.5" aria-label={t('Clipboard')}>
                  <h3 className={HEADING}>{t('Clipboard')}</h3>
                  <button
                    type="button"
                    onClick={onPaste}
                    disabled={widgetCap}
                    title={widgetCap ? atMostWidgets() : t('Paste onto this dashboard, after the selected widget (Ctrl+V)')}
                    aria-label={t('Paste {what}', { what: clip.widgets.length === 1 ? `“${widgetName(clip.widgets[0])}”` : tn(clip.widgets.length, '{n} widget', '{n} widgets') })}
                    className={`${CARD} border-primary/30`}
                    data-library-clipboard
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <span className="material-symbols-outlined" style={{ fontSize: '17px' }} aria-hidden="true">content_paste</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-on-surface">
                        {clip.widgets.length === 1 ? widgetName(clip.widgets[0]) : tn(clip.widgets.length, '{n} widget', '{n} widgets')}
                      </span>
                      <span className="block truncate text-[11px] text-secondary">
                        {clip.from ? t('Copied from {page} · click to paste', { page: clip.from }) : t('Copied from a dashboard · click to paste')}
                      </span>
                    </span>
                  </button>
                </section>
              )}
              {myWidgets.length > 0 && (
                <section className="space-y-1.5" aria-label={t('My widgets')}>
                  <h3 className={HEADING}>{t('My widgets')}</h3>
                  <ul className="space-y-1.5" data-my-widgets>
                    {myWidgets.map(saved => {
                      const kind = WIDGET_KINDS.find(k => k.kind === saved.widget.kind)
                      const reason = 'reason' in saved.fit ? saved.fit.reason : widgetCap ? atMostWidgets() : undefined
                      const def = 'widget' in saved.fit ? saved.fit.widget : saved.widget
                      return (
                        <li key={saved.name} className="flex items-center gap-1">
                          <button
                            type="button"
                            {...dragProps({ kind: 'widget', widget: def.kind, def }, Boolean(reason))}
                            onClick={() => onAddWidgetDef(def)}
                            disabled={Boolean(reason)}
                            title={reason ?? t('Saved in this browser — drag onto the dashboard, or click to add it at the end')}
                            aria-label={t('Add {name}', { name: saved.name })}
                            className={`${CARD} ${reason ? '' : 'cursor-grab'}`}
                            data-my-widget={saved.name}
                          >
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${reason ? 'bg-surface-container text-secondary' : 'bg-primary/10 text-primary'}`}>
                              <span className="material-symbols-outlined" style={{ fontSize: '17px' }} aria-hidden="true">{kind?.icon ?? 'widgets'}</span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-xs font-semibold ${reason ? 'text-secondary' : 'text-on-surface'}`}>{saved.name}</span>
                              <span className="block truncate text-[11px] text-secondary">{reason ?? kind?.label}</span>
                            </span>
                          </button>
                          {team && shareButton({ kind: 'widget', name: saved.name, content: saved.widget })}
                          <button
                            type="button"
                            onClick={() => model.forgetWidgetTemplate(saved.name)}
                            className="shrink-0 rounded p-1 text-secondary hover:bg-error/10 hover:text-error"
                            aria-label={t('Forget {name}', { name: saved.name })}
                            title={t('Forget this saved widget')}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>close</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}
              {teamWidgets.length > 0 && (
                <section className="space-y-1.5" aria-label={t('Team widgets')}>
                  <h3 className={HEADING}>{t('Team widgets')}</h3>
                  <ul className="space-y-1.5" data-team-widgets>
                    {teamWidgets.map(tpl => {
                      const kind = WIDGET_KINDS.find(k => k.kind === tpl.content.kind)
                      const reason = 'reason' in tpl.fit ? tpl.fit.reason : widgetCap ? atMostWidgets() : undefined
                      const def = 'widget' in tpl.fit ? tpl.fit.widget : tpl.content
                      return (
                        <li key={tpl.id} className="flex items-center gap-1">
                          <button
                            type="button"
                            {...dragProps({ kind: 'widget', widget: def.kind, def }, Boolean(reason))}
                            onClick={() => onAddWidgetDef(def)}
                            disabled={Boolean(reason)}
                            title={reason ?? t('Shared with the team{by} — drag onto the dashboard, or click to add it at the end', { by: by(tpl) })}
                            aria-label={t('Add {name}', { name: tpl.name })}
                            className={`${CARD} ${reason ? '' : 'cursor-grab'}`}
                            data-team-widget={tpl.id}
                          >
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${reason ? 'bg-surface-container text-secondary' : 'bg-primary/10 text-primary'}`}>
                              <span className="material-symbols-outlined" style={{ fontSize: '17px' }} aria-hidden="true">{kind?.icon ?? 'widgets'}</span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-xs font-semibold ${reason ? 'text-secondary' : 'text-on-surface'}`}>{tpl.name}</span>
                              <span className="block truncate text-[11px] text-secondary">{reason ?? `${kind?.label ?? tpl.content.kind}${by(tpl)}`}</span>
                            </span>
                          </button>
                          {teamRemove(tpl)}
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
                  <section key={group.key} className="space-y-1.5" aria-label={group.label()}>
                    <h3 className={HEADING}>{group.label()}</h3>
                    <ul className="space-y-1.5">
                      {kinds.map(k => {
                        const reason = widgetCap ? atMostWidgets() : widgetKindDisabledReason(k.kind, entityDef, { entities: named, scaffoldOpts: projectOpts })
                        return (
                          <li key={k.kind}>
                            <button
                              type="button"
                              {...dragProps({ kind: 'widget', widget: k.kind }, Boolean(reason))}
                              onClick={() => onAddWidget(k.kind)}
                              disabled={Boolean(reason)}
                              title={reason ?? t('{blurb} — drag onto the dashboard, or click to add it at the end', { blurb: k.hint })}
                              aria-label={t('Add {name}', { name: k.label.toLowerCase() })}
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
            {model.named.length === 0 && <p className="text-[11px] text-secondary">{t('Pages are built from your entities — name at least one entity first.')}</p>}
            {model.myTemplates.some(mine => matches(query, mine.name)) && (
              <section className="space-y-1.5" aria-label={t('My templates')}>
                <h3 className={HEADING}>{t('My templates')}</h3>
                <ul className="space-y-1.5" data-my-templates>
                  {model.myTemplates.filter(mine => matches(query, mine.name)).map(mine => (
                    <li key={mine.name} className="flex items-center gap-1">
                      <button
                        type="button"
                        {...dragProps({ kind: 'my-template', name: mine.name }, model.atPageCap)}
                        onClick={() => onAddMyTemplate(mine.name)}
                        disabled={model.atPageCap}
                        className={CARD}
                        title={t('Add a page like “{name}”', { name: mine.name })}
                      >
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }} aria-hidden="true">{PAGE_TYPE_META[mine.page.type]?.icon ?? 'web_asset'}</span>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-on-surface">{mine.name}</span>
                      </button>
                      {team && shareButton({ kind: 'page', name: mine.name, content: mine.page })}
                      <button
                        type="button"
                        onClick={() => model.forgetTemplate(mine.name)}
                        className="rounded-lg p-1.5 text-secondary hover:bg-error/5 hover:text-error"
                        aria-label={t('Forget the template “{name}”', { name: mine.name })}
                        title={t('Forget this template')}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">close</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {team && (teamPages.length > 0 || team.error) && (
              <section className="space-y-1.5" aria-label={t('Team templates')}>
                <h3 className={HEADING}>{t('Team templates')}</h3>
                {team.error && (
                  <p className="text-[11px] text-secondary" data-team-error>
                    {t("The team's templates did not load ({error}).", { error: team.error })}{' '}
                    <button type="button" onClick={team.onRetry} className="font-semibold text-primary hover:underline">{t('Try again')}</button>
                  </p>
                )}
                <ul className="space-y-1.5" data-team-templates>
                  {teamPages.map(tpl => (
                    <li key={tpl.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        {...dragProps({ kind: 'team-template', id: tpl.id }, model.atPageCap)}
                        onClick={() => team.onAddPage(tpl.id)}
                        disabled={model.atPageCap}
                        className={CARD}
                        title={t('Add a page like “{name}” — shared with the team{by}', { name: tpl.name, by: by(tpl) })}
                        aria-label={t('Add the team template {name}', { name: tpl.name })}
                        data-team-template={tpl.id}
                      >
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }} aria-hidden="true">{PAGE_TYPE_META[tpl.content.type]?.icon ?? 'web_asset'}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-on-surface">{tpl.name}</span>
                          {tpl.createdBy && <span className="block truncate text-[11px] text-secondary">{t('by {name}', { name: tpl.createdBy })}</span>}
                        </span>
                      </button>
                      {teamRemove(tpl)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {model.suggestions.some(s => matches(query, s.label, s.blurb)) && (
              <section className="space-y-1.5" aria-label={t('Suggested for your entities')}>
                <h3 className={HEADING}>{t('Suggested for your entities')}</h3>
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
            <section className="space-y-1.5" aria-label={t('Page types')}>
              <h3 className={HEADING}>{t('Page types')}</h3>
              <ul className="grid grid-cols-1 gap-1.5 @[15rem]:grid-cols-2" data-page-gallery>
                {(Object.keys(PAGE_TYPE_META) as FullstackPageType[]).filter(type => matches(query, PAGE_TYPE_META[type].label, PAGE_TYPE_META[type].blurb)).map(type => {
                  const meta = PAGE_TYPE_META[type]
                  const reason = model.atPageCap ? t('The layout has the most pages it can have') : model.newTypeReason(type)
                  return (
                    <li key={type}>
                      <button
                        type="button"
                        {...dragProps({ kind: 'page', type }, Boolean(reason))}
                        onClick={() => onChooseType(type)}
                        disabled={Boolean(reason)}
                        title={reason ?? t('{blurb} Drag into the page strip, or click to add it.', { blurb: meta.blurb })}
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
          <section className="space-y-2" aria-label={t('Whole layouts')}>
            <h3 className={HEADING}>{t('Whole layouts')}</h3>
            <p className="text-[11px] text-secondary">
              {pages.length > 0 ? t('Builds a new layout from your entities in place of this one — Undo brings this one back.') : t('Builds a layout from your entities; every page stays editable.')}
            </p>
            {model.named.length === 0
              ? <p className="text-[11px] text-secondary">{t('Name an entity first.')}</p>
              : <TemplateGallery templates={model.layoutTemplates().filter(tpl => matches(query, tpl.template.label, tpl.template.blurb))} onPick={onTemplate} />}
          </section>
        )}
      </div>
      <p className="border-t border-outline-variant px-3 py-2 text-[11px] text-secondary">
        {tab === 'widgets' && partGroups.length > 0 ? t('Drag a part onto the page, or click it to add it at the end.')
          : tab === 'widgets' ? t('Drag a widget onto the dashboard, or click it to add it at the end.')
          : tab === 'pages' ? t('Drag a page into the strip above the canvas, or click to add it.')
            : t('Pick a template to build the whole layout from it.')}
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
    <div {...dragProps} className={`${CARD} cursor-grab`} title={t('{blurb} — drag onto a step of the wizard', { blurb: card.blurb })} data-library-part={card.key}>
      <PartIcon icon={card.icon} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-on-surface">{card.label}</span>
        <span className="block text-[11px] text-secondary">{card.blurb}</span>
      </span>
      <select
        aria-label={t('Step for {name}', { name: card.label })}
        value={step}
        onChange={e => onMove(Number(e.target.value))}
        className="max-w-[6.5rem] shrink-0 rounded border border-outline-variant bg-surface-container-lowest px-1 py-0.5 text-[11px]"
      >
        {step < 0 && <option value={-1} disabled>{t('Not asked')}</option>}
        {steps.map((s, i) => <option key={i} value={i}>{s.title ? t('Step {n} · {title}', { n: i + 1, title: s.title }) : t('Step {n}', { n: i + 1 })}</option>)}
        {steps.length < MAX_STEPS && <option value={steps.length}>{t('New step')}</option>}
      </select>
    </div>
  )
}
