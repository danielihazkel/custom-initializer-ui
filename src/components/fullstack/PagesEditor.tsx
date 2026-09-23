import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  FullstackAgg,
  FullstackBucket,
  FullstackChartDef,
  FullstackDateRange,
  FullstackEntityDef,
  FullstackNavIcon,
  FullstackPageDef,
  FullstackPageType,
  FullstackWidgetDef,
} from '../../types'
import { ConfirmDialog } from '../ConfirmDialog'
import { inputClass } from './controls'
import { cssEscape } from './focus'
import { buildLayoutPreview } from './layoutPreviewModel'
import { LayoutPreview, type EditTarget } from './LayoutPreview'
import { moveItem } from './reorder'
import { useStableKeys } from './rowKeys'
import { focusWithoutClipping, scrollToElement } from './scroll'
import { useDragReorder } from './useDragReorder'
import {
  DATE_RANGES,
  DEFAULT_NAV_ICON,
  MAX_CHARTS,
  MAX_GROUP,
  MAX_HEADER_STATS,
  MAX_STEPS,
  MAX_PAGES,
  MAX_RECENT_LIMIT,
  MAX_SPAN,
  NAV_ICONS,
  MAX_TABS,
  MAX_WIDGETS,
  PAGE_TYPE_META,
  chartableFields,
  dateFields,
  defaultBarGroupBy,
  defaultSpan,
  defaultTopGroupBy,
  defaultLineGroupBy,
  defaultOptionLabel,
  defaultReportGroupBy,
  describePage,
  dropTabsTo,
  askableFields,
  chartControl,
  defaultWizardSteps,
  duplicatePage,
  filterableDateFields,
  groupableFields,
  inNav,
  numericFields,
  pageFromSuggestion,
  pageLabel,
  pagesEmbedding,
  rankableKeys,
  relationsTo,
  reportCharts,
  renamePageIdInPages,
  seedLayout,
  slugify,
  suggestPages,
  uniquePageId,
  type PageLayoutValidation,
} from './pageLayout'

/** What the layout preview needs beyond the layout: the chrome language, the project-wide
 *  scaffold opts (list toolbars follow them) and which frontend set draws the shell. */
export interface PagesPreviewSettings {
  locale: 'en' | 'he'
  projectOpts: string[]
  skin: 'tailwind' | 'menora'
}

interface Props {
  pages: FullstackPageDef[]
  entities: FullstackEntityDef[]
  /** From validatePages — inline messages per control plus the problem list. */
  validation: PageLayoutValidation
  onChange: (next: FullstackPageDef[]) => void
  /** Records a labelled undo entry before a change that would be annoying to retype. */
  pushUndo: (label: string) => void
  /** Drops the layout, back to the classic shell. */
  onClear: () => void
  previewSettings?: PagesPreviewSettings
  /** Bumped by the caller to open the first page with a problem and focus the control. */
  revealRequest?: number
  /** `stacked` puts the preview under the page list at every width — for narrow hosts (the
   *  admin drawer), where the viewport-wide split would squeeze both. */
  layout?: 'split' | 'stacked'
}

const CHIP = 'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide'
const ICON_BUTTON = 'shrink-0 rounded-lg p-1.5 text-secondary hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary'
const SMALL_BUTTON = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant text-secondary hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:hover:text-secondary disabled:hover:border-outline-variant disabled:hover:bg-transparent'
const PREVIEW_KEY = 'fullstack:layoutPreview'

const WIDGET_KINDS: { kind: FullstackWidgetDef['kind']; icon: string; label: string }[] = [
  { kind: 'kpi', icon: 'counter_1', label: 'Number tile' },
  { kind: 'bar', icon: 'bar_chart', label: 'Breakdown chart' },
  { kind: 'line', icon: 'show_chart', label: 'Trend over time' },
  { kind: 'recent', icon: 'list', label: 'Recent rows' },
  { kind: 'top', icon: 'format_list_numbered', label: 'Top list' },
  { kind: 'progress', icon: 'data_usage', label: 'Progress to target' },
]

function readPreviewOpen(): boolean {
  try { return localStorage.getItem(PREVIEW_KEY) !== 'closed' } catch { return true }
}

/**
 * The generated frontend's page layout: what screens the app has, in nav order, beside a live
 * wireframe of the result. Without a layout the generator falls back to the classic shell (a
 * dashboard plus one list page per entity), which "Start from my entities" materializes as an
 * editable starting point.
 */
export function PagesEditor({ pages, entities, validation, onChange, pushUndo, onClear, previewSettings, revealRequest, layout = 'split' }: Props) {
  const keys = useStableKeys(pages, p => p.id)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  // Ids follow the title until the user edits one by hand (by row key, so a rename keeps it).
  const [customIds, setCustomIds] = useState<Set<string>>(new Set())
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null)
  const [confirmClassic, setConfirmClassic] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(readPreviewOpen)
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const sectionRef = useRef<HTMLElement>(null)

  const named = entities.filter(e => e.name.trim())
  const atPageCap = pages.length >= MAX_PAGES
  const dnd = useDragReorder((list, from, to) => {
    if (list === 'pages') return onChange(moveItem(pages, from, to))
    const index = Number(list.slice('widgets:'.length))
    const page = pages[index]
    if (page) update(index, { widgets: moveItem(page.widgets ?? [], from, to) })
  })

  useEffect(() => {
    try { localStorage.setItem(PREVIEW_KEY, previewOpen ? 'open' : 'closed') } catch { /* preference only */ }
  }, [previewOpen])

  function update(index: number, patch: Partial<FullstackPageDef>) {
    const before = pages[index]
    let next = pages.map((p, i) => (i === index ? { ...p, ...patch } : p))
    // Tabs embed pages by id — follow the rename instead of leaving them pointing at nothing.
    if (patch.id != null && before && before.id !== patch.id && before.id) {
      next = renamePageIdInPages(next, before.id, patch.id)
    }
    onChange(next)
  }

  function retitle(index: number, title: string) {
    const page = pages[index]
    const keepsId = customIds.has(keys[index]) || page.type === 'dashboard'
    const patch: Partial<FullstackPageDef> = { title }
    if (!keepsId) {
      const slug = slugify(title)
      if (slug) patch.id = uniquePageId(slug, pages.filter((_, i) => i !== index).map(p => p.id))
    }
    update(index, patch)
  }

  function openPage(index: number | null) {
    const key = index == null ? null : keys[index] ?? null
    setOpenKey(key)
    if (key) setPreviewKey(key)
  }

  function add(page: FullstackPageDef) {
    setAddOpen(false)
    onChange([...pages, page])
    // The new row's key is minted on the next render; open it by position once it exists.
    pendingOpen.current = pages.length
  }
  const pendingOpen = useRef<number | null>(null)
  useEffect(() => {
    if (pendingOpen.current == null) return
    const index = pendingOpen.current
    pendingOpen.current = null
    if (keys[index]) {
      setOpenKey(keys[index])
      setPreviewKey(keys[index])
    }
  }, [keys])

  function addPage(type: FullstackPageType) {
    add(blankPage(type, named, pages))
  }

  function removePage(index: number, dropTabs = false) {
    setConfirmRemove(null)
    const page = pages[index]
    pushUndo(`Removed the “${pageLabel(page)}” page`)
    const rest = pages.filter((_, i) => i !== index)
    onChange(dropTabs ? dropTabsTo(rest, page.id) : rest)
    if (keys[index] === openKey) setOpenKey(null)
  }

  function requestRemove(index: number) {
    if (pagesEmbedding(pages, pages[index].id).length > 0) setConfirmRemove(index)
    else removePage(index)
  }

  function duplicate(index: number) {
    const copy = duplicatePage(pages[index], pages.map(p => p.id))
    const next = [...pages]
    next.splice(index + 1, 0, copy)
    onChange(next)
    pendingOpen.current = index + 1
  }

  function move(index: number, delta: number) {
    const to = index + delta
    if (to < 0 || to >= pages.length) return
    onChange(moveItem(pages, index, to))
  }

  function startFromEntities() {
    pushUndo('Started a page layout from the entities')
    onChange(seedLayout(entities))
  }

  /** Opens a page and focuses one of its controls (or its first invalid one). */
  function reveal(target: EditTarget) {
    const key = keys[target.page]
    if (!key) return
    setOpenKey(key)
    setPreviewKey(key)
    const attempt = (triesLeft: number) => {
      const row = sectionRef.current?.querySelector<HTMLElement>(`[data-page-key="${cssEscape(key)}"]`)
      const scope = target.control
        ? row?.querySelector<HTMLElement>(`[data-control="${cssEscape(target.control)}"]`)
        : row?.querySelector<HTMLElement>('[aria-invalid="true"]')?.closest<HTMLElement>('[data-control]') ?? null
      const control = scope?.matches('input, select, textarea, button')
        ? scope
        : scope?.querySelector<HTMLElement>('input:not([type="checkbox"]), select, textarea, button, input')
      if (control) {
        focusWithoutClipping(control, 'center')
        return
      }
      if (triesLeft > 0) requestAnimationFrame(() => attempt(triesLeft - 1))
      else if (row) scrollToElement(row, 'center')
    }
    requestAnimationFrame(() => attempt(2))
  }

  // The caller's "jump to the first error" lands here: the first page with a problem.
  useEffect(() => {
    if (!revealRequest) return
    const first = validation.issues.find(i => i.page != null)
    if (first) reveal({ page: first.page!, control: first.field })
    else scrollToElement(sectionRef.current, 'center')
  }, [revealRequest])

  const settings = previewSettings ?? { locale: 'en' as const, projectOpts: [], skin: 'tailwind' as const }
  const preview = useMemo(
    () => buildLayoutPreview(pages, entities, { locale: settings.locale, projectOpts: settings.projectOpts }),
    [pages, entities, settings.locale, settings.projectOpts],
  )
  const previewIndex = (() => {
    const i = previewKey ? keys.indexOf(previewKey) : -1
    return i >= 0 ? i : preview.nav[0]?.index ?? 0
  })()
  const previewPage = pages[previewIndex]
  const offNavNote = !previewPage ? undefined
    : previewPage.type === 'record' ? `Opens from a ${previewPage.entity || 'record'} row — not in the navigation.`
      : previewPage.hidden ? 'Tab only — reachable inside a tabs page, not from the navigation.'
        : undefined
  const suggestions = useMemo(() => suggestPages(entities, pages), [entities, pages])

  const issues = validation.issues
  const showPreview = pages.length > 0 && previewOpen

  return (
    <section
      ref={sectionRef}
      id="fs-pages"
      className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 space-y-3"
      aria-label="Frontend page layout"
      data-page-layout
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-outlined text-primary mt-0.5" style={{ fontSize: '20px' }}>web</span>
          <div>
            <h2 className="text-sm font-bold text-on-surface">
              Frontend pages
              {pages.length > 0 && <span className="ms-1.5 text-[11px] font-normal text-secondary">{pages.length}</span>}
            </h2>
            <p className="text-[11px] text-secondary">
              The generated app opens on the first page in the navigation. A hidden page shows up only as a tab of a tabs page, and a record page opens from a row of its entity.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pages.length > 0 && (
            <button
              type="button"
              onClick={() => setPreviewOpen(o => !o)}
              aria-pressed={previewOpen}
              className={SMALL_BUTTON}
              title={previewOpen ? 'Hide the layout preview' : 'Show a preview of the generated app'}
              data-toggle-preview
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{previewOpen ? 'visibility_off' : 'preview'}</span>
              {previewOpen ? 'Hide preview' : 'Preview'}
            </button>
          )}
          {pages.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClassic(true)}
              className={SMALL_BUTTON}
              title="Generate the default dashboard plus one list page per entity instead"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>restart_alt</span>
              Use classic layout
            </button>
          )}
          <button
            type="button"
            onClick={() => setAddOpen(o => !o)}
            aria-expanded={addOpen}
            disabled={named.length === 0 || atPageCap}
            className={SMALL_BUTTON}
            title={named.length === 0 ? 'Name an entity first' : atPageCap ? `A layout can have at most ${MAX_PAGES} pages` : 'Add a page to the layout'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
            Add page
          </button>
        </div>
      </div>

      {addOpen && (
        <div className="space-y-2" data-page-gallery>
          {suggestions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Suggested for your entities</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2" data-page-suggestions>
                {suggestions.map(s => (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => add(pageFromSuggestion(s, pages.map(p => p.id)))}
                      className="w-full h-full text-start rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 hover:border-primary/60 transition-colors"
                      data-suggestion={s.key}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }} aria-hidden="true">{s.icon}</span>
                        {s.label}
                      </span>
                      <span className="block mt-0.5 text-[11px] text-secondary">{s.blurb}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(Object.keys(PAGE_TYPE_META) as FullstackPageType[]).map(type => {
              const meta = PAGE_TYPE_META[type]
              return (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => addPage(type)}
                    className="w-full h-full text-start rounded-lg border border-outline-variant px-3 py-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }} aria-hidden="true">{meta.icon}</span>
                      {meta.label}
                    </span>
                    <span className="block mt-0.5 text-[11px] text-secondary">{meta.blurb}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {issues.length > 0 && (
        <ul className="rounded-lg border border-error/40 bg-error/5 px-3 py-2 space-y-1" role="alert" data-page-layout-problems>
          {issues.map((issue, i) => (
            <li key={`${i}:${issue.summary}`} className="text-[11px] text-error">
              {issue.page != null ? (
                <button
                  type="button"
                  onClick={() => reveal({ page: issue.page!, control: issue.field })}
                  className="flex items-start gap-1.5 text-start hover:underline"
                  title="Open this page at the problem"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }} aria-hidden="true">error</span>
                  {issue.summary}
                </button>
              ) : (
                <span className="flex items-start gap-1.5">
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }} aria-hidden="true">error</span>
                  {issue.summary}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {pages.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-outline-variant px-3 py-3">
          <p className="text-[11px] text-secondary">
            <span className="font-semibold text-on-surface">Classic layout</span> — a dashboard plus one list page per entity.
          </p>
          <button
            type="button"
            onClick={startFromEntities}
            disabled={named.length === 0}
            className={SMALL_BUTTON}
            data-seed-layout
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>auto_awesome</span>
            Start from my entities
          </button>
        </div>
      ) : (
        <div className={!showPreview ? '' : layout === 'stacked' ? 'space-y-3' : 'grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]'}>
          <ol className="min-w-0 space-y-2">
            {pages.map((page, index) => {
              const key = keys[index]
              const meta = PAGE_TYPE_META[page.type] ?? { icon: 'web_asset', label: page.type, blurb: '' }
              const errors = validation.byPage[index] ?? {}
              const errorCount = Object.keys(errors).length
              const open = openKey === key
              const indicator = dnd.indicatorFor('pages', index)
              const isStart = preview.nav[0]?.index === index
              return (
                <li
                  key={key}
                  {...dnd.rowProps('pages', index)}
                  data-page-id={page.id}
                  data-page-key={key}
                  className={`rounded-lg border px-2.5 py-2 ${errorCount ? 'border-error/50' : previewIndex === index && showPreview ? 'border-primary/50' : 'border-outline-variant'} ${
                    dnd.isDragging('pages', index) ? 'opacity-40' : ''
                  } ${indicator === 'before' ? 'border-t-2 border-t-primary' : ''} ${indicator === 'after' ? 'border-b-2 border-b-primary' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      {...dnd.handleProps('pages', index)}
                      className="cursor-grab select-none text-secondary/70 hover:text-secondary"
                      title="Drag to reorder"
                      aria-hidden="true"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>drag_indicator</span>
                    </span>
                    <MoveButtons
                      label={pageLabel(page)}
                      canUp={index > 0}
                      canDown={index < pages.length - 1}
                      onMove={delta => move(index, delta)}
                    />
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: '18px' }} aria-hidden="true">{meta.icon}</span>
                    <button
                      type="button"
                      onClick={() => openPage(open ? null : index)}
                      aria-expanded={open}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-start"
                    >
                      <span className="truncate text-xs font-semibold text-on-surface">{pageLabel(page)}</span>
                      <span className={`${CHIP} bg-primary/10 text-primary`}>{meta.label}</span>
                      {isStart && (
                        <span className={`${CHIP} bg-amber-400/15 text-amber-700 dark:text-amber-300`} title="The generated app opens on this page" data-start-page>
                          Start page
                        </span>
                      )}
                      {page.hidden && page.type !== 'record' && (
                        <span className={`${CHIP} bg-surface-container text-secondary`}>Tab only</span>
                      )}
                      {page.type === 'record' && (
                        <span className={`${CHIP} bg-surface-container text-secondary`} title="Record pages open from a row, so they are never in the navigation">
                          From a row
                        </span>
                      )}
                      {errorCount > 0 && (
                        <span className={`${CHIP} bg-error/10 text-error`} data-page-errors>
                          {errorCount} problem{errorCount === 1 ? '' : 's'}
                        </span>
                      )}
                      <span className="truncate text-[11px] text-secondary">{describePage(page, pages)}</span>
                    </button>
                    {page.type !== 'record' && (
                      <button
                        type="button"
                        onClick={() => update(index, page.hidden ? { hidden: false } : { hidden: true, group: undefined, icon: undefined })}
                        className={ICON_BUTTON}
                        aria-pressed={Boolean(page.hidden)}
                        title={page.hidden ? 'Show in the navigation' : 'Hide from the navigation (tab only)'}
                        aria-label={page.hidden ? `Show ${pageLabel(page)} in the navigation` : `Hide ${pageLabel(page)} from the navigation`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          {page.hidden ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    )}
                    {page.type !== 'record' && (
                      <button
                        type="button"
                        onClick={() => duplicate(index)}
                        disabled={atPageCap}
                        className={ICON_BUTTON}
                        title={atPageCap ? `A layout can have at most ${MAX_PAGES} pages` : 'Duplicate this page'}
                        aria-label={`Duplicate ${pageLabel(page)}`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => requestRemove(index)}
                      className={`${ICON_BUTTON} hover:text-error hover:bg-error/5`}
                      title="Remove this page"
                      aria-label={`Remove ${pageLabel(page)}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                    </button>
                  </div>

                  {open && (
                    <div className="mt-2 space-y-3 border-t border-outline-variant pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Field label="Title" error={errors.title} control="title">
                          <input
                            type="text"
                            aria-label="Page title"
                            aria-invalid={Boolean(errors.title)}
                            value={page.title ?? ''}
                            onChange={e => retitle(index, e.target.value)}
                            placeholder={pageLabel(page)}
                            className={inputClass(errors.title)}
                          />
                        </Field>
                        <Field
                          label="Id"
                          error={errors.id}
                          control="id"
                          hint={customIds.has(key) || page.type === 'dashboard' ? 'Screen file and nav id' : 'Follows the title until you edit it'}
                        >
                          <input
                            type="text"
                            aria-label="Page id"
                            aria-invalid={Boolean(errors.id)}
                            value={page.id}
                            onChange={e => {
                              setCustomIds(prev => new Set(prev).add(key))
                              update(index, { id: e.target.value })
                            }}
                            className={`${inputClass(errors.id)} font-mono`}
                          />
                        </Field>
                        <Field label="Description" error={errors.description} control="description">
                          <input
                            type="text"
                            aria-label="Page description"
                            aria-invalid={Boolean(errors.description)}
                            value={page.description ?? ''}
                            onChange={e => update(index, { description: e.target.value || undefined })}
                            placeholder="Optional line under the heading"
                            className={inputClass(errors.description)}
                          />
                        </Field>
                      </div>
                      {inNav(page) && (
                        <NavFields page={page} index={index} pages={pages} errors={errors} update={update} />
                      )}

                      {page.type === 'entity-list' && (
                        <EntityListForm page={page} index={index} entities={named} errors={errors} update={update} />
                      )}
                      {page.type === 'dashboard' && (
                        <DashboardForm page={page} index={index} entities={named} errors={errors} update={update} dnd={dnd} />
                      )}
                      {page.type === 'tabs' && (
                        <TabsForm page={page} index={index} pages={pages} errors={errors} update={update} />
                      )}
                      {page.type === 'master-detail' && (
                        <MasterDetailForm page={page} index={index} entities={named} errors={errors} update={update} />
                      )}
                      {page.type === 'record' && (
                        <RecordForm page={page} index={index} entities={named} errors={errors} update={update} />
                      )}
                      {page.type === 'report' && (
                        <ReportForm page={page} index={index} entities={named} errors={errors} update={update} />
                      )}
                      {page.type === 'wizard' && (
                        <WizardForm page={page} index={index} entities={named} errors={errors} update={update} />
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          {showPreview && (
            <aside className={`min-w-0 space-y-1.5 ${layout === 'split' ? 'xl:sticky xl:top-20 xl:self-start' : ''}`} aria-label="Layout preview">
              <p className="flex items-center justify-between gap-2 text-[11px] text-secondary">
                <span className="font-semibold uppercase tracking-wider">Preview</span>
                <span>Sample data · click a part to edit it</span>
              </p>
              <LayoutPreview
                preview={preview}
                selected={previewIndex}
                onSelect={i => setPreviewKey(keys[i] ?? null)}
                onEdit={reveal}
                skin={settings.skin}
                offNavNote={offNavNote}
              />
            </aside>
          )}
        </div>
      )}

      {confirmRemove != null && pages[confirmRemove] && (
        <ConfirmDialog
          title={`Remove “${pageLabel(pages[confirmRemove])}”?`}
          message={`It is a tab of ${pagesEmbedding(pages, pages[confirmRemove].id).map(p => `“${pageLabel(p)}”`).join(', ')}. Removing it removes that tab too.`}
          confirmLabel="Remove page and tab"
          tone="danger"
          onConfirm={() => removePage(confirmRemove, true)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
      {confirmClassic && (
        <ConfirmDialog
          title="Use the classic layout?"
          message={`This drops the ${pages.length} page${pages.length === 1 ? '' : 's'} of your layout; the app gets a dashboard plus one list page per entity. Undo brings the layout back.`}
          confirmLabel="Use classic layout"
          tone="danger"
          onConfirm={() => { setConfirmClassic(false); onClear() }}
          onCancel={() => setConfirmClassic(false)}
        />
      )}
    </section>
  )
}

// ── Per-type forms ─────────────────────────────────────────────────────────

type Update = (index: number, patch: Partial<FullstackPageDef>) => void
interface FormProps {
  page: FullstackPageDef
  index: number
  entities: FullstackEntityDef[]
  errors: Record<string, string>
  update: Update
}

/** Where a nav page sits in the generated nav: its section (group) and its icon. */
function NavFields({ page, index, pages, errors, update }: Omit<FormProps, 'entities'> & { pages: FullstackPageDef[] }) {
  const groups = [...new Set(pages.map(p => p.group?.trim()).filter((g): g is string => Boolean(g)))]
  const fallback = DEFAULT_NAV_ICON[page.type]
  const current = page.icon ?? fallback
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <Field label="Nav group" error={errors.group} control="group" hint="Pages with the same group are listed together">
        <input
          type="text"
          list={`nav-groups-${index}`}
          aria-label="Nav group"
          aria-invalid={Boolean(errors.group)}
          maxLength={MAX_GROUP + 10}
          value={page.group ?? ''}
          onChange={e => update(index, { group: e.target.value || undefined })}
          placeholder="None"
          className={inputClass(errors.group)}
        />
        <datalist id={`nav-groups-${index}`}>
          {groups.map(g => <option key={g} value={g} />)}
        </datalist>
      </Field>
      <Field label="Nav icon" error={errors.icon} control="icon">
        <div role="radiogroup" aria-label="Nav icon" className="flex flex-wrap gap-1">
          {(Object.keys(NAV_ICONS) as FullstackNavIcon[]).map(name => {
            const selected = current === name
            const label = `${NAV_ICONS[name].label}${name === fallback ? ' (default)' : ''}`
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={label}
                title={label}
                data-nav-icon={name}
                onClick={() => update(index, { icon: name === fallback ? undefined : name })}
                className={`rounded p-1 transition-colors ${selected ? 'bg-primary/15 text-primary ring-1 ring-primary/40' : 'text-secondary hover:bg-primary/5 hover:text-primary'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">{NAV_ICONS[name].symbol}</span>
              </button>
            )
          })}
        </div>
      </Field>
    </div>
  )
}

/** Up/down buttons — the keyboard alternative to dragging a row. */
function MoveButtons({ label, canUp, canDown, onMove }: { label: string; canUp: boolean; canDown: boolean; onMove: (delta: number) => void }) {
  return (
    <span className="inline-flex shrink-0 flex-col">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={!canUp}
        className="leading-none text-secondary/70 hover:text-primary disabled:opacity-20"
        aria-label={`Move ${label} up`}
        title="Move up"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>keyboard_arrow_up</span>
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={!canDown}
        className="leading-none text-secondary/70 hover:text-primary disabled:opacity-20"
        aria-label={`Move ${label} down`}
        title="Move down"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>keyboard_arrow_down</span>
      </button>
    </span>
  )
}

/** The "opens filtered on" rows of a list or report page: equality on a filterable enum/boolean
 *  column, which is exactly what the backend accepts as a preset filter. */
function PresetFilters({ filter, entity, errors, onChange, heading = 'Opens filtered on' }: {
  filter: Record<string, string> | undefined
  entity: FullstackEntityDef | undefined
  /** Per-field messages under `presetFilter.<field>` (a widget reports on its row instead). */
  errors: Record<string, string>
  onChange: (next: Record<string, string> | undefined) => void
  heading?: string
}) {
  const filterable = groupableFields(entity)
  const filters = Object.entries(filter ?? {})
  const unused = filterable.filter(f => !(f.name in (filter ?? {})))

  function setFilter(field: string, value: string | null, rename?: string) {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(filter ?? {})) {
      if (k !== field) next[k] = v
      else if (value !== null) next[rename ?? k] = value
    }
    if (!(field in (filter ?? {})) && value !== null) next[field] = value
    onChange(Object.keys(next).length ? next : undefined)
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">{heading}</p>
      {filters.length === 0 && (
        <p className="text-[11px] text-secondary">
          {filterable.length === 0
            ? `Every row — ${entity?.name ?? 'this entity'} has no filterable enum or boolean field to preset.`
            : 'Every row (no preset filter).'}
        </p>
      )}
      {filters.map(([field, value]) => {
        const f = filterable.find(x => x.name === field)
        const error = errors[`presetFilter.${field}`]
        return (
          <div key={field} className="flex items-center gap-2" data-preset-filter={field} data-control={`presetFilter.${field}`}>
            <select
              aria-label="Filter field"
              aria-invalid={Boolean(error)}
              value={field}
              onChange={e => setFilter(field, value, e.target.value)}
              className={`${inputClass(error)} max-w-[12rem] py-1 text-xs`}
            >
              <option value={field}>{field}</option>
              {unused.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
            </select>
            <select
              aria-label={`Filter value for ${field}`}
              value={value}
              onChange={e => setFilter(field, e.target.value)}
              className={`${inputClass(error)} max-w-[12rem] py-1 text-xs`}
            >
              {!valuesOf(f).includes(value) && <option value={value}>{value}</option>}
              {valuesOf(f).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setFilter(field, null)}
              className={ICON_BUTTON}
              aria-label={`Remove the ${field} filter`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
            {error && <span className="text-[11px] text-error">{error}</span>}
          </div>
        )
      })}
      {unused.length > 0 && (
        <button
          type="button"
          onClick={() => setFilter(unused[0].name, valuesOf(unused[0])[0] ?? '')}
          className={SMALL_BUTTON}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>filter_alt</span>
          Add filter
        </button>
      )}
    </div>
  )
}

function EntityListForm({ page, index, entities, errors, update }: FormProps) {
  const entity = entities.find(e => e.name === page.entity)

  return (
    <div className="space-y-2">
      <Field label="Entity" error={errors.entity} control="entity">
        <EntitySelect
          label="List entity"
          value={page.entity ?? ''}
          options={entities.map(e => e.name)}
          error={errors.entity}
          onChange={name => update(index, { entity: name, presetFilter: undefined })}
        />
      </Field>
      <PresetFilters
        filter={page.presetFilter}
        entity={entity}
        errors={errors}
        onChange={presetFilter => update(index, { presetFilter })}
      />
    </div>
  )
}

function DashboardForm({ page, index, entities, errors, update, dnd }: FormProps & { dnd: ReturnType<typeof useDragReorder> }) {
  const widgets = page.widgets ?? []
  const list = `widgets:${index}`
  const keys = useStableKeys(widgets, w => `${w.kind}:${w.entity}:${w.groupBy ?? ''}:${w.title ?? ''}`)
  const atCap = widgets.length >= MAX_WIDGETS
  // Rows whose layout/filter options are unfolded (by row key).
  const [unfolded, setUnfolded] = useState<Set<string>>(() => new Set())
  const toggleOptions = (key: string) => setUnfolded(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  function setWidgets(next: FullstackWidgetDef[]) {
    update(index, { widgets: next })
  }
  function setWidget(wi: number, patch: Partial<FullstackWidgetDef>) {
    setWidgets(widgets.map((w, i) => (i === wi ? { ...w, ...patch } : w)))
  }
  function setKind(wi: number, kind: FullstackWidgetDef['kind']) {
    if (widgets[wi].kind === kind) return
    setWidget(wi, {
      kind,
      groupBy: undefined,
      limit: undefined,
      bucket: undefined,
      sortBy: undefined,
      compare: undefined,
      target: undefined,
      // A recent list shows rows, so it can carry no aggregate.
      ...(kind === 'recent' ? { agg: undefined, field: undefined } : {}),
    })
  }

  return (
    <div className="space-y-2">
      <Field
        label="Period picker"
        error={errors.dateRange}
        control="dateRange"
        hint={page.dateRange ? 'The dashboard opens on this period; widgets with a date follow the picker' : 'Off — every widget covers all rows'}
      >
        <select
          aria-label="Period picker"
          aria-invalid={Boolean(errors.dateRange)}
          value={page.dateRange ?? ''}
          onChange={e => update(index, {
            dateRange: (e.target.value || undefined) as FullstackDateRange | undefined,
            // A widget's date field only means something under a picker.
            ...(e.target.value ? {} : {
              widgets: widgets.map(w => (w.dateField || w.compare ? { ...w, dateField: undefined, compare: undefined } : w)),
            }),
          })}
          className={`${inputClass(errors.dateRange)} max-w-[14rem]`}
        >
          <option value="">Off</option>
          {DATE_RANGES.map(r => <option key={r.value} value={r.value}>Opens on: {r.label}</option>)}
        </select>
      </Field>
      <div className="space-y-1" data-control="widgets">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          Widgets <span className="font-normal normal-case tracking-normal">· number tiles take one column, charts and lists two, on a four-column grid</span>
        </p>
        {errors.widgets && <p className="text-[11px] text-error">{errors.widgets}</p>}
        {widgets.map((widget, wi) => {
          const entity = entities.find(e => e.name === widget.entity)
          const error = errors[`widget.${wi}`]
          const key = keys[wi]
          const customized = widget.span != null || widget.presetFilter != null || widget.sortBy != null || widget.dateField != null
          const open = unfolded.has(key) || customized
          return (
            <div
              key={keys[wi]}
              {...dnd.rowProps(list, wi)}
              data-widget={wi}
              data-control={`widget.${wi}`}
              className={`flex flex-wrap items-center gap-2 rounded border px-2 py-1.5 ${error ? 'border-error/50' : 'border-outline-variant'}`}
            >
              <span
                {...dnd.handleProps(list, wi)}
                className="cursor-grab text-secondary/70"
                aria-hidden="true"
                title="Drag to reorder"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>drag_indicator</span>
              </span>
              <MoveButtons
                label={`widget ${wi + 1}`}
                canUp={wi > 0}
                canDown={wi < widgets.length - 1}
                onMove={delta => setWidgets(moveItem(widgets, wi, wi + delta))}
              />
              <div role="radiogroup" aria-label="Widget kind" className="inline-flex overflow-hidden rounded border border-outline-variant">
                {WIDGET_KINDS.map(k => {
                  const on = widget.kind === k.kind
                  return (
                    <button
                      key={k.kind}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={k.label}
                      title={k.label}
                      onClick={() => setKind(wi, k.kind)}
                      className={`px-1.5 py-0.5 ${on ? 'bg-primary/15 text-primary' : 'text-secondary hover:bg-primary/5 hover:text-primary'}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{k.icon}</span>
                    </button>
                  )
                })}
              </div>
              <EntitySelect
                label="Widget entity"
                value={widget.entity}
                options={entities.map(e => e.name)}
                error={error}
                className="max-w-[10rem]"
                onChange={name => setWidget(wi, { entity: name, groupBy: undefined, presetFilter: undefined, sortBy: undefined, dateField: undefined })}
              />
              {widget.kind === 'bar' && (
                <select
                  aria-label="Group by"
                  value={widget.groupBy ?? ''}
                  onChange={e => setWidget(wi, { groupBy: e.target.value || undefined })}
                  className={`${inputClass(error)} max-w-[11rem] py-1 text-xs`}
                >
                  <option value="">{defaultOptionLabel(defaultBarGroupBy(entity), 'enum or boolean')}</option>
                  {groupableFields(entity).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                  {widget.groupBy && !groupableFields(entity).some(f => f.name === widget.groupBy) && (
                    <option value={widget.groupBy}>{widget.groupBy}</option>
                  )}
                </select>
              )}
              {widget.kind === 'line' && (
                <>
                  <select
                    aria-label="Date field"
                    value={widget.groupBy ?? ''}
                    onChange={e => setWidget(wi, { groupBy: e.target.value || undefined })}
                    className={`${inputClass(error)} max-w-[11rem] py-1 text-xs`}
                  >
                    <option value="">{defaultOptionLabel(defaultLineGroupBy(entity), 'date field')}</option>
                    {dateFields(entity).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                    {widget.groupBy && !dateFields(entity).some(f => f.name === widget.groupBy) && (
                      <option value={widget.groupBy}>{widget.groupBy}</option>
                    )}
                  </select>
                  <BucketSelect value={widget.bucket} onChange={bucket => setWidget(wi, { bucket })} />
                </>
              )}
              {widget.kind !== 'recent' && (
                <AggFields
                  agg={widget.agg}
                  field={widget.field}
                  entity={entity}
                  error={error}
                  onChange={patch => setWidget(wi, patch)}
                />
              )}
              {widget.kind === 'top' && (
                <select
                  aria-label="Rank by"
                  value={widget.groupBy ?? ''}
                  onChange={e => setWidget(wi, { groupBy: e.target.value || undefined })}
                  className={`${inputClass(error)} max-w-[11rem] py-1 text-xs`}
                >
                  <option value="">{defaultOptionLabel(defaultTopGroupBy(entity), 'enum, boolean or relation')}</option>
                  {rankableKeys(entity).map(k => <option key={k} value={k}>{k}</option>)}
                  {widget.groupBy && !rankableKeys(entity).includes(widget.groupBy) && (
                    <option value={widget.groupBy}>{widget.groupBy}</option>
                  )}
                </select>
              )}
              {widget.kind === 'progress' && (
                <input
                  type="number"
                  min={0}
                  step="any"
                  aria-label="Target"
                  aria-invalid={Boolean(error) && !widget.target}
                  value={widget.target ?? ''}
                  placeholder="Target"
                  onChange={e => setWidget(wi, { target: e.target.value || undefined })}
                  className={`${inputClass(error)} max-w-[7rem] py-1 text-xs`}
                />
              )}
              {widget.kind === 'kpi' && (
                <label
                  className={`inline-flex items-center gap-1 text-xs ${page.dateRange ? 'text-on-surface' : 'text-secondary/60'}`}
                  title={page.dateRange ? 'Show the change against the previous period' : 'Turn on the period picker to compare periods'}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(widget.compare)}
                    disabled={!page.dateRange && !widget.compare}
                    onChange={e => setWidget(wi, { compare: e.target.checked || undefined })}
                  />
                  vs previous period
                </label>
              )}
              {(widget.kind === 'recent' || widget.kind === 'top') && (
                <input
                  type="number"
                  min={1}
                  max={MAX_RECENT_LIMIT}
                  aria-label="How many rows"
                  value={widget.limit ?? ''}
                  placeholder="5"
                  onChange={e => setWidget(wi, { limit: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className={`${inputClass(error)} max-w-[5rem] py-1 text-xs`}
                />
              )}
              <input
                type="text"
                aria-label="Widget title"
                value={widget.title ?? ''}
                placeholder="Title (optional)"
                onChange={e => setWidget(wi, { title: e.target.value || undefined })}
                className={`${inputClass()} min-w-[8rem] flex-1 py-1 text-xs`}
              />
              <button
                type="button"
                onClick={() => {
                  const next = [...widgets]
                  next.splice(wi + 1, 0, { ...widget })
                  setWidgets(next)
                }}
                disabled={atCap}
                className={ICON_BUTTON}
                aria-label={`Duplicate widget ${wi + 1}`}
                title={atCap ? `A dashboard can have at most ${MAX_WIDGETS} widgets` : 'Duplicate this widget'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
              </button>
              <button
                type="button"
                onClick={() => toggleOptions(key)}
                disabled={customized}
                className={`${ICON_BUTTON} ${open ? 'text-primary' : ''}`}
                aria-expanded={open}
                aria-label={`Layout and filter of widget ${wi + 1}`}
                title={customized ? 'This widget has its own width, filter or sort' : 'Width, filter and sort'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>tune</span>
              </button>
              <button
                type="button"
                onClick={() => setWidgets(widgets.filter((_, i) => i !== wi))}
                className={ICON_BUTTON}
                aria-label={`Remove widget ${wi + 1}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
              </button>
              {open && (
                <WidgetOptions
                  widget={widget}
                  entity={entity}
                  dateRange={page.dateRange}
                  onChange={patch => setWidget(wi, patch)}
                />
              )}
              {error && <p className="w-full text-[11px] text-error">{error}</p>}
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => setWidgets([...widgets, { kind: 'kpi', entity: entities[0]?.name ?? '' }])}
          disabled={atCap}
          className={SMALL_BUTTON}
          title={atCap ? `A dashboard can have at most ${MAX_WIDGETS} widgets` : undefined}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          Add widget
        </button>
      </div>
    </div>
  )
}

/** A widget's second line: its width on the grid, the rows it is limited to, what a recent list
 *  sorts by, and the date the dashboard's period applies to. */
function WidgetOptions({ widget, entity, dateRange, onChange }: {
  widget: FullstackWidgetDef
  entity: FullstackEntityDef | undefined
  dateRange: FullstackDateRange | undefined
  onChange: (patch: Partial<FullstackWidgetDef>) => void
}) {
  const fallbackSpan = defaultSpan(widget.kind)
  const span = widget.span ?? fallbackSpan
  const dates = filterableDateFields(entity)
  const pk = entity?.fields.find(f => f.primaryKey)?.name
  return (
    <div className="flex w-full flex-wrap items-start gap-x-4 gap-y-2 border-t border-outline-variant/60 pt-1.5" data-widget-options>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Width</p>
        <div role="radiogroup" aria-label="Widget width" className="inline-flex overflow-hidden rounded border border-outline-variant">
          {Array.from({ length: MAX_SPAN }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={span === n}
              aria-label={`${n} column${n === 1 ? '' : 's'}${n === fallbackSpan ? ' (default)' : ''}`}
              onClick={() => onChange({ span: n === fallbackSpan ? undefined : n })}
              className={`px-2 py-0.5 text-xs ${span === n ? 'bg-primary/15 font-semibold text-primary' : 'text-secondary hover:bg-primary/5'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      {widget.kind === 'recent' && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Newest by</p>
          <select
            aria-label="Sort by"
            value={widget.sortBy ?? ''}
            onChange={e => onChange({ sortBy: e.target.value || undefined })}
            className={`${inputClass()} max-w-[11rem] py-1 text-xs`}
          >
            <option value="">{defaultOptionLabel(pk, 'key')}</option>
            {(entity?.fields ?? []).filter(f => !f.primaryKey).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
        </div>
      )}
      {dateRange && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Period applies to</p>
          {dates.length === 0 ? (
            <p className="text-[11px] text-secondary">No filterable date — all rows</p>
          ) : (
            <select
              aria-label="Period date field"
              value={widget.dateField ?? ''}
              onChange={e => onChange({ dateField: e.target.value || undefined })}
              className={`${inputClass()} max-w-[11rem] py-1 text-xs`}
            >
              <option value="">{defaultOptionLabel(dates[0]?.name, 'date field')}</option>
              {dates.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
            </select>
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <PresetFilters
          filter={widget.presetFilter}
          entity={entity}
          errors={{}}
          onChange={presetFilter => onChange({ presetFilter })}
          heading="Only rows where"
        />
      </div>
    </div>
  )
}

function BucketSelect({ value, onChange }: { value: FullstackBucket | undefined; onChange: (bucket: FullstackBucket) => void }) {
  return (
    <select
      aria-label="Bucket"
      value={value ?? 'month'}
      onChange={e => onChange(e.target.value as FullstackBucket)}
      className={`${inputClass()} max-w-[7rem] py-1 text-xs`}
    >
      <option value="day">Per day</option>
      <option value="month">Per month</option>
      <option value="year">Per year</option>
    </select>
  )
}

/** How to reduce the rows, and which numeric column — shared by the dashboard widgets and a
 *  report's chart, because the backend validates both with the same rule. */
function AggFields({ agg, field, entity, error, onChange }: {
  agg: FullstackAgg | undefined
  field: string | undefined
  entity: FullstackEntityDef | undefined
  error?: string
  onChange: (patch: { agg?: FullstackAgg; field?: string }) => void
}) {
  const numeric = numericFields(entity)
  const reduces = !!agg && agg !== 'count'
  return (
    <>
      <select
        aria-label="Aggregate"
        value={agg ?? 'count'}
        // Going back to a plain count drops the field with it, which the backend requires.
        onChange={e => {
          const next = e.target.value as FullstackAgg
          onChange(next === 'count' ? { agg: undefined, field: undefined } : { agg: next, ...(field ? {} : numeric.length === 1 ? { field: numeric[0].name } : {}) })
        }}
        className={`${inputClass()} max-w-[8rem] py-1 text-xs`}
      >
        <option value="count">Count rows</option>
        <option value="sum" disabled={numeric.length === 0}>Sum of…</option>
        <option value="avg" disabled={numeric.length === 0}>Average of…</option>
        <option value="min" disabled={numeric.length === 0}>Lowest…</option>
        <option value="max" disabled={numeric.length === 0}>Highest…</option>
      </select>
      {reduces && (
        <select
          aria-label="Value field"
          aria-invalid={Boolean(error)}
          value={field ?? ''}
          onChange={e => onChange({ field: e.target.value || undefined })}
          className={`${inputClass(error)} max-w-[9rem] py-1 text-xs`}
        >
          <option value="">Pick a number…</option>
          {numeric.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          {field && !numeric.some(f => f.name === field) && <option value={field}>{field}</option>}
        </select>
      )}
    </>
  )
}

function ReportForm({ page, index, entities, errors, update }: FormProps) {
  const entity = entities.find(e => e.name === page.entity)
  const charts = reportCharts(page)
  // One chart is sent as `chart`, several as `charts` — the backend takes either spelling.
  const setCharts = (next: FullstackChartDef[]) =>
    update(index, next.length <= 1 ? { chart: next[0] ?? {}, charts: undefined } : { charts: next, chart: undefined })

  return (
    <div className="space-y-2">
      <label className="flex flex-col gap-1" data-control="entity">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Entity</span>
        <EntitySelect
          label="Report entity"
          value={page.entity ?? ''}
          options={entities.map(e => e.name)}
          error={errors.entity}
          className="max-w-[12rem]"
          // A different entity has different columns, so the charts and filters start over.
          onChange={name => update(index, { entity: name, chart: {}, charts: undefined, presetFilter: undefined })}
        />
      </label>
      {errors.entity && <p className="text-[11px] text-error">{errors.entity}</p>}
      {charts.map((chart, ci) => (
        <div key={ci} className="space-y-1 rounded border border-outline-variant px-2 py-1.5" data-report-chart={ci}>
          <div className="flex items-center gap-1.5">
            {charts.length > 1 && (
              <MoveButtons
                label={`chart ${ci + 1}`}
                canUp={ci > 0}
                canDown={ci < charts.length - 1}
                onMove={delta => setCharts(moveItem(charts, ci, ci + delta))}
              />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
              Chart {charts.length > 1 ? ci + 1 : ''}{ci === 0 && <span className="font-normal normal-case tracking-normal"> · with the totals table</span>}
            </span>
            <span className="flex-1" />
            {charts.length > 1 && (
              <button
                type="button"
                onClick={() => setCharts(charts.filter((_, i) => i !== ci))}
                className={ICON_BUTTON}
                aria-label={`Remove chart ${ci + 1}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
              </button>
            )}
          </div>
          <ChartFields
            chart={chart}
            chartIndex={ci}
            entity={entity}
            errors={errors}
            onChange={patch => setCharts(charts.map((c, i) => (i === ci ? { ...c, ...patch } : c)))}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setCharts([...charts, {}])}
        disabled={charts.length >= MAX_CHARTS}
        className={SMALL_BUTTON}
        title={charts.length >= MAX_CHARTS ? `A report can have at most ${MAX_CHARTS} charts` : undefined}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
        Add chart
      </button>
      <PresetFilters filter={page.presetFilter} entity={entity} errors={errors} onChange={presetFilter => update(index, { presetFilter })} />
    </div>
  )
}

/** One report chart: what it groups by (a breakdown or a time series), its bucket and reduction. */
function ChartFields({ chart, chartIndex, entity, errors, onChange }: {
  chart: FullstackChartDef
  chartIndex: number
  entity: FullstackEntityDef | undefined
  errors: Record<string, string>
  onChange: (patch: Partial<FullstackChartDef>) => void
}) {
  const effectiveGroupBy = chart.groupBy ?? defaultReportGroupBy(entity)
  const overTime = !!effectiveGroupBy && dateFields(entity).some(f => f.name === effectiveGroupBy)
  const setChart = onChange
  const groupKey = chartControl(chartIndex, 'groupBy')
  const bucketKey = chartControl(chartIndex, 'bucket')
  const fieldKey = chartControl(chartIndex, 'field')

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1" data-control={groupKey}>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Group by</span>
          <select
            aria-label="Group by"
            aria-invalid={Boolean(errors[groupKey])}
            value={chart.groupBy ?? ''}
            onChange={e => setChart({ groupBy: e.target.value || undefined, bucket: undefined })}
            className={`${inputClass(errors[groupKey])} max-w-[12rem] py-1 text-xs`}
          >
            <option value="">{defaultOptionLabel(defaultReportGroupBy(entity), 'enum, boolean or date')}</option>
            {groupableFields(entity).length > 0 && (
              <optgroup label="Breakdown">
                {groupableFields(entity).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
              </optgroup>
            )}
            {dateFields(entity).length > 0 && (
              <optgroup label="Over time">
                {dateFields(entity).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
              </optgroup>
            )}
            {chart.groupBy && !chartableFields(entity).some(f => f.name === chart.groupBy) && (
              <option value={chart.groupBy}>{chart.groupBy}</option>
            )}
          </select>
        </label>
        {overTime && chart.groupBy && (
          <span data-control={bucketKey}><BucketSelect value={chart.bucket} onChange={bucket => setChart({ bucket })} /></span>
        )}
        <span className="inline-flex flex-wrap items-center gap-2" data-control={fieldKey}>
          <AggFields
            agg={chart.agg}
            field={chart.field}
            entity={entity}
            error={errors[fieldKey]}
            onChange={patch => setChart(patch)}
          />
        </span>
      </div>
      {errors[groupKey] && <p className="text-[11px] text-error">{errors[groupKey]}</p>}
      {errors[fieldKey] && <p className="text-[11px] text-error">{errors[fieldKey]}</p>}
      {errors[bucketKey] && <p className="text-[11px] text-error">{errors[bucketKey]}</p>}
    </div>
  )
}

function TabsForm({ page, index, pages, errors, update }: Omit<FormProps, 'entities'> & { pages: FullstackPageDef[] }) {
  const tabs = page.tabs ?? []
  const targets = pages.filter(p => p.id !== page.id && p.type !== 'tabs' && p.type !== 'record')
  const nextTarget = targets.find(t => !tabs.some(x => x.page === t.id))
  const setTabs = (next: { title?: string; page: string }[]) => update(index, { tabs: next })

  return (
    <div className="space-y-1" data-control="tabs">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Tabs</p>
      {errors.tabs && <p className="text-[11px] text-error">{errors.tabs}</p>}
      {tabs.map((tab, ti) => {
        const error = errors[`tab.${ti}`]
        return (
          <div key={`${ti}:${tab.page}`} className="flex items-center gap-2" data-tab={ti} data-control={`tab.${ti}`}>
            <MoveButtons
              label={`tab ${ti + 1}`}
              canUp={ti > 0}
              canDown={ti < tabs.length - 1}
              onMove={delta => setTabs(moveItem(tabs, ti, ti + delta))}
            />
            <select
              aria-label={`Tab ${ti + 1} page`}
              aria-invalid={Boolean(error)}
              value={tab.page}
              onChange={e => setTabs(tabs.map((t, i) => (i === ti ? { ...t, page: e.target.value } : t)))}
              className={`${inputClass(error)} max-w-[14rem] py-1 text-xs`}
            >
              <option value="">— pick a page —</option>
              {targets.map(t => <option key={t.id} value={t.id}>{pageLabel(t)} ({t.id})</option>)}
              {tab.page && !targets.some(t => t.id === tab.page) && <option value={tab.page}>{tab.page}</option>}
            </select>
            <input
              type="text"
              aria-label={`Tab ${ti + 1} title`}
              value={tab.title ?? ''}
              placeholder="Tab label (optional)"
              onChange={e => setTabs(tabs.map((t, i) => (i === ti ? { ...t, title: e.target.value || undefined } : t)))}
              className={`${inputClass()} max-w-[12rem] py-1 text-xs`}
            />
            <button
              type="button"
              onClick={() => setTabs(tabs.filter((_, i) => i !== ti))}
              className={ICON_BUTTON}
              aria-label={`Remove tab ${ti + 1}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
            {error && <span className="text-[11px] text-error">{error}</span>}
          </div>
        )
      })}
      {tabs.length < MAX_TABS && (
        <button
          type="button"
          onClick={() => nextTarget && setTabs([...tabs, { page: nextTarget.id }])}
          disabled={!nextTarget}
          className={SMALL_BUTTON}
          title={nextTarget ? undefined : 'Every page that can be a tab is already one — add a list, dashboard, report or master-detail page first'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          Add tab
        </button>
      )}
      {targets.some(t => !t.hidden) && (
        <p className="text-[11px] text-secondary">
          Tip: hide the embedded pages (eye button) so they appear only here, not also in the navigation.
        </p>
      )}
    </div>
  )
}

function MasterDetailForm({ page, index, entities, errors, update }: FormProps) {
  const parent = entities.find(e => e.name === page.parent)
  const child = entities.find(e => e.name === page.child)
  const children = entities.filter(e => relationsTo(e, page.parent).length > 0)
  const vias = relationsTo(child, page.parent)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <Field label="Parent (left list)" error={errors.parent} control="parent">
        <EntitySelect
          label="Parent entity"
          value={page.parent ?? ''}
          options={entities.map(e => e.name)}
          error={errors.parent}
          onChange={name => {
            const kids = entities.filter(e => relationsTo(e, name).length > 0)
            // One candidate child: pick it, so the page is complete in one step.
            update(index, { parent: name, child: kids.length === 1 ? kids[0].name : undefined, via: undefined })
          }}
        />
      </Field>
      <Field
        label="Child (right list)"
        error={errors.child}
        control="child"
        hint={parent ? `Entities with a relation to ${parent.name}` : undefined}
      >
        <EntitySelect
          label="Child entity"
          value={page.child ?? ''}
          options={children.map(e => e.name)}
          error={errors.child}
          empty={children.length === 0 ? 'No entity points at this parent' : undefined}
          onChange={name => update(index, { child: name, via: undefined })}
        />
      </Field>
      {vias.length > 1 && (
        <Field label="Linked through" error={errors.via} control="via">
          <select
            aria-label="Relation to link through"
            aria-invalid={Boolean(errors.via)}
            value={page.via ?? ''}
            onChange={e => update(index, { via: e.target.value || undefined })}
            className={`${inputClass(errors.via)} py-1 text-xs`}
          >
            <option value="">— pick a relation —</option>
            {vias.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
      )}
    </div>
  )
}

function RecordForm({ page, index, entities, errors, update }: FormProps) {
  const entity = entities.find(e => e.name === page.entity)
  const related = entities.filter(e => relationsTo(e, page.entity).length > 0).map(e => e.name)
  // Omitted childTabs means "every related list" — the same default the generator applies.
  const selected = page.childTabs ?? related
  const ordered = [...selected, ...related.filter(n => !selected.includes(n))]

  function toggle(name: string) {
    update(index, {
      childTabs: selected.includes(name) ? selected.filter(n => n !== name) : [...selected, name],
    })
  }

  return (
    <div className="space-y-2">
      <Field label="Entity" error={errors.entity} control="entity" hint="Rows of this entity open on this page">
        <EntitySelect
          label="Record entity"
          value={page.entity ?? ''}
          options={entities.map(e => e.name)}
          error={errors.entity}
          onChange={name => update(index, { entity: name, childTabs: undefined })}
        />
      </Field>
      <div className="space-y-1" data-control="childTabs">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Related lists as tabs, in order</p>
        {related.length === 0 ? (
          <p className="text-[11px] text-secondary">
            Nothing points at {entity?.name ?? 'this entity'} — the page shows its details only.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {ordered.map(name => {
              const on = selected.includes(name)
              const at = selected.indexOf(name)
              return (
                <li key={name} className="flex items-center gap-1.5">
                  {on ? (
                    <MoveButtons
                      label={`the ${name} tab`}
                      canUp={at > 0}
                      canDown={at < selected.length - 1}
                      onMove={delta => update(index, { childTabs: moveItem(selected, at, at + delta) })}
                    />
                  ) : <span className="w-[14px]" />}
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-on-surface">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(name)}
                      className="accent-primary"
                    />
                    {name}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        {errors.childTabs && <p className="text-[11px] text-error">{errors.childTabs}</p>}
      </div>
      <HeaderStatsFields page={page} index={index} entities={entities} errors={errors} update={update} />
    </div>
  )
}

/** A record page's header tiles: none, the default (a count per related tab), or a list of
 *  counts/aggregates over related entities. */
function HeaderStatsFields({ page, index, entities, errors, update }: FormProps) {
  const related = entities.filter(e => relationsTo(e, page.entity).length > 0)
  const stats = page.headerStats
  const set = (next: FullstackPageDef['headerStats']) => update(index, { headerStats: next })
  return (
    <div className="space-y-1" data-control="headerStats">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
        Header numbers <span className="font-normal normal-case tracking-normal">· tiles above the tabs</span>
      </p>
      <div role="radiogroup" aria-label="Header numbers" className="inline-flex overflow-hidden rounded border border-outline-variant text-xs">
        {([['default', 'A count per tab'], ['none', 'None'], ['custom', 'Choose']] as const).map(([mode, label]) => {
          const current = stats == null ? 'default' : stats.length === 0 ? 'none' : 'custom'
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={current === mode}
              onClick={() => set(mode === 'default' ? undefined : mode === 'none' ? [] : [{ child: related[0]?.name ?? '' }])}
              disabled={mode === 'custom' && related.length === 0}
              className={`px-2 py-0.5 ${current === mode ? 'bg-primary/15 font-semibold text-primary' : 'text-secondary hover:bg-primary/5'} disabled:opacity-40`}
            >
              {label}
            </button>
          )
        })}
      </div>
      {stats?.map((s, si) => {
        const child = entities.find(e => e.name === s.child)
        const error = errors[`headerStat.${si}`]
        return (
          <div key={si} className="flex flex-wrap items-center gap-2" data-control={`headerStat.${si}`} data-header-stat={si}>
            <EntitySelect
              label="Counted entity"
              value={s.child}
              options={related.map(e => e.name)}
              error={error}
              className="max-w-[10rem]"
              onChange={name => set(stats.map((x, i) => (i === si ? { child: name } : x)))}
            />
            <AggFields
              agg={s.agg}
              field={s.field}
              entity={child}
              error={error}
              onChange={patch => set(stats.map((x, i) => (i === si ? { ...x, ...patch } : x)))}
            />
            <input
              type="text"
              aria-label="Tile title"
              value={s.title ?? ''}
              placeholder="Title (optional)"
              onChange={e => set(stats.map((x, i) => (i === si ? { ...x, title: e.target.value || undefined } : x)))}
              className={`${inputClass()} min-w-[8rem] flex-1 py-1 text-xs`}
            />
            <button
              type="button"
              onClick={() => set(stats.filter((_, i) => i !== si))}
              className={ICON_BUTTON}
              aria-label={`Remove header number ${si + 1}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
            {error && <p className="w-full text-[11px] text-error">{error}</p>}
          </div>
        )
      })}
      {stats && stats.length > 0 && stats.length < MAX_HEADER_STATS && (
        <button type="button" onClick={() => set([...stats, { child: related[0]?.name ?? '' }])} className={SMALL_BUTTON}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          Add number
        </button>
      )}
      {errors.headerStats && <p className="text-[11px] text-error">{errors.headerStats}</p>}
    </div>
  )
}

/** A wizard: its entity, and the form's fields dealt into steps (each field in exactly one). */
function WizardForm({ page, index, entities, errors, update }: FormProps) {
  const entity = entities.find(e => e.name === page.entity)
  const askable = askableFields(entity)
  const steps = page.steps ?? defaultWizardSteps(entity)
  const setSteps = (next: { title?: string; fields: string[] }[]) => update(index, { steps: next })
  const stepOf = (name: string) => steps.findIndex(s => s.fields.includes(name))
  const unasked = askable.filter(a => stepOf(a.name) < 0)

  // Moves a field into step `si`, out of whichever step had it.
  const place = (name: string, si: number) => setSteps(steps.map((s, i) => ({
    ...s,
    fields: i === si ? (s.fields.includes(name) ? s.fields : [...s.fields, name]) : s.fields.filter(f => f !== name),
  })))

  return (
    <div className="space-y-2">
      <Field label="Entity" error={errors.entity} control="entity">
        <EntitySelect
          label="Wizard entity"
          value={page.entity ?? ''}
          options={entities.filter(e => !e.readOnly).map(e => e.name)}
          error={errors.entity}
          onChange={name => update(index, { entity: name, steps: defaultWizardSteps(entities.find(e => e.name === name)) })}
        />
      </Field>
      <div className="space-y-1" data-control="steps">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          Steps <span className="font-normal normal-case tracking-normal">· then a review before saving</span>
        </p>
        {steps.map((step, si) => {
          const error = errors[`step.${si}`]
          return (
            <div key={si} className={`space-y-1 rounded border px-2 py-1.5 ${error ? 'border-error/50' : 'border-outline-variant'}`} data-control={`step.${si}`} data-wizard-step={si}>
              <div className="flex items-center gap-1.5">
                <MoveButtons
                  label={`step ${si + 1}`}
                  canUp={si > 0}
                  canDown={si < steps.length - 1}
                  onMove={delta => setSteps(moveItem(steps, si, si + delta))}
                />
                <span className="text-xs font-semibold text-secondary">{si + 1}.</span>
                <input
                  type="text"
                  aria-label={`Step ${si + 1} title`}
                  value={step.title ?? ''}
                  placeholder={`Step ${si + 1}`}
                  onChange={e => setSteps(steps.map((s, i) => (i === si ? { ...s, title: e.target.value || undefined } : s)))}
                  className={`${inputClass()} min-w-[8rem] flex-1 py-1 text-xs`}
                />
                <button
                  type="button"
                  onClick={() => setSteps(steps.filter((_, i) => i !== si))}
                  disabled={steps.length === 1}
                  className={ICON_BUTTON}
                  aria-label={`Remove step ${si + 1}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {step.fields.map(name => {
                  const a = askable.find(x => x.name === name)
                  return (
                    <span key={name} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${a ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`} data-step-field={name}>
                      {a?.relation && <span className="material-symbols-outlined" style={{ fontSize: '12px' }} aria-hidden="true">link</span>}
                      {name}{a?.required && <span aria-label="required">*</span>}
                      <button
                        type="button"
                        onClick={() => setSteps(steps.map((s, i) => (i === si ? { ...s, fields: s.fields.filter(f => f !== name) } : s)))}
                        className="leading-none hover:text-error"
                        aria-label={`Take ${name} out of step ${si + 1}`}
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
                {askable.some(a => stepOf(a.name) !== si) && (
                  <select
                    aria-label={`Add a field to step ${si + 1}`}
                    value=""
                    onChange={e => e.target.value && place(e.target.value, si)}
                    className={`${inputClass()} max-w-[10rem] py-0.5 text-[11px]`}
                  >
                    <option value="">+ field</option>
                    {askable.filter(a => stepOf(a.name) !== si).map(a => (
                      <option key={a.name} value={a.name}>
                        {a.name}{a.required ? ' *' : ''}{stepOf(a.name) >= 0 ? ` (from step ${stepOf(a.name) + 1})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {error && <p className="text-[11px] text-error">{error}</p>}
            </div>
          )
        })}
        {unasked.length > 0 && (
          <p className="text-[11px] text-secondary" data-wizard-unasked>
            Not asked: {unasked.map(a => `${a.name}${a.required ? ' (required)' : ''}`).join(', ')}
          </p>
        )}
        <button
          type="button"
          onClick={() => setSteps([...steps, { fields: [] }])}
          disabled={steps.length >= MAX_STEPS}
          className={SMALL_BUTTON}
          title={steps.length >= MAX_STEPS ? `A wizard can have at most ${MAX_STEPS} steps` : undefined}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          Add step
        </button>
        {errors.steps && <p className="text-[11px] text-error">{errors.steps}</p>}
      </div>
    </div>
  )
}

// ── Small shared pieces ────────────────────────────────────────────────────

function Field({ label, error, hint, control, children }: { label: string; error?: string; hint?: string; control?: string; children: ReactNode }) {
  return (
    <div className="space-y-1" data-control={control}>
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-secondary">{label}</span>
      {children}
      {error ? <p className="text-[11px] text-error">{error}</p> : hint ? <p className="text-[10px] text-secondary">{hint}</p> : null}
    </div>
  )
}

/** Entity picker that keeps an unknown (renamed away) value visible instead of dropping it. */
function EntitySelect({ label, value, options, error, empty, className, onChange }: {
  label: string
  value: string
  options: string[]
  error?: string
  empty?: string
  className?: string
  onChange: (name: string) => void
}) {
  return (
    <select
      aria-label={label}
      aria-invalid={Boolean(error)}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`${inputClass(error)} py-1 text-xs ${className ?? ''}`}
    >
      <option value="">{empty ?? '— pick an entity —'}</option>
      {options.map(n => <option key={n} value={n}>{n}</option>)}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
    </select>
  )
}

const valuesOf = (field: { type: string; enumValues?: string[] } | undefined): string[] =>
  field?.type === 'BOOLEAN' ? ['true', 'false'] : (field?.enumValues ?? [])

/** A new page of `type`, filled in with the first entities (and pages) that fit so it is valid on sight. */
function blankPage(type: FullstackPageType, entities: FullstackEntityDef[], pages: FullstackPageDef[]): FullstackPageDef {
  const taken = pages.map(p => p.id)
  const first = entities[0]?.name ?? ''
  const id = (base: string) => uniquePageId(slugify(base) || 'page', taken)
  switch (type) {
    case 'dashboard':
      return { id: id('dashboard'), type, widgets: entities.slice(0, 4).map(e => ({ kind: 'kpi', entity: e.name })) }
    case 'entity-list':
      return { id: id(first), type, entity: first }
    case 'tabs': {
      // Start from two pages that can be tabs — lists first — so the page is valid straight away.
      const candidates = pages.filter(p => p.type !== 'tabs' && p.type !== 'record')
      const picked = [...candidates.filter(p => p.type === 'entity-list'), ...candidates.filter(p => p.type !== 'entity-list')].slice(0, 2)
      return { id: id('tabs'), type, title: 'Tabs', tabs: picked.map(p => ({ page: p.id })) }
    }
    case 'master-detail': {
      const pair = entities
        .flatMap(child => (child.relations ?? [])
          .filter(r => r.type === 'MANY_TO_ONE')
          .map(r => ({ parent: r.targetEntity, child: child.name })))
        .find(p => entities.some(e => e.name === p.parent))
      return { id: id(pair?.parent ?? first), type, parent: pair?.parent ?? first, child: pair?.child }
    }
    case 'record':
      return { id: id(first), type, entity: first, hidden: true }
    case 'report': {
      // Prefer an entity that actually has something to chart, so the page is valid on sight.
      const e = entities.find(x => chartableFields(x).length > 0) ?? entities[0]
      return { id: id(`${e?.name ?? 'report'}-report`), type, entity: e?.name ?? first, chart: {} }
    }
    case 'wizard': {
      // A writable entity, with its default steps spelled out so they can be edited.
      const e = entities.find(x => !x.readOnly && askableFields(x).length > 0) ?? entities[0]
      return { id: id(`new-${e?.name ?? 'record'}`), type, entity: e?.name ?? first, title: `New ${e?.name ?? 'record'}`, steps: defaultWizardSteps(e) }
    }
  }
}
