import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { handleRadioKeys, syncRadioTabStops } from './rovingRadios'
import type {
  FullstackAgg,
  FullstackBucket,
  FullstackChartDef,
  FullstackDateRange,
  FullstackEntityDef,
  FullstackFieldDef,
  FullstackListDetail,
  FullstackListSort,
  FullstackNav,
  FullstackNavIcon,
  FullstackPageDef,
  FullstackPageRole,
  FullstackPageType,
  FullstackWidgetDef,
} from '../../types'
import { ConfirmDialog } from '../ConfirmDialog'
import { inputClass } from './controls'
import { entityOption, enumValueOption, fieldOption, keyOption, relationOption } from './fieldOptions'
import { cssEscape } from './focus'
import { pluralize } from './naming'
import { buildLayoutPreview } from './layoutPreviewModel'
import { LayoutPreview, type EditTarget } from './LayoutPreview'
import { moveItem } from './reorder'
import { useStableKeys } from './rowKeys'
import { focusWithoutClipping, scrollToElement } from './scroll'
import { LAYOUT_TEMPLATES, buildLayoutTemplate, deletePageTemplate, pageFromTemplate, readPageTemplates, savePageTemplate, type LayoutTemplate } from './layoutTemplates'
import { dropIndicatorClass, useDragReorder } from './useDragReorder'
import {
  DATE_RANGES,
  REFRESH_CHOICES,
  reloads,
  DEFAULT_NAV_ICON,
  DEFAULT_PAGE_SIZE,
  LIST_PAGE_SIZES,
  LIST_VIEWS,
  MAX_CHARTS,
  MAX_GROUP,
  MAX_HEADER_STATS,
  MAX_STEPS,
  MAX_PAGES,
  MAX_RECENT_LIMIT,
  MAX_SPAN,
  NAV_ICONS,
  PAGE_ROLES,
  MAX_TABS,
  MIN_TABS,
  MAX_TEXT,
  MAX_WIDGETS,
  PAGE_TYPE_META,
  dateFields,
  defaultBarGroupBy,
  defaultSeries,
  defaultSpan,
  defaultTopGroupBy,
  defaultLineGroupBy,
  defaultOptionLabel,
  defaultReportGroupBy,
  describePage,
  dropTabsTo,
  adoptedGroup,
  askableFields,
  blankPage,
  defaultPresetValue,
  parsePresetRange,
  PRESET_PERIODS,
  presetKind,
  presettableFields,
  linkablePages,
  LIST_WIDGET_LIMITS,
  MAX_DESCRIPTION,
  MAX_LINKS,
  MAX_TITLE,
  relationKeys,
  reportGroupKeys,
  masterDetailPairs,
  newPageChoices,
  moveNavGroup,
  navSections,
  renameGroupInPages,
  retargetPage,
  tabCandidates,
  chartControl,
  childTabEntity,
  childTabPresentation,
  withChildTab,
  childTabVia,
  defaultWizardSteps,
  duplicatePage,
  enabledListViews,
  filterableDateFields,
  groupableFields,
  inNav,
  listColumns,
  newWidget,
  numericFields,
  pageFromSuggestion,
  pageLabel,
  pagesEmbedding,
  rankableKeys,
  relationsTo,
  reportCharts,
  renamePageIdInPages,
  retargetEntityList,
  retargetMasterDetail,
  retargetMasterDetailChild,
  retargetHeaderStat,
  retargetRecord,
  retargetReport,
  retargetWidget,
  retargetWizardSteps,
  seedLayout,
  slugify,
  sortableKeys,
  splitDisabledReason,
  splitListByField,
  stripDateRange,
  suggestPages,
  uniquePageId,
  valuesOf,
  viewDisabledReason,
  widgetKindDisabledReason,
  type PageLayoutValidation,
} from './pageLayout'

/** What the layout preview needs beyond the layout: the chrome language, the project-wide
 *  scaffold opts (list toolbars follow them) and which frontend set draws the shell. */
export interface PagesPreviewSettings {
  locale: 'en' | 'he'
  projectOpts: string[]
  skin: 'tailwind' | 'menora'
  /** The setup panel's dashboard heading — "Start from my entities" puts it on the dashboard page. */
  dashboardTitle?: string
  dashboardOverview?: string
}

const DEFAULT_PREVIEW_SETTINGS: PagesPreviewSettings = { locale: 'en', projectOpts: [], skin: 'tailwind' }

interface Props {
  pages: FullstackPageDef[]
  entities: FullstackEntityDef[]
  /** Opens the guide on a topic — the header's help button. Absent (the admin form): no button. */
  onOpenGuide?: (topicId: string) => void
  /** The generated shell's navigation for the layout; the preview follows it. */
  nav?: FullstackNav
  /** Present, a "Navigation" row above the pages offers the tailwind shell's variants. */
  onNavChange?: (nav: FullstackNav | undefined) => void
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
  /** Bumped by the caller (the command palette) to open the "Add page" gallery. */
  addRequest?: number
  /** Bumped by the caller (the command palette) to show the layout preview. */
  previewRequest?: number
  /** Bumped by the caller (the command palette's "Find page…") to focus the page search. */
  findRequest?: number
  /** `stacked` puts the preview under the page list at every width — for narrow hosts (the
   *  admin drawer), where the viewport-wide split would squeeze both. */
  layout?: 'split' | 'stacked'
  /** The editor's undo/redo, offered in the header too (the entities toolbar is far below). */
  history?: {
    undoLabel: string | null
    redoLabel: string | null
    onUndo: () => void
    onRedo: () => void
  }
  /** A 400 from Generate that names a page of this layout — listed with the problems and revealed. */
  serverIssue?: { page: number; message: string } | null
  /** Whether an LDAP auth dependency (ldap-auth-rest or ldap-auth) is selected, so pages can be
   *  restricted to roles. `false` disables the role boxes and offers to add the dependency;
   *  undefined (the admin form, which has no dependency list) leaves them enabled. */
  ldapAuth?: boolean
  /** Adds a backend dependency to the selection — the "Add ldap-auth-rest" shortcut under Roles. */
  onAddDep?: (dep: string) => void
}

const CHIP = 'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide'
const ICON_BUTTON = 'shrink-0 rounded-lg p-1.5 text-secondary hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary'
const SMALL_BUTTON = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant text-secondary hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:hover:text-secondary disabled:hover:border-outline-variant disabled:hover:bg-transparent'
const PREVIEW_KEY = 'fullstack:layoutPreview'
const SECTION_KEY = 'fullstack:pagesSection'
/** From this many pages on, the page list carries a search box (fewer: `/` or the palette shows it). */
const PAGE_SEARCH_FROM = 6
/** Nav page names the collapsed summary lists before it says "and N more". */
const SUMMARY_NAMES = 5

const WIDGET_KINDS: { kind: FullstackWidgetDef['kind']; icon: string; label: string; short: string; hint: string }[] = [
  { kind: 'kpi', icon: 'counter_1', label: 'Number tile', short: 'Number', hint: 'One number: a count or an aggregate' },
  { kind: 'bar', icon: 'bar_chart', label: 'Breakdown chart', short: 'Breakdown', hint: 'Bars per value of an enum or boolean field' },
  { kind: 'donut', icon: 'donut_large', label: 'Donut chart', short: 'Donut', hint: 'Shares of an enum or boolean field, as a ring' },
  { kind: 'stacked', icon: 'stacked_bar_chart', label: 'Stacked chart', short: 'Stacked', hint: 'Bars per value, each split by a second field' },
  { kind: 'line', icon: 'show_chart', label: 'Trend over time', short: 'Trend', hint: 'A line over a date, per day, month or year' },
  { kind: 'recent', icon: 'list', label: 'Recent rows', short: 'Recent', hint: 'The latest rows, newest first' },
  { kind: 'top', icon: 'format_list_numbered', label: 'Top list', short: 'Top', hint: 'The largest groups, ranked' },
  { kind: 'progress', icon: 'data_usage', label: 'Progress to target', short: 'Progress', hint: 'An aggregate against a fixed target' },
  { kind: 'text', icon: 'notes', label: 'Text note', short: 'Text', hint: 'A heading and paragraphs of your own — no data' },
  { kind: 'links', icon: 'apps', label: 'Page links', short: 'Links', hint: 'Tiles that open other pages' },
  { kind: 'list', icon: 'table_rows', label: 'Embedded list', short: 'List', hint: 'An entity’s rows in a card — your columns, sort and filter' },
]

function readPreviewOpen(): boolean {
  try { return localStorage.getItem(PREVIEW_KEY) !== 'closed' } catch { return true }
}

function readSectionOpen(): boolean {
  try { return localStorage.getItem(SECTION_KEY) !== 'closed' } catch { return true }
}

/** One line for the collapsed section: what the generated app's navigation will hold. */
function summarizeLayout(pages: FullstackPageDef[]): string {
  if (pages.length === 0) return 'Classic layout — a dashboard plus one list page per entity.'
  const labels = pages.filter(inNav).map(pageLabel)
  const more = labels.length - SUMMARY_NAMES
  const offNav = pages.length - labels.length
  const parts = [
    labels.length > 0 ? `${labels.slice(0, SUMMARY_NAMES).join(', ')}${more > 0 ? ` and ${more} more` : ''}` : 'Nothing in the navigation',
    offNav > 0 ? `${offNav} off the navigation` : '',
  ]
  return parts.filter(Boolean).join(' · ')
}

/**
 * The generated frontend's page layout: what screens the app has, in nav order, beside a live
 * wireframe of the result. Without a layout the generator falls back to the classic shell (a
 * dashboard plus one list page per entity), which "Start from my entities" materializes as an
 * editable starting point.
 */
export function PagesEditor({ pages, entities, validation, onChange, pushUndo, onClear, previewSettings, revealRequest, addRequest, previewRequest, findRequest, layout = 'split', history, serverIssue, ldapAuth, onAddDep, onOpenGuide, nav, onNavChange }: Props) {
  const keys = useStableKeys(pages, p => p.id)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  // The "Tabs" gallery card asks which pages to embed before adding anything.
  const [tabsForm, setTabsForm] = useState<{ picked: string[]; title: string; hide: boolean } | null>(null)
  // The gallery's "which entity?" step, for a page type more than one entity fits.
  const [entityForm, setEntityForm] = useState<{ type: FullstackPageType; pick: string } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null)
  const [confirmClassic, setConfirmClassic] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(readPreviewOpen)
  // The whole section folds to its header and a one-line summary; a problem reveal reopens it.
  const [sectionOpen, setSectionOpen] = useState(readSectionOpen)
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  // Below the wide split the preview opens as a slide-over instead of dropping under the list.
  const [previewDrawer, setPreviewDrawer] = useState(false)
  // With no layout yet: a preview of the classic shell, and (with one) the template gallery again.
  const [classicPreview, setClassicPreview] = useState(false)
  const [classicSelected, setClassicSelected] = useState(0)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  // "Changed widget 2 — dropped: target" after a switch that could not keep everything.
  const [notice, setNotice] = useState<string | null>(null)
  // A problem click about a widget: the dashboard form opens that card before the control is focused.
  const [expandRequest, setExpandRequest] = useState<{ page: number; widget: number; n: number } | null>(null)
  // The editor part under the pointer or keyboard focus — the preview rings its counterpart.
  const [hover, setHover] = useState<EditTarget | null>(null)
  const sectionRef = useRef<HTMLElement>(null)

  const named = entities.filter(e => e.name.trim())
  // The project-wide scaffold opts: a list page's audit columns exist only with `audit` on.
  const projectOpts = previewSettings?.projectOpts ?? []
  const atPageCap = pages.length >= MAX_PAGES
  const dnd = useDragReorder((list, from, to) => {
    if (list === 'pages') {
      const moved = moveItem(pages, from, to)
      const group = adoptedGroup(moved, to)
      if (group == null) return onChange(moved)
      pushUndo(`Moved “${pageLabel(moved[to])}” into the “${group}” group`)
      return onChange(moved.map((p, i) => (i === to ? { ...p, group } : p)))
    }
    const [kind, at, sub] = list.split(':')
    const index = Number(at)
    const page = pages[index]
    if (!page) return
    if (kind === 'wcolumns') {
      // A list widget's columns: `wcolumns:<page>:<widget>`.
      const wi = Number(sub)
      const widget = page.widgets?.[wi]
      if (!widget) return
      const all = listColumns(entities.find(e => e.name === widget.entity), projectOpts).map(c => c.key)
      const next = moveItem(widget.columns ?? all, from, to)
      const isDefault = next.length === all.length && next.every((k, i) => k === all[i])
      return update(index, { widgets: (page.widgets ?? []).map((w, j) => (j === wi ? { ...w, columns: isDefault ? undefined : next } : w)) })
    }
    if (kind === 'widgets') update(index, { widgets: moveItem(page.widgets ?? [], from, to) })
    else if (kind === 'tabs') update(index, { tabs: moveItem(page.tabs ?? [], from, to) })
    else if (kind === 'charts') {
      const charts = moveItem(reportCharts(page), from, to)
      update(index, charts.length <= 1 ? { chart: charts[0] ?? {}, charts: undefined } : { charts, chart: undefined })
    } else if (kind === 'childTabs') {
      const related = entities.filter(e => relationsTo(e, page.entity).length > 0).map(e => e.name)
      update(index, { childTabs: moveItem(page.childTabs ?? related, from, to) })
    } else if (kind === 'steps') update(index, { steps: moveItem(page.steps ?? [], from, to) })
    else if (kind === 'columns') {
      const all = listColumns(entities.find(e => e.name === page.entity), projectOpts).map(c => c.key)
      update(index, { columns: moveItem(page.columns ?? all, from, to) })
    }
  })

  const lossy: Lossy = (label, dropped) => {
    if (dropped.length === 0) return
    pushUndo(label)
    setNotice(`${label} — dropped the ${dropped.join(', ')} setting${dropped.length === 1 ? '' : 's'}, which no longer fit.`)
  }
  // A part of a page taken out (a widget, tab, chart, tile or step): its own undo entry, and a
  // notice with Undo — the button sits far from the part, so the removal should not go unseen.
  const removed: Removed = (label, detail) => {
    pushUndo(label)
    setNotice(detail ? `${label} — ${detail}.` : `${label}.`)
  }

  useEffect(() => {
    try { localStorage.setItem(PREVIEW_KEY, previewOpen ? 'open' : 'closed') } catch { /* preference only */ }
  }, [previewOpen])
  useEffect(() => {
    try { localStorage.setItem(SECTION_KEY, sectionOpen ? 'open' : 'closed') } catch { /* preference only */ }
  }, [sectionOpen])

  function update(index: number, patch: Partial<FullstackPageDef>) {
    const before = pages[index]
    let next = pages.map((p, i) => (i === index ? { ...p, ...patch } : p))
    // Tabs embed pages by id — follow the rename instead of leaving them pointing at nothing.
    if (patch.id != null && before && before.id !== patch.id && before.id) {
      next = renamePageIdInPages(next, before.id, patch.id)
    }
    onChange(next)
  }

  // Ids follow the title until the user edits one by hand — `idLocked`, kept on the page itself
  // so the choice survives a reload, an example load and a saved model.
  function retitle(index: number, title: string) {
    const page = pages[index]
    const keepsId = page.idLocked || page.type === 'dashboard'
    const patch: Partial<FullstackPageDef> = { title }
    if (!keepsId) {
      const slug = slugify(title)
      if (slug) patch.id = uniquePageId(slug, pages.filter((_, i) => i !== index).map(p => p.id))
    }
    update(index, patch)
  }

  /** Drops the hand-edited id: it follows the title again, starting now. */
  function unlockId(index: number) {
    const slug = slugify(pages[index].title ?? '')
    update(index, {
      idLocked: undefined,
      ...(slug ? { id: uniquePageId(slug, pages.filter((_, i) => i !== index).map(p => p.id)) } : {}),
    })
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

  function addPage(type: FullstackPageType, pick?: string) {
    add(blankPage(type, named, pages, pick))
    setEntityForm(null)
  }
  /** A gallery card: straight in when the type takes no entity or only one fits, else ask which. */
  function chooseType(type: FullstackPageType) {
    if (type === 'tabs') { setEntityForm(null); openTabsForm(); return }
    const fit = (newPageChoices(type, named, pages) ?? []).filter(c => !c.reason)
    setTabsForm(null)
    if (fit.length <= 1) addPage(type, fit[0]?.value)
    else setEntityForm({ type, pick: fit[0].value })
  }
  /** Why a gallery card is off: no entity fits the type (each entity's own reason is in the chooser). */
  function noFitReason(type: FullstackPageType, others: FullstackPageDef[] = pages): string | undefined {
    const choices = newPageChoices(type, named, others)
    if (!choices || choices.length === 0 || choices.some(c => !c.reason)) return undefined
    return `No entity fits: ${[...new Set(choices.map(c => c.reason!))].join('; ').toLowerCase()}`
  }
  const hasMdPair = masterDetailPairs(named).length > 0
  const tabsEligible = tabCandidates(pages)
  /** Why an existing page cannot switch to `type` — the gallery's rules, with the page itself left
   *  out (its own record/wizard slot is free to reuse, and it cannot be one of its own tabs). */
  function switchBlocked(page: FullstackPageDef, type: FullstackPageType): { short: string; reason: string } | undefined {
    if (type === page.type) return undefined
    if (type === 'master-detail' && !hasMdPair) {
      return { short: 'needs a many-to-one relation', reason: 'Add a many-to-one relation between two entities first' }
    }
    const others = pages.filter(p => p !== page)
    if (type === 'tabs') {
      return tabCandidates(others).length < MIN_TABS
        ? { short: 'needs two other pages', reason: 'A tabs page holds two or more other pages — a list, dashboard, report or master–detail' }
        : undefined
    }
    const reason = noFitReason(type, others)
    return reason ? { short: 'no entity fits', reason } : undefined
  }

  function openTabsForm() {
    setTabsForm({ picked: tabsEligible.slice(0, 2).map(p => p.id), title: 'Tabs', hide: true })
  }
  function addTabsPage() {
    if (!tabsForm) return
    const { picked, title, hide } = tabsForm
    const tabsPage: FullstackPageDef = {
      id: uniquePageId(slugify(title) || 'tabs', pages.map(p => p.id)),
      type: 'tabs',
      title: title.trim() || 'Tabs',
      tabs: picked.map(page => ({ page })),
    }
    pushUndo(`Added a tabs page over ${picked.length} pages`)
    setTabsForm(null)
    setAddOpen(false)
    onChange([
      ...(hide ? pages.map(p => (picked.includes(p.id) && !p.hidden ? { ...p, hidden: true, group: undefined, icon: undefined } : p)) : pages),
      tabsPage,
    ])
    pendingOpen.current = pages.length
  }

  // The generated nav's sections, in order — the strip above the list renames and reorders them.
  const navGroupSections = navSections(pages)
  function renameGroup(from: string, to: string) {
    pushUndo(`Renamed the “${from}” group to “${to}”`)
    onChange(renameGroupInPages(pages, from, to))
  }
  function moveGroup(sectionIndex: number, delta: number) {
    pushUndo('Reordered the navigation sections')
    onChange(moveNavGroup(pages, sectionIndex, delta))
  }

  // The preview's own handles on a dashboard: drag a widget to another slot, drag its edge wider.
  function reorderWidget(pageIndex: number, from: number, to: number) {
    update(pageIndex, { widgets: moveItem(pages[pageIndex]?.widgets ?? [], from, to) })
  }
  function resizeWidget(pageIndex: number, widgetIndex: number, span: number) {
    const widgets = pages[pageIndex]?.widgets ?? []
    update(pageIndex, { widgets: widgets.map((w, j) => (j === widgetIndex ? { ...w, span: span === defaultSpan(w.kind) ? undefined : span } : w)) })
  }

  // A page moved to another type: what the new type cannot use is dropped, and said so.
  function changeType(index: number, type: FullstackPageType) {
    const page = pages[index]
    const { page: next, dropped } = retargetPage(page, type, named, pages)
    const label = `Changed “${pageLabel(page)}” to a ${PAGE_TYPE_META[type].label.toLowerCase()} page`
    if (dropped.length) lossy(label, dropped)
    else pushUndo(label)
    onChange(pages.map((p, i) => (i === index ? next : p)))
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
    onChange(seedLayout(entities, { title: previewSettings?.dashboardTitle, description: previewSettings?.dashboardOverview }))
  }
  const layoutTemplates = useMemo(() => LAYOUT_TEMPLATES.map(t => ({ template: t, result: buildLayoutTemplate(t, entities) })), [entities])
  function startFromTemplate(label: string, built: FullstackPageDef[]) {
    pushUndo(pages.length > 0 ? `Replaced the page layout with the “${label}” template` : `Started a page layout from the “${label}” template`)
    onChange(built)
    setTemplatesOpen(false)
  }

  // Pages saved as templates, in this browser: offered in the "Add page" gallery.
  const [myTemplates, setMyTemplates] = useState(readPageTemplates)
  function saveAsTemplate(page: FullstackPageDef) {
    const name = pageLabel(page)
    const replaced = myTemplates.some(t => t.name === name)
    if (!savePageTemplate(name, page)) {
      setNotice('This browser refused to store the template (storage full or blocked).')
      return
    }
    setMyTemplates(readPageTemplates())
    setNotice(`${replaced ? 'Updated' : 'Saved'} “${name}” as a page template — add it again from Add page › My templates.`)
  }

  /** Opens a page and focuses one of its controls (or its first invalid one). */
  function reveal(target: EditTarget) {
    const key = keys[target.page]
    if (!key) return
    setSectionOpen(true)
    setOpenKey(key)
    setPreviewKey(key)
    const widget = target.control ? /^widget\.(\d+)/.exec(target.control) : null
    if (widget) setExpandRequest({ page: target.page, widget: Number(widget[1]), n: Date.now() })
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

  /** The page (by row) and control (by the nearest `data-control`) a DOM node sits in — the same
   *  keys the preview's parts are drawn under, so hovering any part of a card lights the card. */
  function targetOf(node: EventTarget | null): EditTarget | null {
    if (!(node instanceof Element)) return null
    const row = node.closest<HTMLElement>('[data-page-key]')
    const page = row?.dataset.pageKey ? keys.indexOf(row.dataset.pageKey) : -1
    if (page < 0) return null
    return { page, control: node.closest<HTMLElement>('[data-control]')?.dataset.control }
  }
  function setHoverTo(next: EditTarget | null) {
    setHover(prev => (prev?.page === next?.page && prev?.control === next?.control ? prev : next))
  }
  // Leaving with the mouse (or blurring) falls back to whatever still has keyboard focus.
  function hoverFocused() {
    const active = document.activeElement
    setHoverTo(active && sectionRef.current?.contains(active) ? targetOf(active) : null)
  }

  // The caller's "jump to the first error" lands here: the first page with a problem.
  useEffect(() => {
    if (!revealRequest) return
    const first = validation.issues.find(i => i.page != null)
    if (first) reveal({ page: first.page!, control: first.field })
    else {
      setSectionOpen(true)
      scrollToElement(sectionRef.current, 'center')
    }
  }, [revealRequest])

  // A server 400 about a page opens that page, like a local problem does.
  useEffect(() => {
    if (serverIssue) reveal({ page: serverIssue.page })
  }, [serverIssue])

  // Finding a page: the search box shows past a handful of pages, or when asked for.
  const [pageQuery, setPageQuery] = useState('')
  const [searchWanted, setSearchWanted] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const showSearch = pages.length >= PAGE_SEARCH_FROM || searchWanted || pageQuery !== ''
  const matchesQuery = (page: FullstackPageDef) => {
    const q = pageQuery.trim().toLowerCase()
    if (!q) return true
    return [pageLabel(page), page.id, page.title, page.entity, page.parent, page.child, page.group, PAGE_TYPE_META[page.type]?.label]
      .some(v => v?.toLowerCase().includes(q))
  }
  const matchCount = pages.filter(matchesQuery).length
  function focusSearch() {
    setSectionOpen(true)
    setSearchWanted(true)
    requestAnimationFrame(() => {
      searchRef.current?.focus()
      searchRef.current?.select()
    })
  }
  useEffect(() => {
    if (!findRequest) return
    focusSearch()
    requestAnimationFrame(() => scrollToElement(sectionRef.current, 'start'))
  }, [findRequest])
  /** `/` finds a page; ↑/↓ on a page title moves to the next visible one. */
  // Each radio group is one Tab stop, walked with the arrow keys (after every render: a pick
  // changes which option holds the stop).
  useLayoutEffect(() => syncRadioTabStops(sectionRef.current))
  function onSectionKey(e: ReactKeyboardEvent<HTMLElement>) {
    if (!e.ctrlKey && !e.metaKey && !e.altKey) handleRadioKeys(e)
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
    const target = e.target as HTMLElement
    const typing = target.closest('input, textarea, select, [contenteditable="true"]') !== null
    if (e.key === '/' && !typing && pages.length > 0) {
      e.preventDefault()
      focusSearch()
      return
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && target.hasAttribute('data-page-toggle')) {
      const toggles = [...(sectionRef.current?.querySelectorAll<HTMLElement>('[data-page-toggle]') ?? [])]
      const next = toggles[toggles.indexOf(target) + (e.key === 'ArrowDown' ? 1 : -1)]
      if (next) {
        e.preventDefault()
        next.focus()
      }
    }
  }

  // The command palette's "Add page": the section and its gallery open, in view.
  useEffect(() => {
    if (!addRequest) return
    setSectionOpen(true)
    setAddOpen(true)
    requestAnimationFrame(() => scrollToElement(sectionRef.current, 'start'))
  }, [addRequest])

  // ...and "Open the layout preview": beside the list where it fits, else the slide-over.
  useEffect(() => {
    if (!previewRequest) return
    setSectionOpen(true)
    setClassicPreview(true)
    const wide = typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1280px)').matches
    if (layout === 'stacked' || wide) setPreviewOpen(true)
    else setPreviewDrawer(true)
    requestAnimationFrame(() => scrollToElement(sectionRef.current, 'start'))
  }, [previewRequest, layout])

  const settings = previewSettings ?? DEFAULT_PREVIEW_SETTINGS
  const entityOptions = useMemo(() => new Map(entities.map(e => [e.name, entityOption(e)])), [entities])
  const warnPages = useMemo(() => new Set(validation.warnings.map(w => w.page).filter((p): p is number => p != null)), [validation.warnings])
  const preview = useMemo(
    () => buildLayoutPreview(pages, entities, { locale: settings.locale, projectOpts: settings.projectOpts, warnPages }),
    [pages, entities, settings.locale, settings.projectOpts, warnPages],
  )
  const classicModel = useMemo(
    () => (pages.length === 0 && classicPreview
      ? buildLayoutPreview(seedLayout(entities, { title: settings.dashboardTitle, description: settings.dashboardOverview }), entities, { locale: settings.locale, projectOpts: settings.projectOpts })
      : null),
    [pages.length, classicPreview, entities, settings.dashboardTitle, settings.dashboardOverview, settings.locale, settings.projectOpts],
  )
  const previewIndex = (() => {
    const i = previewKey ? keys.indexOf(previewKey) : -1
    return i >= 0 ? i : preview.nav[0]?.index ?? 0
  })()
  const previewPage = pages[previewIndex]
  const offNavNote = !previewPage ? undefined
    : previewPage.type === 'record' ? `Opens from a ${previewPage.entity || 'record'} row — not in the navigation.`
      : previewPage.hidden && previewPage.type === 'wizard' ? 'Link only — opened from a Page links widget or a list’s New button, not from the navigation.'
        : previewPage.hidden ? 'Tab only — reachable inside a tabs page, not from the navigation.'
        : undefined
  const suggestions = useMemo(() => suggestPages(entities, pages), [entities, pages])

  const issues = serverIssue && pages[serverIssue.page]
    ? [{ page: serverIssue.page, field: undefined, summary: `The server rejected “${pageLabel(pages[serverIssue.page])}”: ${serverIssue.message}`, fix: undefined }, ...validation.issues]
    : validation.issues
  const showPreview = pages.length > 0 && previewOpen

  return (
    <EntityOptions.Provider value={entityOptions}>
    <section
      ref={sectionRef}
      id="fs-pages"
      className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 space-y-3"
      aria-label="Frontend page layout"
      data-page-layout
      onKeyDown={onSectionKey}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-outlined text-primary mt-0.5" style={{ fontSize: '20px' }}>web</span>
          <div>
            <h2 className="text-sm font-bold text-on-surface">
              Frontend pages
              {pages.length > 0 && <span className="ms-1.5 text-[11px] font-normal text-secondary">{pages.length}</span>}
              {onOpenGuide && (
                <button
                  type="button"
                  onClick={() => onOpenGuide('fs-pages')}
                  className={`${ICON_BUTTON} ms-1 align-middle`}
                  aria-label="Open the guide on frontend pages"
                  title="How page layouts work — opens the guide"
                  data-pages-help
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>help</span>
                </button>
              )}
            </h2>
            {sectionOpen ? (
              <p className="text-[11px] text-secondary">
                The generated app opens on the first page in the navigation. A hidden page shows up only as a tab of a tabs page, and a record page opens from a row of its entity.
              </p>
            ) : (
              <p className="text-[11px] text-secondary" data-pages-summary>{summarizeLayout(pages)}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!sectionOpen && issues.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-error" role="status">
              <span className="h-1.5 w-1.5 rounded-full bg-error" aria-hidden="true" />
              {issues.length} problem{issues.length === 1 ? '' : 's'} here
            </span>
          )}
          {!sectionOpen && issues.length === 0 && validation.warnings.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300" role="status">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
              {validation.warnings.length} warning{validation.warnings.length === 1 ? '' : 's'} here
            </span>
          )}
          {sectionOpen && history && (
            <span className="inline-flex items-center">
              <button
                type="button"
                onClick={history.onUndo}
                disabled={!history.undoLabel}
                className={ICON_BUTTON}
                title={history.undoLabel ? `${history.undoLabel} (Ctrl+Z)` : 'Nothing to undo'}
                aria-label={history.undoLabel ?? 'Undo (nothing to undo)'}
                data-pages-undo
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>undo</span>
              </button>
              <button
                type="button"
                onClick={history.onRedo}
                disabled={!history.redoLabel}
                className={ICON_BUTTON}
                title={history.redoLabel ? `${history.redoLabel} (Ctrl+Shift+Z)` : 'Nothing to redo'}
                aria-label={history.redoLabel ?? 'Redo (nothing to redo)'}
                data-pages-redo
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>redo</span>
              </button>
            </span>
          )}
          {sectionOpen && pages.length > 0 && layout === 'split' && (
            <button
              type="button"
              onClick={() => setPreviewDrawer(true)}
              className={`${SMALL_BUTTON} xl:hidden`}
              title="Open a preview of the generated app"
              data-open-preview-drawer
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>preview</span>
              Open preview
            </button>
          )}
          {sectionOpen && pages.length > 0 && (
            <button
              type="button"
              onClick={() => setPreviewOpen(o => !o)}
              aria-pressed={previewOpen}
              className={`${SMALL_BUTTON} ${layout === 'split' ? 'hidden xl:inline-flex' : ''}`}
              title={previewOpen ? 'Hide the layout preview' : 'Show a preview of the generated app'}
              data-toggle-preview
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{previewOpen ? 'visibility_off' : 'preview'}</span>
              {previewOpen ? 'Hide preview' : 'Preview'}
            </button>
          )}
          {sectionOpen && pages.length > 0 && named.length > 0 && (
            <button
              type="button"
              onClick={() => setTemplatesOpen(o => !o)}
              aria-expanded={templatesOpen}
              className={SMALL_BUTTON}
              title="Replace this layout with one built from a template (undoable)"
              data-open-templates
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>auto_awesome_mosaic</span>
              Templates
            </button>
          )}
          {sectionOpen && pages.length > 0 && (
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
          {sectionOpen && (
            <button
              type="button"
              onClick={() => { setAddOpen(o => !o); setEntityForm(null) }}
              aria-expanded={addOpen}
              disabled={named.length === 0 || atPageCap}
              className={SMALL_BUTTON}
              title={named.length === 0 ? 'Name an entity first' : atPageCap ? `A layout can have at most ${MAX_PAGES} pages` : 'Add a page to the layout'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
              Add page
            </button>
          )}
          <button
            type="button"
            onClick={() => setSectionOpen(o => !o)}
            aria-label={sectionOpen ? 'Collapse frontend pages' : 'Expand frontend pages'}
            aria-expanded={sectionOpen}
            aria-controls="fs-pages-body"
            title={sectionOpen ? 'Collapse to one line' : 'Expand the page layout'}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-secondary hover:text-primary hover:bg-primary/5 transition-colors"
            data-toggle-pages-section
          >
            {sectionOpen ? 'Hide' : 'Show'}
            <span className={`material-symbols-outlined transition-transform ${sectionOpen ? 'rotate-180' : ''}`} style={{ fontSize: '16px' }}>expand_more</span>
          </button>
        </div>
      </div>

      {sectionOpen && (
      <div id="fs-pages-body" className="space-y-3">
      {named.length === 0 && (
        <p className="text-[11px] text-secondary" data-pages-need-entity>
          Pages are built from your entities — name at least one entity in the Entities section above, then add pages here.
        </p>
      )}
      {atPageCap && (
        <p className="text-[11px] text-secondary">This layout has the maximum of {MAX_PAGES} pages — remove one to add another.</p>
      )}
      {notice && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[11px] text-on-surface" role="status" data-pages-notice>
          <span className="material-symbols-outlined text-amber-600 dark:text-amber-300" style={{ fontSize: '14px' }} aria-hidden="true">info</span>
          <span className="flex-1">{notice}</span>
          {history?.undoLabel && (
            <button type="button" onClick={() => { setNotice(null); history.onUndo() }} className="font-semibold text-primary hover:underline">
              Undo
            </button>
          )}
          <button type="button" onClick={() => setNotice(null)} className={ICON_BUTTON} aria-label="Dismiss">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
          </button>
        </div>
      )}

      {addOpen && (
        <div className="space-y-2" data-page-gallery>
          {myTemplates.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">My templates</p>
              <ul className="flex flex-wrap gap-2" data-my-templates>
                {myTemplates.map(t => (
                  <li key={t.name} className="inline-flex items-center overflow-hidden rounded-lg border border-outline-variant">
                    <button
                      type="button"
                      disabled={atPageCap}
                      onClick={() => add(pageFromTemplate(t, pages))}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-on-surface hover:bg-primary/5 disabled:opacity-50"
                      title={`Add a ${PAGE_TYPE_META[t.page.type]?.label.toLowerCase() ?? t.page.type} page like “${t.name}”`}
                    >
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: '14px' }} aria-hidden="true">{PAGE_TYPE_META[t.page.type]?.icon ?? 'web_asset'}</span>
                      {t.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => { deletePageTemplate(t.name); setMyTemplates(readPageTemplates()) }}
                      className="px-1.5 py-1 text-secondary hover:bg-error/5 hover:text-error"
                      aria-label={`Forget the template “${t.name}”`}
                      title="Forget this template"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">close</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
              const reason = type === 'master-detail' && !hasMdPair
                ? 'Add a many-to-one relation between two entities first (the child’s Relations table)'
                : type === 'tabs' && tabsEligible.length < MIN_TABS
                  ? 'Add two pages that can be tabs first — a list, dashboard, report or master–detail'
                  : noFitReason(type)
              return (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => chooseType(type)}
                    disabled={Boolean(reason)}
                    title={reason}
                    aria-pressed={type === 'tabs' ? tabsForm != null : entityForm?.type === type ? true : undefined}
                    className="w-full h-full text-start rounded-lg border border-outline-variant px-3 py-2 hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-outline-variant disabled:hover:bg-transparent"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }} aria-hidden="true">{meta.icon}</span>
                      {meta.label}
                    </span>
                    <span className="block mt-0.5 text-[11px] text-secondary">{reason ?? meta.blurb}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {entityForm && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2" data-entity-form>
              <p className="text-xs font-semibold text-on-surface">
                New {PAGE_TYPE_META[entityForm.type].label.toLowerCase()} page — {entityForm.type === 'master-detail' ? 'which parent and child?' : 'which entity?'}
              </p>
              <ul role="radiogroup" aria-label="Entity for the new page" className="flex flex-wrap gap-2">
                {(newPageChoices(entityForm.type, named, pages) ?? []).map(c => {
                  const on = entityForm.pick === c.value
                  return (
                    <li key={c.value}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={Boolean(c.reason)}
                        title={c.reason}
                        onClick={() => setEntityForm({ ...entityForm, pick: c.value })}
                        onDoubleClick={() => { if (!c.reason) addPage(entityForm.type, c.value) }}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-primary/50 bg-primary/10 font-semibold text-primary' : 'border-outline-variant text-on-surface hover:border-primary/40'}`}
                      >
                        {c.label}
                        {c.reason && <span className="text-[10px] text-secondary">· {c.reason}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => addPage(entityForm.type, entityForm.pick)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary"
                >
                  Add {PAGE_TYPE_META[entityForm.type].label.toLowerCase()} page
                </button>
                <button type="button" onClick={() => setEntityForm(null)} className={SMALL_BUTTON}>Cancel</button>
              </div>
            </div>
          )}
          {tabsForm && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2" data-tabs-form>
              <p className="text-xs font-semibold text-on-surface">New tabs page</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-secondary" htmlFor="new-tabs-title">Title</label>
                <input
                  id="new-tabs-title"
                  type="text"
                  aria-label="Tabs page title"
                  value={tabsForm.title}
                  onChange={e => setTabsForm({ ...tabsForm, title: e.target.value })}
                  className={`${inputClass()} max-w-[14rem] py-1 text-xs`}
                />
              </div>
              <p className="text-[11px] text-secondary">Pages to show as tabs, {MIN_TABS} to {MAX_TABS}, in this order:</p>
              <ul className="flex flex-wrap gap-2">
                {tabsEligible.map(p => {
                  const on = tabsForm.picked.includes(p.id)
                  return (
                    <li key={p.id}>
                      <label className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${on ? 'border-primary/50 bg-primary/10 text-primary' : 'border-outline-variant text-on-surface'}`}>
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={on}
                          aria-label={`Tab: ${pageLabel(p)}`}
                          onChange={() => setTabsForm({ ...tabsForm, picked: on ? tabsForm.picked.filter(id => id !== p.id) : [...tabsForm.picked, p.id] })}
                        />
                        {pageLabel(p)}
                        <span className="text-[10px] text-secondary">{PAGE_TYPE_META[p.type]?.label ?? p.type}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
              <label className="inline-flex items-center gap-1.5 text-xs text-on-surface">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={tabsForm.hide}
                  aria-label="Hide these pages from the navigation"
                  onChange={e => setTabsForm({ ...tabsForm, hide: e.target.checked })}
                />
                Hide these pages from the navigation — they open only as tabs
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={addTabsPage}
                  disabled={tabsForm.picked.length < MIN_TABS || tabsForm.picked.length > MAX_TABS}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary disabled:opacity-50"
                  title={tabsForm.picked.length < MIN_TABS ? `Pick at least ${MIN_TABS} pages` : tabsForm.picked.length > MAX_TABS ? `At most ${MAX_TABS} tabs` : undefined}
                >
                  Add tabs page
                </button>
                <button type="button" onClick={() => setTabsForm(null)} className={SMALL_BUTTON}>Cancel</button>
                <span className="text-[10px] text-secondary">{tabsForm.picked.length} of {MAX_TABS} picked</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Announced as a count, politely — the list itself would be read out again on every edit. */}
      <p className="sr-only" role="status">
        {issues.length === 0 ? '' : `${issues.length} layout problem${issues.length === 1 ? '' : 's'}`}
      </p>
      {issues.length > 0 && (
        <ul className="rounded-lg border border-error/40 bg-error/5 px-3 py-2 space-y-1" aria-label="Layout problems" data-page-layout-problems>
          {issues.map((issue, i) => (
            <li key={`${i}:${issue.summary}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 text-[11px] text-error">
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
              {issue.fix && (
                <button
                  type="button"
                  onClick={() => {
                    pushUndo(issue.fix!.label)
                    onChange(issue.fix!.apply(pages))
                  }}
                  className="inline-flex items-center gap-1 rounded border border-error/40 px-1.5 py-0.5 text-[10px] font-semibold text-error hover:bg-error/10"
                  title="Apply this fix (undoable)"
                  data-page-fix
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }} aria-hidden="true">auto_fix_high</span>
                  Fix: {issue.fix.label}
                </button>
              )}
              {issue.alsoFix && (
                <button
                  type="button"
                  onClick={() => {
                    pushUndo(issue.alsoFix!.label)
                    onChange(issue.alsoFix!.apply(pages))
                  }}
                  className="inline-flex items-center gap-1 rounded border border-error/30 px-1.5 py-0.5 text-[10px] text-error hover:bg-error/10"
                  title="Apply this fix instead (undoable)"
                  data-page-fix-alt
                >
                  or {issue.alsoFix.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {sectionOpen && validation.warnings.length > 0 && (
        <ul
          className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 space-y-1"
          role="status"
          aria-label="Layout warnings"
          data-page-layout-warnings
        >
          {validation.warnings.map((warning, i) => (
            <li key={`${i}:${warning.summary}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 text-[11px] text-amber-800 dark:text-amber-200">
              {warning.page != null ? (
                <button
                  type="button"
                  onClick={() => reveal({ page: warning.page!, control: warning.field })}
                  className="flex items-start gap-1.5 text-start hover:underline"
                  title="Open this page at the warning"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }} aria-hidden="true">warning</span>
                  {warning.summary}
                </button>
              ) : (
                <span className="flex items-start gap-1.5">
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }} aria-hidden="true">warning</span>
                  {warning.summary}
                </span>
              )}
              {warning.fix && (
                <button
                  type="button"
                  onClick={() => {
                    pushUndo(warning.fix!.label)
                    onChange(warning.fix!.apply(pages))
                  }}
                  className="inline-flex items-center gap-1 rounded border border-amber-500/50 px-1.5 py-0.5 text-[10px] font-semibold hover:bg-amber-400/20"
                  title="Apply this fix (undoable)"
                  data-page-fix
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }} aria-hidden="true">auto_fix_high</span>
                  Fix: {warning.fix.label}
                </button>
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
          {named.length > 0 && (
            <button
              type="button"
              onClick={() => setClassicPreview(o => !o)}
              aria-pressed={classicPreview}
              className={SMALL_BUTTON}
              title="See what the classic layout generates"
              data-classic-preview
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{classicPreview ? 'visibility_off' : 'preview'}</span>
              {classicPreview ? 'Hide preview' : 'Preview'}
            </button>
          )}
          {classicModel && (
            <div className="w-full space-y-1.5" aria-label="Classic layout preview" role="region">
              <p className="text-[11px] text-secondary">Sample data · this is the app you get without a page layout</p>
              <LayoutPreview
                preview={classicModel}
                selected={classicSelected}
                onSelect={setClassicSelected}
                onEdit={() => {}}
                skin={settings.skin}
              />
            </div>
          )}
          {named.length > 0 && (
            <div className="w-full space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Or start from a layout template</p>
              <TemplateGallery templates={layoutTemplates} onPick={startFromTemplate} />
            </div>
          )}
        </div>
      ) : (
        <>
        {templatesOpen && (
          <div className="mb-2 space-y-1 rounded-lg border border-dashed border-outline-variant px-3 py-2" data-replace-templates>
            <p className="text-[11px] text-secondary">
              <span className="font-semibold text-on-surface">Replace the layout</span> — builds a new one from your entities; Undo brings this one back.
            </p>
            <TemplateGallery templates={layoutTemplates} onPick={startFromTemplate} />
          </div>
        )}
        <div className={!showPreview ? '' : layout === 'stacked' ? 'space-y-3' : 'grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]'}>
          {/* The left column: the navigation strips over the page list. One grid cell, so the preview keeps its own. */}
          <div className="min-w-0 space-y-2">
          {onNavChange && settings.skin === 'tailwind' && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant px-2 py-1" data-nav-options>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary" title="How the generated app lays out its navigation">Nav style</span>
              <span role="radiogroup" aria-label="Navigation style" className="inline-flex overflow-hidden rounded border border-outline-variant">
                {([['sidebar', 'Sidebar'], ['topbar', 'Top bar']] as const).map(([value, label]) => {
                  const on = (nav?.style ?? 'sidebar') === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={label}
                      onClick={() => onNavChange(value === 'sidebar' ? (nav?.collapsibleGroups ? { collapsibleGroups: true } : undefined) : { ...nav, style: value })}
                      className={`px-2 py-0.5 text-[11px] ${on ? 'bg-primary/15 font-semibold text-primary' : 'text-secondary hover:bg-primary/5'}`}
                    >
                      {label}
                    </button>
                  )
                })}
              </span>
              <label className="inline-flex items-center gap-1.5 text-[11px] text-on-surface" title="Nav sections with a group name fold">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={Boolean(nav?.collapsibleGroups)}
                  aria-label="Collapsible groups"
                  onChange={e => onNavChange(e.target.checked ? { ...nav, collapsibleGroups: true } : (nav?.style && nav.style !== 'sidebar' ? { style: nav.style } : undefined))}
                />
                Collapsible groups
              </label>
            </div>
          )}
          {navGroupSections.some(s => s.group) && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-outline-variant px-2 py-1" data-nav-groups>
              <span
                className="text-[11px] font-semibold uppercase tracking-wider text-secondary"
                title="The sections of the generated navigation, in order. Rename a group here to rename it on every page; move a section past its neighbour."
              >
                Nav groups
              </span>
              {navGroupSections.map((s, si) => (s.group ? (
                <GroupChip
                  key={s.group}
                  group={s.group}
                  count={s.items.length}
                  canUp={si > 0}
                  canDown={si < navGroupSections.length - 1}
                  onRename={to => renameGroup(s.group!, to)}
                  onMove={delta => moveGroup(si, delta)}
                />
              ) : (
                <span key={`loose-${si}`} className="inline-flex items-center gap-1 rounded-full border border-outline-variant px-2 py-0.5 text-[11px] text-secondary" data-nav-group="">
                  Ungrouped <span>{s.items.length}</span>
                  <MoveButtons label={`the ungrouped pages${si > 0 ? ` (section ${si + 1})` : ''}`} canUp={si > 0} canDown={si < navGroupSections.length - 1} onMove={delta => moveGroup(si, delta)} />
                </span>
              )))}
            </div>
          )}
          {showSearch && (
            <div className="flex items-center gap-2" data-page-search>
              <label className="relative min-w-0 flex-1">
                <span className="material-symbols-outlined pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-secondary" style={{ fontSize: '16px' }} aria-hidden="true">search</span>
                <input
                  ref={searchRef}
                  type="search"
                  aria-label="Find a page"
                  placeholder="Find a page — title, route, entity, type or group"
                  value={pageQuery}
                  onChange={e => setPageQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setPageQuery('')
                      setSearchWanted(false)
                      e.currentTarget.blur()
                    } else if (e.key === 'Enter') {
                      // Enter opens the first match.
                      const first = pages.findIndex(matchesQuery)
                      if (first >= 0) { e.preventDefault(); openPage(first) }
                    }
                  }}
                  className={`${inputClass()} py-1 ps-7 text-xs`}
                />
              </label>
              {pageQuery.trim() && (
                <span className="shrink-0 text-[11px] text-secondary" data-page-search-count>{matchCount} of {pages.length}</span>
              )}
            </div>
          )}
          {pageQuery.trim() && matchCount === 0 && (
            <p className="text-[11px] text-secondary" data-page-search-empty>No page matches “{pageQuery.trim()}”.</p>
          )}
          <ol
            className="min-w-0 space-y-2"
            onMouseOver={e => setHoverTo(targetOf(e.target))}
            onMouseLeave={hoverFocused}
            onFocus={e => setHoverTo(targetOf(e.target))}
            onBlur={hoverFocused}
          >
            {pages.map((page, index) => {
              const key = keys[index]
              const meta = PAGE_TYPE_META[page.type] ?? { icon: 'web_asset', label: page.type, blurb: '' }
              const errors = validation.byPage[index] ?? {}
              const errorCount = Object.keys(errors).length
              const warningCount = validation.warningsByPage[index] ?? 0
              const open = openKey === key
              const indicator = dnd.indicatorFor('pages', index)
              const isStart = preview.nav[0]?.index === index
              if (!matchesQuery(page)) return null
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
                      data-page-toggle
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-start"
                    >
                      <span className="truncate text-xs font-semibold text-on-surface">{pageLabel(page)}</span>
                      <span className={`${CHIP} bg-primary/10 text-primary`}>{meta.label}</span>
                      {isStart && (
                        <span className={`${CHIP} bg-amber-400/15 text-amber-700 dark:text-amber-300`} title="The generated app opens on this page" data-start-page>
                          Start page
                        </span>
                      )}
                      {(page.roles?.length ?? 0) > 0 && (
                        <span className={`${CHIP} bg-surface-container text-secondary`} title="Only users with these roles see this page" data-page-roles>
                          <span className="material-symbols-outlined align-[-2px]" style={{ fontSize: '11px' }} aria-hidden="true">lock</span> {page.roles!.join(' / ')}
                        </span>
                      )}
                      {page.hidden && page.type !== 'record' && (
                        page.type === 'wizard'
                          ? <span className={`${CHIP} bg-surface-container text-secondary`} title="Hidden from the navigation — opened from a Page links widget or a list’s New button">Link only</span>
                          : <span className={`${CHIP} bg-surface-container text-secondary`} title="Hidden from the navigation — opens inside a tabs page">Tab only</span>
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
                      {warningCount > 0 && (
                        <span className={`${CHIP} bg-amber-400/15 text-amber-700 dark:text-amber-300`} title="The layout warnings above say what to check" data-page-warnings>
                          {warningCount} warning{warningCount === 1 ? '' : 's'}
                        </span>
                      )}
                      <span className="truncate text-[11px] text-secondary">{describePage(page, pages)}</span>
                    </button>
                    {inNav(page) && !isStart && (
                      <button
                        type="button"
                        onClick={() => {
                          pushUndo(`Made “${pageLabel(page)}” the start page`)
                          onChange(moveItem(pages, index, preview.nav[0]?.index ?? 0))
                        }}
                        className={ICON_BUTTON}
                        title="Make this the start page (the app opens here)"
                        aria-label={`Make ${pageLabel(page)} the start page`}
                        data-make-start
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>home</span>
                      </button>
                    )}
                    {page.type !== 'record' && (
                      <button
                        type="button"
                        onClick={() => update(index, page.hidden ? { hidden: false } : { hidden: true, group: undefined, icon: undefined })}
                        className={ICON_BUTTON}
                        aria-pressed={Boolean(page.hidden)}
                        title={page.hidden ? 'Show in the navigation' : page.type === 'wizard' ? 'Hide from the navigation (link only)' : 'Hide from the navigation (tab only)'}
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
                      <div className="flex flex-wrap items-center gap-2" data-control="type">
                        <button
                          type="button"
                          onClick={() => saveAsTemplate(page)}
                          className={`${SMALL_BUTTON} order-last ms-auto`}
                          title="Keep this page's settings to add it again later (this browser)"
                          data-save-template
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">bookmark_add</span>
                          Save as template
                        </button>
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-secondary" htmlFor={`page-type-${key}`}>Page type</label>
                        <select
                          id={`page-type-${key}`}
                          aria-label="Page type"
                          value={page.type}
                          onChange={e => changeType(index, e.target.value as FullstackPageType)}
                          className={`${inputClass()} max-w-[12rem] py-1 text-xs`}
                          data-page-type
                        >
                          {(Object.keys(PAGE_TYPE_META) as FullstackPageType[]).map(t => {
                            const blocked = switchBlocked(page, t)
                            return <option key={t} value={t} disabled={blocked != null} title={blocked?.reason}>{PAGE_TYPE_META[t].label}{blocked ? ` — ${blocked.short}` : ''}</option>
                          })}
                        </select>
                        <span className="text-[10px] text-secondary">Changing the type keeps the title, place and entity; settings the new type cannot use are dropped (undoable)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Field label="Title" error={errors.title} control="title" hint={isStart ? 'The start page — the app opens here, for everyone' : undefined}>
                          <input
                            type="text"
                            aria-label="Page title"
                            aria-invalid={Boolean(errors.title)}
                            value={page.title ?? ''}
                            maxLength={MAX_TITLE}
                            onChange={e => retitle(index, e.target.value)}
                            placeholder={pageLabel(page)}
                            className={inputClass(errors.title)}
                          />
                        </Field>
                        <details className="space-y-1" data-control="id" data-page-id-details open={errors.id ? true : undefined}>
                          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-secondary" title="The page's route — its address in the app (#/id) and its screen file name. Open to edit the id.">
                            Route <span className="font-mono normal-case tracking-normal text-on-surface">#/{page.id || '…'}</span>
                            <span className="ms-1 font-normal normal-case tracking-normal">· edit</span>
                          </summary>
                          <input
                            type="text"
                            aria-label="Page id"
                            aria-invalid={Boolean(errors.id)}
                            value={page.id}
                            onChange={e => update(index, { id: e.target.value, idLocked: true })}
                            className={`${inputClass(errors.id)} font-mono`}
                          />
                          {page.idLocked && page.type !== 'dashboard' && (
                            <button
                              type="button"
                              onClick={() => unlockId(index)}
                              className="mt-1 text-[11px] font-semibold text-primary hover:underline"
                              data-unlock-id
                            >
                              Follow the title again
                            </button>
                          )}
                          {errors.id
                            ? <p className="text-[11px] text-error">{errors.id}</p>
                            : <p className="text-[10px] text-secondary">{`${page.idLocked || page.type === 'dashboard' ? 'The URL and screen file' : 'Follows the title until you edit it'} · lower-case letters, digits and dashes`}</p>}
                        </details>
                        <Field label="Description" error={errors.description} control="description">
                          <input
                            type="text"
                            aria-label="Page description"
                            aria-invalid={Boolean(errors.description)}
                            value={page.description ?? ''}
                            maxLength={MAX_DESCRIPTION}
                            onChange={e => update(index, { description: e.target.value || undefined })}
                            placeholder="Optional line under the heading"
                            className={inputClass(errors.description)}
                          />
                        </Field>
                      </div>
                      {inNav(page) && (
                        <NavFields page={page} index={index} pages={pages} errors={errors} update={update} />
                      )}
                      <RolesField page={page} index={index} errors={errors} update={update} ldapAuth={ldapAuth} onAddDep={onAddDep} isStart={isStart} />

                      {page.type === 'entity-list' && (
                        <EntityListForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} dnd={dnd} projectOpts={projectOpts} pages={pages} pushUndo={pushUndo} onChange={onChange} />
                      )}
                      {page.type === 'dashboard' && (
                        <DashboardForm
                          page={page}
                          index={index}
                          pages={pages}
                          projectOpts={projectOpts}
                          entities={named}
                          errors={errors}
                          update={update}
                          lossy={lossy}
                          removed={removed}
                          dnd={dnd}
                          expandRequest={expandRequest?.page === index ? expandRequest : null}
                        />
                      )}
                      {page.type === 'tabs' && (
                        <TabsForm page={page} index={index} pages={pages} errors={errors} update={update} dnd={dnd} removed={removed} />
                      )}
                      {page.type === 'master-detail' && (
                        <MasterDetailForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} projectOpts={projectOpts} />
                      )}
                      {page.type === 'record' && (
                        <RecordForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} removed={removed} dnd={dnd} projectOpts={projectOpts} />
                      )}
                      {page.type === 'report' && (
                        <ReportForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} removed={removed} dnd={dnd} />
                      )}
                      {page.type === 'wizard' && (
                        <WizardForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} removed={removed} dnd={dnd} />
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          </div>
          {showPreview && (
            <aside className={`min-w-0 space-y-1.5 ${layout === 'split' ? 'hidden xl:block xl:sticky xl:top-20 xl:self-start' : ''}`} aria-label="Layout preview">
              <p className="flex items-center justify-between gap-2 text-[11px] text-secondary">
                <span className="font-semibold uppercase tracking-wider">Preview</span>
                <span>Sample data · click a part to edit it</span>
              </p>
              <LayoutPreview
                preview={preview}
                selected={previewIndex}
                onSelect={i => setPreviewKey(keys[i] ?? null)}
                onEdit={reveal}
                highlight={hover}
                skin={settings.skin}
                offNavNote={offNavNote}
                onReorderWidget={reorderWidget}
                onResizeWidget={resizeWidget}
                navStyle={nav?.style}
                collapsibleGroups={nav?.collapsibleGroups}
              />
            </aside>
          )}
        </div>
        </>
      )}
      </div>
      )}

      {previewDrawer && pages.length > 0 && (
        <PreviewDrawer onClose={() => setPreviewDrawer(false)}>
          <LayoutPreview
            preview={preview}
            selected={previewIndex}
            onSelect={i => setPreviewKey(keys[i] ?? null)}
            onEdit={target => { setPreviewDrawer(false); reveal(target) }}
            highlight={hover}
            skin={settings.skin}
            offNavNote={offNavNote}
            onReorderWidget={reorderWidget}
            onResizeWidget={resizeWidget}
            navStyle={nav?.style}
            collapsibleGroups={nav?.collapsibleGroups}
          />
        </PreviewDrawer>
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
    </EntityOptions.Provider>
  )
}

/** The whole-layout templates: what each builds (its pages, listed), or why the model cannot fill it. */
function TemplateGallery({ templates, onPick }: {
  templates: { template: LayoutTemplate; result: ReturnType<typeof buildLayoutTemplate> }[]
  onPick: (label: string, pages: FullstackPageDef[]) => void
}) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" data-layout-templates>
      {templates.map(({ template, result }) => {
        const reason = 'reason' in result ? result.reason : undefined
        const built = 'pages' in result ? result.pages : []
        const names = built.map(p => pageLabel(p)).join(' · ')
        return (
          <li key={template.key}>
            <button
              type="button"
              disabled={Boolean(reason)}
              title={reason ?? `Builds: ${names}`}
              onClick={() => { if (!reason) onPick(template.label, built) }}
              className="h-full w-full rounded-lg border border-outline-variant px-3 py-2 text-start transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-outline-variant disabled:hover:bg-transparent"
              data-layout-template={template.key}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }} aria-hidden="true">{template.icon}</span>
                {template.label}
                {!reason && <span className="text-[10px] font-normal text-secondary">· {built.length} pages</span>}
              </span>
              <span className="mt-0.5 block text-[11px] text-secondary">{reason ?? template.blurb}</span>
              {!reason && <span className="mt-1 block line-clamp-2 text-[10px] text-secondary/80" data-template-pages>{names}</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ── Per-type forms ─────────────────────────────────────────────────────────

type Update = (index: number, patch: Partial<FullstackPageDef>) => void
/** Records an undo entry before a change that drops settings, and says what was dropped. */
type Lossy = (label: string, dropped: string[]) => void
/** Records an undo entry before a part of a page is removed, and says so with an Undo. */
type Removed = (label: string, detail?: string) => void
interface FormProps {
  page: FullstackPageDef
  index: number
  entities: FullstackEntityDef[]
  errors: Record<string, string>
  update: Update
  lossy: Lossy
  removed?: Removed
}

/** Where a nav page sits in the generated nav: its section (group) and its icon. */
function NavFields({ page, index, pages, errors, update }: Omit<FormProps, 'entities' | 'lossy'> & { pages: FullstackPageDef[] }) {
  const groups = [...new Set(pages.map(p => p.group?.trim()).filter((g): g is string => Boolean(g)))]
  const fallback = DEFAULT_NAV_ICON[page.type]
  const current = page.icon ?? fallback
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <Field label="Nav group" error={errors.group} control="group" hint={`Pages with the same group are listed together · up to ${MAX_GROUP} characters`}>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="text"
            list={`nav-groups-${index}`}
            aria-label="Nav group"
            aria-invalid={Boolean(errors.group)}
            maxLength={MAX_GROUP}
            value={page.group ?? ''}
            onChange={e => update(index, { group: e.target.value || undefined })}
            placeholder="None"
            className={`${inputClass(errors.group)} min-w-0 flex-1`}
          />
          {groups.some(g => g !== page.group?.trim()) && (
            <select
              aria-label="Move to group"
              value={groups.includes(page.group?.trim() ?? '') ? page.group!.trim() : ''}
              onChange={e => update(index, { group: e.target.value || undefined })}
              className={`${inputClass()} max-w-[10rem] py-1 text-xs`}
              title="Put this page in one of the existing groups"
            >
              <option value="">No group</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
        </div>
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

/** Who may open the page: everyone, or users holding one of the generated security's roles. Always shown, so the option is discoverable: without an LDAP auth
 *  dependency the boxes are disabled and a shortcut adds ldap-auth-rest. */
function RolesField({ page, index, errors, update, ldapAuth, onAddDep, isStart }: Omit<FormProps, 'entities' | 'lossy'> & { ldapAuth?: boolean; onAddDep?: (dep: string) => void; isStart?: boolean }) {
  const roles = page.roles ?? []
  const noLdap = ldapAuth === false
  // The start page is open to everyone; the boxes stay live on a start page that already has
  // roles (from a load), so the user can clear them.
  const locked = Boolean(isStart) && roles.length === 0
  const toggle = (role: FullstackPageRole) => {
    const next = roles.includes(role) ? roles.filter(r => r !== role) : [...roles, role]
    update(index, { roles: next.length ? next : undefined })
  }
  return (
    <Field
      label="Who can open it"
      error={errors.roles}
      control="roles"
      hint={roles.length
        ? 'Hidden from the nav, and blocked, for users without one of these roles (checked against their LDAP groups)'
        : locked ? 'The start page is open to everyone — make another page the start page to restrict this one'
          : noLdap ? 'Restricting pages needs ldap-auth-rest (or ldap-auth) among the backend dependencies'
            : 'Everyone — tick a role to restrict the page'}
    >
      <div className="flex flex-wrap items-center gap-3">
        {PAGE_ROLES.map(role => (
          <label key={role} className={`inline-flex items-center gap-1.5 text-xs ${(noLdap || locked) && !roles.includes(role) ? 'text-secondary/70' : 'text-on-surface'}`}>
            <input
              type="checkbox"
              checked={roles.includes(role)}
              disabled={(noLdap || locked) && !roles.includes(role)}
              onChange={() => toggle(role)}
              className="accent-primary"
              aria-label={`Only ${role}`}
            />
            {role === 'ADMIN' ? 'Admins' : 'Users'} <span className="font-mono text-[10px] text-secondary">{role}</span>
          </label>
        ))}
        {noLdap && !locked && onAddDep && (
          <button type="button" onClick={() => onAddDep('ldap-auth-rest')} className={SMALL_BUTTON} data-add-ldap-auth>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">add</span>
            Add ldap-auth-rest
          </button>
        )}
      </div>
    </Field>
  )
}

/** One nav section in the strip: its name is edited in place (committed on blur or Enter, Escape
 *  reverts) and it moves past its neighbours with the arrows. */
function GroupChip({ group, count, canUp, canDown, onRename, onMove }: {
  group: string
  count: number
  canUp: boolean
  canDown: boolean
  onRename: (to: string) => void
  onMove: (delta: number) => void
}) {
  const [draft, setDraft] = useState(group)
  useEffect(() => setDraft(group), [group])
  const commit = () => {
    const to = draft.trim()
    if (to && to !== group) onRename(to)
    else setDraft(group)
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-[11px]" data-nav-group={group}>
      <input
        type="text"
        aria-label={`Rename the ${group} group`}
        title="Rename this group on every page in it"
        value={draft}
        maxLength={MAX_GROUP}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
          if (e.key === 'Escape') setDraft(group)
        }}
        style={{ width: `${Math.max(4, draft.length + 1)}ch` }}
        className="bg-transparent font-semibold text-on-surface outline-none focus:underline"
      />
      <span className="text-secondary">{count}</span>
      <MoveButtons label={`the ${group} group`} canUp={canUp} canDown={canDown} onMove={onMove} />
    </span>
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

/** The "opens filtered on" rows of a list, report or widget: a value of a filterable enum/boolean
 *  column, or a period/range on a date or number column — what the backend accepts as a preset. */
function PresetFilters({ filter, entity, errors, onChange, heading = 'Opens filtered on', controlPrefix = 'presetFilter.' }: {
  filter: Record<string, string> | undefined
  entity: FullstackEntityDef | undefined
  /** Per-field messages under `presetFilter.<field>`. */
  errors: Record<string, string>
  onChange: (next: Record<string, string> | undefined) => void
  heading?: string
  /** The `data-control` prefix a problem reveals — a widget's filters live under its own. */
  controlPrefix?: string
}) {
  const filterable = presettableFields(entity)
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
            ? `Every row — ${entity?.name ?? 'this entity'} has no filterable enum, boolean, date or number field to preset.`
            : 'Every row (no preset filter).'}
        </p>
      )}
      {filters.map(([field, value]) => {
        const f = filterable.find(x => x.name === field)
        const error = errors[`presetFilter.${field}`]
        return (
          <div key={field} className="flex items-center gap-2" data-preset-filter={field} data-control={`${controlPrefix}${field}`}>
            <select
              aria-label="Filter field"
              aria-invalid={Boolean(error)}
              value={field}
              onChange={e => setFilter(field, value, e.target.value)}
              className={`${inputClass(error)} max-w-[12rem] py-1 text-xs`}
            >
              <option value={field}>{f ? fieldOption(f) : field}</option>
              {unused.map(o => <option key={o.name} value={o.name}>{fieldOption(o)}</option>)}
            </select>
            {f && presetKind(f) !== 'choice' ? (
              <PresetRangeInput field={f} value={value} error={error} onChange={v => setFilter(field, v)} />
            ) : (
              <select
                aria-label={`Filter value for ${field}`}
                value={value}
                onChange={e => setFilter(field, e.target.value)}
                className={`${inputClass(error)} max-w-[12rem] py-1 text-xs`}
              >
                {!valuesOf(f).includes(value) && <option value={value}>{value}</option>}
                {valuesOf(f).map(v => <option key={v} value={v}>{enumValueOption(f, v)}</option>)}
              </select>
            )}
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
          onClick={() => setFilter(unused[0].name, defaultPresetValue(unused[0]))}
          className={SMALL_BUTTON}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>filter_alt</span>
          Add filter
        </button>
      )}
    </div>
  )
}

/** A date field's preset (a period ending today, or two dates) or a number field's (min and max),
 *  edited as controls and stored as the wire spelling (`last:30d`, `2026-01-01..2026-03-31`, `100..500`). */
function PresetRangeInput({ field, value, error, onChange }: {
  field: FullstackFieldDef
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  const kind = presetKind(field)
  const period = PRESET_PERIODS.find(p => p.value === value.trim().toLowerCase())
  const range = parsePresetRange(value) ?? { from: '', to: '' }
  const custom = kind === 'date' && !period
  const box = `${inputClass(error)} w-[9rem] py-1 text-xs`
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-preset-range={field.name}>
      {kind === 'date' && (
        <select
          aria-label={`Filter period for ${field.name}`}
          value={period ? period.value : 'custom'}
          onChange={e => onChange(e.target.value === 'custom' ? `${range.from}..${range.to}` : e.target.value)}
          className={`${inputClass(error)} max-w-[10rem] py-1 text-xs`}
        >
          {PRESET_PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          <option value="custom">Between dates…</option>
        </select>
      )}
      {(custom || kind === 'number') && (
        <>
          <input
            type={kind === 'date' ? 'date' : 'number'}
            aria-label={`${kind === 'date' ? 'From date' : 'Min'} for ${field.name}`}
            value={range.from}
            step={kind === 'number' ? 'any' : undefined}
            onChange={e => onChange(`${e.target.value}..${range.to}`)}
            className={box}
          />
          <span className="text-[11px] text-secondary">to</span>
          <input
            type={kind === 'date' ? 'date' : 'number'}
            aria-label={`${kind === 'date' ? 'To date' : 'Max'} for ${field.name}`}
            value={range.to}
            step={kind === 'number' ? 'any' : undefined}
            onChange={e => onChange(`${range.from}..${e.target.value}`)}
            className={box}
          />
        </>
      )}
    </span>
  )
}

function EntityListForm({ page, index, entities, errors, update, lossy, dnd, projectOpts, pages, pushUndo, onChange }: FormProps & {
  dnd: ReturnType<typeof useDragReorder>
  projectOpts: string[]
  /** The whole layout — "Split into tabs" adds pages beside this one. */
  pages: FullstackPageDef[]
  pushUndo: (label: string) => void
  onChange: (next: FullstackPageDef[]) => void
}) {
  const entity = entities.find(e => e.name === page.entity)
  const columns = listColumns(entity, projectOpts)
  const hasRecord = pages.some(p => p.type === 'record' && p.entity?.trim().toLowerCase() === entity?.name.trim().toLowerCase())
  const singlePkEntity = (e: FullstackEntityDef) => e.fields.filter(f => f.primaryKey).length === 1
  // "Split into tabs": one hidden list per value of an enum/boolean field, under a tabs page.
  const splittable = groupableFields(entity)
  const [pickedSplit, setPickedSplit] = useState('')
  const splitField = splittable.find(f => f.name === pickedSplit) ?? splittable[0]
  const splitReason = splitDisabledReason(page, splitField, pages)
  function split() {
    if (!splitField || splitReason) return
    pushUndo(`Split “${pageLabel(page)}” by ${splitField.name}`)
    onChange(splitListByField(page, splitField, pages))
  }
  const allKeys = columns.map(c => c.key)
  // Omitted columns means every column in the generated order — the same default the generator applies.
  const shown = page.columns ?? allKeys
  const hidden = allKeys.filter(k => !shown.includes(k))
  const sortable = sortableKeys(entity, projectOpts)
  const views = enabledListViews(entity)
  const list = `columns:${index}`
  const labelOf = (key: string) => columns.find(c => c.key === key)?.label ?? key

  const setColumns = (next: string[]) => {
    const isDefault = next.length === allKeys.length && next.every((k, i) => k === allKeys[i])
    update(index, { columns: isDefault ? undefined : next })
  }
  const toggle = (key: string) => {
    if (!shown.includes(key)) setColumns([...shown, key])
    else if (shown.length > 1) setColumns(shown.filter(k => k !== key))
  }
  const setSort = (field: string | undefined, dir: 'asc' | 'desc' | undefined) =>
    update(index, { sort: field ? { field, ...(dir === 'desc' ? { dir } : {}) } : undefined })

  return (
    <div className="space-y-2">
      <Field label="Entity" error={errors.entity} control="entity">
        <EntitySelect
          label="List entity"
          value={page.entity ?? ''}
          options={entities.map(e => e.name)}
          error={errors.entity}
          onChange={name => {
            // Columns, sort, view and filter stay when the new entity also has them; the rest is named.
            const { patch, dropped } = retargetEntityList(page, entities.find(e => e.name === name), projectOpts)
            lossy(`Listed ${name} on “${pageLabel(page)}”`, dropped)
            update(index, patch)
          }}
        />
      </Field>
      <PresetFilters
        filter={page.presetFilter}
        entity={entity}
        errors={errors}
        onChange={presetFilter => update(index, { presetFilter })}
      />
      {splittable.length > 0 && (
        <div className="flex flex-wrap items-end gap-2" data-control="split">
          <MiniField label="Split into tabs by" hint={splitReason ?? `A hidden list per ${splitField?.name} value, side by side under a new tabs page`}>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Split by field"
                value={splitField?.name ?? ''}
                onChange={e => setPickedSplit(e.target.value)}
                className={`${inputClass()} max-w-[12rem] py-1 text-xs`}
              >
                {splittable.map(f => <option key={f.name} value={f.name}>{f.label?.trim() || f.name}</option>)}
              </select>
              <button
                type="button"
                onClick={split}
                disabled={Boolean(splitReason)}
                className={SMALL_BUTTON}
                title={splitReason ?? 'One undoable step'}
                data-split-list
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>tab</span>
                Split into tabs
              </button>
            </div>
          </MiniField>
        </div>
      )}
      <div className="space-y-1" data-control="columns" role="group" aria-label="Columns">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          Columns <span className="font-normal normal-case tracking-normal">· in table order — click one to hide it, drag to reorder</span>
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {shown.map((key, i) => {
            const col = columns.find(c => c.key === key)
            const last = shown.length === 1
            return (
              <span
                key={key}
                {...dnd.rowProps(list, i)}
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] ${col ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'} ${
                  dnd.isDragging(list, i) ? 'opacity-40' : ''} ${dropIndicatorClass(dnd.indicatorFor(list, i))}`}
                data-list-column={key}
              >
                <DragGrip dnd={dnd} list={list} index={i} />
                {col?.kind === 'relation' && <span className="material-symbols-outlined" style={{ fontSize: '12px' }} aria-hidden="true">link</span>}
                <button
                  type="button"
                  aria-pressed="true"
                  aria-label={`Hide the ${labelOf(key)} column`}
                  title={last ? 'Keep at least one column' : col ? 'Shown — click to hide' : `${entity?.name ?? 'The entity'} no longer has this column`}
                  disabled={last}
                  onClick={() => toggle(key)}
                  className="inline-flex items-center gap-1 leading-none hover:text-error disabled:cursor-default disabled:hover:text-inherit"
                >
                  {labelOf(key)} <span aria-hidden="true">×</span>
                </button>
              </span>
            )
          })}
          {hidden.map(key => (
            <button
              key={key}
              type="button"
              aria-pressed="false"
              aria-label={`Show the ${labelOf(key)} column`}
              title="Hidden — click to show"
              onClick={() => toggle(key)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-outline-variant px-2 py-0.5 text-[11px] text-secondary hover:border-primary/50 hover:text-primary"
            >
              <span aria-hidden="true">+</span> {labelOf(key)}
            </button>
          ))}
        </div>
        {errors.columns && <p className="text-[11px] text-error">{errors.columns}</p>}
        {page.columns && (
          <button type="button" onClick={() => update(index, { columns: undefined })} className={SMALL_BUTTON}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">restart_alt</span>
            All columns (default)
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Field label="Sort rows by" error={errors.sort} control="sort" hint="How the table opens; the primary key when unset">
          <div className="flex items-center gap-1">
            <select
              aria-label="Sort rows by"
              aria-invalid={Boolean(errors.sort)}
              value={page.sort?.field ?? ''}
              onChange={e => setSort(e.target.value || undefined, page.sort?.dir)}
              className={`${inputClass(errors.sort)} min-w-0 flex-1 py-1 text-xs`}
            >
              <option value="">Default (primary key)</option>
              {sortable.map(k => <option key={k} value={k}>{labelOf(k)}</option>)}
              {page.sort?.field && !sortable.includes(page.sort.field) && <option value={page.sort.field}>{page.sort.field}</option>}
            </select>
            {page.sort?.field && (
              <span role="radiogroup" aria-label="Sort direction" className="inline-flex shrink-0 overflow-hidden rounded-lg border border-outline-variant">
                {(['asc', 'desc'] as const).map(dir => {
                  const on = (page.sort?.dir ?? 'asc') === dir
                  return (
                    <button
                      key={dir}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={dir === 'asc' ? 'Ascending' : 'Descending'}
                      title={dir === 'asc' ? 'Ascending' : 'Descending'}
                      onClick={() => setSort(page.sort?.field, dir)}
                      className={`px-1.5 py-1 ${on ? 'bg-primary/10 text-primary' : 'text-secondary hover:text-primary'}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                    </button>
                  )
                })}
              </span>
            )}
          </div>
        </Field>
        <Field
          label="Row detail opens in"
          error={errors.detail}
          control="detail"
          hint={hasRecord ? 'Default: the record page' : 'Default: the quick-look drawer — add a record page to open rows there'}
        >
          <span role="radiogroup" aria-label="Row detail opens in" className="inline-flex flex-wrap overflow-hidden rounded-lg border border-outline-variant">
            {([
              { value: 'drawer', label: 'Drawer', reason: undefined },
              { value: 'side', label: 'Side pane', reason: entity && !singlePkEntity(entity) ? 'A side pane needs a single-key entity' : undefined },
              { value: 'record', label: 'Record page', reason: hasRecord ? undefined : `Add a record page for ${entity?.name ?? 'the entity'} first` },
            ] as { value: FullstackListDetail; label: string; reason?: string }[]).map(d => {
              const on = (page.detail ?? (hasRecord ? 'record' : 'drawer')) === d.value
              return (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={d.label}
                  disabled={Boolean(d.reason)}
                  title={d.reason ?? d.label}
                  onClick={() => update(index, { detail: d.value === (hasRecord ? 'record' : 'drawer') ? undefined : d.value })}
                  className={`px-2 py-1 text-[11px] ${on ? 'bg-primary/10 font-semibold text-primary' : 'text-secondary hover:text-primary'} disabled:opacity-40 disabled:hover:text-secondary`}
                >
                  {d.label}
                </button>
              )
            })}
          </span>
        </Field>
        <Field
          label="Opens as"
          error={errors.view}
          control="view"
          hint={views.length > 1 ? 'The view it opens in; its toggle offers the others' : `${entity?.name ?? 'It'} offers the table only — tick more list views on the entity`}
        >
          <span role="radiogroup" aria-label="Opens as" className="inline-flex flex-wrap overflow-hidden rounded-lg border border-outline-variant">
            {LIST_VIEWS.map(v => {
              const enabled = views.includes(v.value)
              const on = (page.view ?? views[0]) === v.value
              const reason = enabled ? undefined : viewDisabledReason(entity, v.value)
              return (
                <button
                  key={v.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={v.label}
                  disabled={!enabled}
                  title={reason ?? (v.value === views[0] ? `${v.label} (default)` : v.label)}
                  onClick={() => update(index, { view: v.value === views[0] ? undefined : v.value })}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] ${on ? 'bg-primary/10 font-semibold text-primary' : 'text-secondary hover:text-primary'} disabled:opacity-40 disabled:hover:text-secondary`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">{v.icon}</span>
                  {v.label}
                </button>
              )
            })}
          </span>
        </Field>
        <Field label="Rows per page" error={errors.pageSize} control="pageSize">
          <select
            aria-label="Rows per page"
            aria-invalid={Boolean(errors.pageSize)}
            value={page.pageSize ?? ''}
            onChange={e => update(index, { pageSize: e.target.value ? Number(e.target.value) : undefined })}
            className={`${inputClass(errors.pageSize)} max-w-[10rem] py-1 text-xs`}
          >
            <option value="">Default ({DEFAULT_PAGE_SIZE})</option>
            {LIST_PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
            {page.pageSize != null && !LIST_PAGE_SIZES.includes(page.pageSize) && <option value={page.pageSize}>{page.pageSize}</option>}
          </select>
        </Field>
      </div>
    </div>
  )
}

/** Widgets a dashboard has before its cards start collapsed; a short list reads fine open. */
const COLLAPSE_WIDGETS_FROM = 4

function DashboardForm({ page, index, pages, projectOpts, entities, errors, update, dnd, lossy, removed, expandRequest }: FormProps & {
  pages: FullstackPageDef[]
  /** The project-wide scaffold opts — a list widget's audit columns exist only with `audit` on. */
  projectOpts: string[]
  dnd: ReturnType<typeof useDragReorder>
  /** A problem click about widget `widget` of this page: open that card (a new `n` per click). */
  expandRequest?: { widget: number; n: number } | null
}) {
  const widgets = page.widgets ?? []
  const list = `widgets:${index}`
  const keys = useStableKeys(widgets, w => `${w.kind}:${w.entity}:${w.groupBy ?? ''}:${w.title ?? ''}`)
  const atCap = widgets.length >= MAX_WIDGETS
  // "Add widget" opens a gallery: pick the entity, then a kind — each kind says why it would
  // not fit that entity, so the widget is valid on sight.
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryEntity, setGalleryEntity] = useState('')
  const galleryPick = entities.find(e => e.name === galleryEntity)
  function openGallery() {
    // Start from the last widget's entity — the likeliest next one — else the first entity.
    const last = [...widgets].reverse().find(w => w.entity && entities.some(e => e.name === w.entity))?.entity
    setGalleryEntity(last ?? entities[0]?.name ?? '')
    setGalleryOpen(o => !o)
  }
  function addWidget(kind: FullstackWidgetDef['kind']) {
    setGalleryOpen(false)
    update(index, { widgets: [...widgets, newWidget(kind, galleryEntity, pages.filter(p => p !== page))] })
  }
  // Cards start collapsed on a busy dashboard so the list scans as one line per widget; a new or
  // re-kinded widget opens, and so does the card a problem points at. Keyed by row key, so a
  // reorder keeps each card's state.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(widgets.length >= COLLAPSE_WIDGETS_FROM ? keys : []))
  const setOpen = (key: string | undefined, open: boolean) => {
    if (!key) return
    setCollapsed(prev => {
      const next = new Set(prev)
      if (open) next.delete(key)
      else next.add(key)
      return next
    })
  }
  useEffect(() => {
    if (expandRequest) setOpen(keys[expandRequest.widget], true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new click is a new `n`
  }, [expandRequest?.n])

  function setWidgets(next: FullstackWidgetDef[]) {
    update(index, { widgets: next })
  }
  function setWidget(wi: number, patch: Partial<FullstackWidgetDef>) {
    setWidgets(widgets.map((w, i) => (i === wi ? { ...w, ...patch } : w)))
  }
  /** A new kind or entity keeps what still fits; anything dropped is named, with an undo. */
  function retarget(wi: number, patch: { kind?: FullstackWidgetDef['kind']; entity?: string }) {
    const before = widgets[wi]
    if ((patch.kind ?? before.kind) === before.kind && (patch.entity ?? before.entity) === before.entity) return
    const { widget, dropped } = retargetWidget(before, patch, entities.find(e => e.name === (patch.entity ?? before.entity)))
    lossy(`Changed widget ${wi + 1} of “${pageLabel(page)}”`, dropped)
    setWidgets(widgets.map((w, i) => (i === wi ? widget : w)))
    // A card whose kind just changed shows different controls — open it.
    if (patch.kind) setOpen(keys[wi], true)
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
          onChange={e => {
            if (e.target.value) {
              update(index, { dateRange: e.target.value as FullstackDateRange })
              return
            }
            // A widget's date field and comparison only mean something under a picker.
            const { patch, dropped } = stripDateRange(page)
            lossy(`Switched the period picker off on “${pageLabel(page)}”`, dropped)
            update(index, patch)
          }}
          className={`${inputClass(errors.dateRange)} max-w-[14rem]`}
        >
          <option value="">Off</option>
          {DATE_RANGES.map(r => <option key={r.value} value={r.value}>Opens on: {r.label}</option>)}
        </select>
      </Field>
      <Field
        label="Auto-refresh"
        error={errors.refreshSeconds}
        control="refreshSeconds"
        hint={(page.widgets ?? []).some(reloads)
          ? page.refreshSeconds ? 'The widgets reload on this timer while the page is open; Refresh reloads them any time' : 'Off — the generated Refresh button reloads the widgets'
          : 'Add a widget that shows data first'}
      >
        <select
          aria-label="Auto-refresh"
          aria-invalid={Boolean(errors.refreshSeconds)}
          value={page.refreshSeconds ?? ''}
          disabled={!(page.widgets ?? []).some(reloads) && page.refreshSeconds == null}
          onChange={e => update(index, { refreshSeconds: e.target.value ? Number(e.target.value) : undefined })}
          className={`${inputClass(errors.refreshSeconds)} max-w-[14rem]`}
        >
          <option value="">Off</option>
          {REFRESH_CHOICES.map(r => <option key={r.value} value={r.value}>Reload {r.label}</option>)}
        </select>
      </Field>
      <div className="space-y-2" data-control="widgets">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
            Widgets <span className="font-normal normal-case tracking-normal">· laid out left to right on a four-column grid</span>
          </p>
          {widgets.length > 1 && (
            <span className="inline-flex items-center gap-2 text-[11px]">
              <button type="button" onClick={() => setCollapsed(new Set())} className="font-semibold text-primary hover:underline" disabled={collapsed.size === 0}>
                Expand all
              </button>
              <button type="button" onClick={() => setCollapsed(new Set(keys))} className="font-semibold text-primary hover:underline" disabled={collapsed.size === widgets.length}>
                Collapse all
              </button>
            </span>
          )}
        </div>
        {errors.widgets && <p className="text-[11px] text-error">{errors.widgets}</p>}
        {widgets.map((widget, wi) => (
          <WidgetCard
            key={keys[wi]}
            widget={widget}
            wi={wi}
            count={widgets.length}
            pages={pages.filter(p => p !== page)}
            projectOpts={projectOpts}
            entities={entities}
            dateRange={page.dateRange}
            errors={errors}
            atCap={atCap}
            dnd={dnd}
            list={list}
            expanded={!collapsed.has(keys[wi])}
            onToggle={() => setOpen(keys[wi], collapsed.has(keys[wi]))}
            onChange={patch => setWidget(wi, patch)}
            onRetarget={patch => retarget(wi, patch)}
            onMove={delta => setWidgets(moveItem(widgets, wi, wi + delta))}
            onDuplicate={() => {
              const next = [...widgets]
              next.splice(wi + 1, 0, { ...widget })
              setWidgets(next)
            }}
            onRemove={() => {
              removed?.(`Removed widget ${wi + 1} (${WIDGET_KINDS.find(k => k.kind === widget.kind)?.label ?? widget.kind}) from “${pageLabel(page)}”`)
              setWidgets(widgets.filter((_, i) => i !== wi))
            }}
          />
        ))}
        <button
          type="button"
          onClick={openGallery}
          aria-expanded={galleryOpen}
          disabled={atCap}
          className={SMALL_BUTTON}
          title={atCap ? `A dashboard can have at most ${MAX_WIDGETS} widgets` : 'Pick a kind of widget and the entity it reads'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          Add widget
        </button>
        {galleryOpen && !atCap && (
          <div className="space-y-2 rounded-lg border border-outline-variant p-2" data-widget-gallery>
            <MiniField label="Entity the widget reads">
              <EntitySelect
                label="New widget entity"
                value={galleryEntity}
                options={entities.map(e => e.name)}
                className="max-w-[12rem]"
                onChange={setGalleryEntity}
              />
            </MiniField>
            <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
              {WIDGET_KINDS.map(k => {
                const reason = widgetKindDisabledReason(k.kind, galleryPick)
                return (
                  <li key={k.kind}>
                    <button
                      type="button"
                      onClick={() => addWidget(k.kind)}
                      disabled={Boolean(reason)}
                      aria-label={`Add ${k.label.toLowerCase()}`}
                      title={reason ?? k.hint}
                      className="h-full w-full rounded-lg border border-outline-variant px-2.5 py-2 text-start transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-outline-variant disabled:hover:bg-transparent"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }} aria-hidden="true">{k.icon}</span>
                        {k.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-secondary">{reason ?? k.hint}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/** One line for a collapsed widget card: its kind, what it reads and how wide it is. */
function widgetSummary(w: FullstackWidgetDef, span: number): string {
  const kind = WIDGET_KINDS.find(k => k.kind === w.kind)?.short ?? w.kind
  if (w.kind === 'links') {
    const n = w.pages?.length ?? 0
    return `${kind} · ${w.title ? `“${w.title}” · ` : ''}${n} page${n === 1 ? '' : 's'} · width ${span}`
  }
  if (w.kind === 'list') {
    const parts = [kind, w.entity || '(no entity)']
    if (w.columns?.length) parts.push(`${w.columns.length} column${w.columns.length === 1 ? '' : 's'}`)
    if (w.sort?.field) parts.push(`by ${w.sort.field} ${w.sort.dir === 'desc' ? '↓' : '↑'}`)
    if (w.title) parts.push(`“${w.title}”`)
    parts.push(`width ${span}`)
    return parts.join(' · ')
  }
  if (w.kind === 'text') {
    const text = (w.text ?? '').split('\n').find(line => line.trim()) ?? ''
    return `${kind} · ${w.title || text.slice(0, 60) || 'empty'} · width ${span}`
  }
  const parts = [kind, `${w.entity || '(no entity)'}${w.groupBy ? ` by ${w.groupBy}` : ''}`]
  if (w.agg && w.agg !== 'count') parts.push(`${w.agg} of ${w.field ?? '?'}`)
  if (w.title) parts.push(`“${w.title}”`)
  parts.push(`width ${span}`)
  return parts.join(' · ')
}

/**
 * One dashboard widget as a card: a header (reorder, kind, duplicate, remove), then labelled
 * "Data" (what it measures) and "Display" (how it is shown) columns, then the rows it is limited to.
 */
function WidgetCard({ widget, wi, count, pages, projectOpts, entities, dateRange, errors, atCap, dnd, list, expanded, onToggle, onChange, onRetarget, onMove, onDuplicate, onRemove }: {
  widget: FullstackWidgetDef
  wi: number
  count: number
  /** The layout — a links widget picks the pages it opens from it. */
  pages: FullstackPageDef[]
  projectOpts: string[]
  entities: FullstackEntityDef[]
  dateRange: FullstackDateRange | undefined
  errors: Record<string, string>
  atCap: boolean
  dnd: ReturnType<typeof useDragReorder>
  list: string
  /** Collapsed, the card is its header and a one-line summary. */
  expanded: boolean
  onToggle: () => void
  onChange: (patch: Partial<FullstackWidgetDef>) => void
  onRetarget: (patch: { kind?: FullstackWidgetDef['kind']; entity?: string }) => void
  onMove: (delta: number) => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const entity = entities.find(e => e.name === widget.entity)
  const error = errors[`widget.${wi}`]
  const filterPrefix = `widget.${wi}.presetFilter.`
  const filterErrors = Object.fromEntries(
    Object.entries(errors).filter(([k]) => k.startsWith(filterPrefix)).map(([k, v]) => [`presetFilter.${k.slice(filterPrefix.length)}`, v]),
  )
  const invalid = Boolean(error) || Object.keys(filterErrors).length > 0
  const indicator = dnd.indicatorFor(list, wi)
  const fallbackSpan = defaultSpan(widget.kind)
  const span = widget.span ?? fallbackSpan
  const dates = filterableDateFields(entity)
  const pk = entity?.fields.find(f => f.primaryKey)?.name
  const kindMeta = WIDGET_KINDS.find(k => k.kind === widget.kind) ?? { icon: 'widgets', label: widget.kind, short: widget.kind, hint: '' }
  const labelOf = (key: string) => keyOption(entity, key)

  return (
    <div
      {...dnd.rowProps(list, wi)}
      data-widget={wi}
      data-control={`widget.${wi}`}
      className={`space-y-2 rounded-lg border px-2.5 py-2 ${invalid ? 'border-error/50' : 'border-outline-variant'} ${
        dnd.isDragging(list, wi) ? 'opacity-40' : ''} ${dropIndicatorClass(indicator)}`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span {...dnd.handleProps(list, wi)} className="cursor-grab text-secondary/70" aria-hidden="true" title="Drag to reorder">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>drag_indicator</span>
        </span>
        <MoveButtons label={`widget ${wi + 1}`} canUp={wi > 0} canDown={wi < count - 1} onMove={onMove} />
        <button
          type="button"
          onClick={onToggle}
          className={ICON_BUTTON}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} widget ${wi + 1}`}
          title={expanded ? 'Collapse to one line' : 'Expand the settings'}
          data-widget-toggle
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{expanded ? 'expand_less' : 'expand_more'}</span>
        </button>
        <span className="material-symbols-outlined text-secondary" style={{ fontSize: '14px' }} aria-hidden="true">{kindMeta.icon}</span>
        {expanded ? (
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-on-surface">{kindMeta.label}</span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[11px] text-secondary" data-widget-summary>{widgetSummary(widget, span)}</span>
        )}
        <button
          type="button"
          onClick={onDuplicate}
          disabled={atCap}
          className={ICON_BUTTON}
          aria-label={`Duplicate widget ${wi + 1}`}
          title={atCap ? `A dashboard can have at most ${MAX_WIDGETS} widgets` : 'Duplicate this widget'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
        </button>
        <button type="button" onClick={onRemove} className={ICON_BUTTON} aria-label={`Remove widget ${wi + 1}`} title="Remove this widget">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
        </button>
      </div>

      {expanded && (
        <div role="radiogroup" aria-label="Widget kind" className="inline-flex flex-wrap overflow-hidden rounded border border-outline-variant" data-widget-kind>
          {WIDGET_KINDS.map(k => {
            const on = widget.kind === k.kind
            // A kind that cannot read this widget's entity (or, for a text widget, the first
            // entity it would fall back to) says why instead of producing a problem.
            const reason = on ? undefined : widgetKindDisabledReason(k.kind, entity ?? (widget.entity ? undefined : entities[0]))
            return (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={k.label}
                aria-disabled={Boolean(reason)}
                disabled={Boolean(reason)}
                title={reason ?? k.hint}
                onClick={() => onRetarget(k.kind !== 'text' && !widget.entity ? { kind: k.kind, entity: entities[0]?.name ?? '' } : { kind: k.kind })}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] disabled:opacity-40 ${on ? 'bg-primary/15 font-semibold text-primary' : 'text-secondary hover:bg-primary/5 hover:text-primary'}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">{k.icon}</span>
                {k.short}
              </button>
            )
          })}
        </div>
      )}
      {!expanded ? null : widget.kind === 'list' ? (
        <div className="space-y-2" data-widget-options>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
            <MiniField label="Entity">
              <EntitySelect label="Widget entity" value={widget.entity} options={entities.map(e => e.name)} error={error} onChange={name => onRetarget({ entity: name })} />
            </MiniField>
            <MiniField label="Title" grow>
              <input
                type="text"
                aria-label="Widget title"
                value={widget.title ?? ''}
                maxLength={MAX_TITLE}
                placeholder={entity ? pluralize(entity.name) : 'Optional heading'}
                onChange={e => onChange({ title: e.target.value || undefined })}
                className={`${inputClass()} w-full py-1 text-xs`}
              />
            </MiniField>
            <MiniField label="Rows" hint="A page of the list">
              <div role="radiogroup" aria-label="Rows per page" className="inline-flex overflow-hidden rounded border border-outline-variant">
                {LIST_WIDGET_LIMITS.map(n => {
                  const on = (widget.limit ?? LIST_WIDGET_LIMITS[0]) === n
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => onChange({ limit: n === LIST_WIDGET_LIMITS[0] ? undefined : n })}
                      className={`px-2 py-0.5 text-[11px] ${on ? 'bg-primary/15 font-semibold text-primary' : 'text-secondary hover:bg-primary/5'}`}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            </MiniField>
            <MiniField label="Width" hint={`Columns of 4 · default ${fallbackSpan}`}>
              <SpanPicker span={span} fallback={fallbackSpan} onChange={s => onChange({ span: s })} />
            </MiniField>
          </div>
          <MiniField label="Columns" hint="Click to hide or show, drag to reorder · default: every column">
            <div className="flex flex-wrap items-center gap-1" data-widget-columns>
              {(() => {
                const cols = listColumns(entity, projectOpts)
                const all = cols.map(c => c.key)
                const shown = (widget.columns ?? all).filter(k => all.includes(k))
                const hiddenKeys = all.filter(k => !shown.includes(k))
                const colList = `wcolumns:${list.split(':')[1]}:${wi}`
                const labelOf = (key: string) => cols.find(c => c.key === key)?.label ?? key
                const set = (next: string[]) => {
                  const isDefault = next.length === all.length && next.every((k, i) => k === all[i])
                  onChange({ columns: isDefault || next.length === 0 ? undefined : next })
                }
                return (
                  <>
                    {shown.map((key, i) => (
                      <span
                        key={key}
                        {...dnd.rowProps(colList, i)}
                        className={`inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary ${
                          dnd.isDragging(colList, i) ? 'opacity-40' : ''} ${dropIndicatorClass(dnd.indicatorFor(colList, i))}`}
                        data-widget-column={key}
                      >
                        <DragGrip dnd={dnd} list={colList} index={i} />
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked="true"
                          aria-label={`Hide the ${labelOf(key)} column`}
                          disabled={shown.length === 1}
                          title={shown.length === 1 ? 'Keep at least one column' : 'Shown — click to hide'}
                          onClick={() => set(shown.filter(k => k !== key))}
                          className="inline-flex items-center gap-1 leading-none hover:text-error disabled:cursor-default disabled:hover:text-inherit"
                        >
                          {labelOf(key)} <span aria-hidden="true">×</span>
                        </button>
                      </span>
                    ))}
                    {hiddenKeys.map(key => (
                      <button
                        key={key}
                        type="button"
                        role="checkbox"
                        aria-checked="false"
                        aria-label={`Show the ${labelOf(key)} column`}
                        title="Hidden — click to show"
                        onClick={() => set([...shown, key])}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-outline-variant px-2 py-0.5 text-[11px] text-secondary hover:border-primary/50 hover:text-primary"
                      >
                        <span aria-hidden="true">+</span> {labelOf(key)}
                      </button>
                    ))}
                  </>
                )
              })()}
            </div>
          </MiniField>
          <MiniField label="Sort rows by">
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Widget sort"
                value={widget.sort?.field ?? ''}
                onChange={e => onChange({ sort: e.target.value ? { field: e.target.value, dir: widget.sort?.dir } : undefined })}
                className={`${inputClass()} max-w-[12rem] py-1 text-xs`}
              >
                <option value="">Default (the key)</option>
                {sortableKeys(entity, projectOpts).map(k => <option key={k} value={k}>{labelOf(k)}</option>)}
              </select>
              {widget.sort && (
                <button
                  type="button"
                  onClick={() => onChange({ sort: { ...widget.sort!, dir: widget.sort!.dir === 'desc' ? undefined : 'desc' } })}
                  className={SMALL_BUTTON}
                  aria-label={widget.sort.dir === 'desc' ? 'Sort ascending' : 'Sort descending'}
                >
                  {widget.sort.dir === 'desc' ? '↓ desc' : '↑ asc'}
                </button>
              )}
            </div>
          </MiniField>
          <PresetFilters
            filter={widget.presetFilter}
            entity={entity}
            errors={filterErrors}
            controlPrefix={filterPrefix}
            onChange={presetFilter => onChange({ presetFilter })}
            heading="Only rows where"
          />
        </div>
      ) : widget.kind === 'links' ? (
        <div className="space-y-2" data-widget-options>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <MiniField label="Title" grow>
              <input
                type="text"
                aria-label="Widget title"
                value={widget.title ?? ''}
                maxLength={MAX_TITLE}
                placeholder="Optional heading"
                onChange={e => onChange({ title: e.target.value || undefined })}
                className={`${inputClass()} w-full py-1 text-xs`}
              />
            </MiniField>
            <MiniField label="Width" hint={`Columns of 4 · default ${fallbackSpan}`}>
              <SpanPicker span={span} fallback={fallbackSpan} onChange={s => onChange({ span: s })} />
            </MiniField>
          </div>
          <MiniField label="Pages it opens" hint={`One tile per page, in this order · up to ${MAX_LINKS}`}>
            <ul className="flex flex-wrap gap-1.5" data-widget-links>
              {linkablePages(pages).map(p => {
                const ids = widget.pages ?? []
                const on = ids.includes(p.id)
                return (
                  <li key={p.id}>
                    <label className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${on ? 'border-primary/50 bg-primary/10 text-primary' : 'border-outline-variant text-on-surface'}`}>
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={on}
                        aria-label={`Link to ${pageLabel(p)}`}
                        onChange={() => onChange({ pages: on ? ids.filter(id => id !== p.id) : [...ids, p.id] })}
                      />
                      {pageLabel(p)}
                    </label>
                  </li>
                )
              })}
              {linkablePages(pages).length === 0 && <li className="text-[11px] text-secondary">Add another page first — a links widget opens other pages.</li>}
            </ul>
          </MiniField>
        </div>
      ) : widget.kind === 'text' ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]" data-widget-options>
          <MiniField label="Title" grow>
            <input
              type="text"
              aria-label="Widget title"
              value={widget.title ?? ''}
              maxLength={MAX_TITLE}
              placeholder="Optional heading"
              onChange={e => onChange({ title: e.target.value || undefined })}
              className={`${inputClass()} w-full py-1 text-xs`}
            />
          </MiniField>
          <MiniField label="Width" hint={`Columns of 4 · default ${fallbackSpan}`}>
            <SpanPicker span={span} fallback={fallbackSpan} onChange={s => onChange({ span: s })} />
          </MiniField>
          <div className="md:col-span-2">
            <MiniField label="Text" hint={`Plain text; a blank line starts a new paragraph · ${(widget.text ?? '').length}/${MAX_TEXT}`}>
              <textarea
                aria-label="Widget text"
                aria-invalid={Boolean(error)}
                value={widget.text ?? ''}
                rows={4}
                maxLength={MAX_TEXT}
                placeholder="e.g. How the team triages new tickets, who to call, links to the runbook…"
                onChange={e => onChange({ text: e.target.value || undefined })}
                className={`${inputClass(error)} w-full py-1 text-xs`}
              />
            </MiniField>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2" data-widget-options>
        <fieldset className="min-w-0 space-y-1.5">
          <legend className="text-[10px] font-semibold uppercase tracking-wider text-secondary/80">Data</legend>
          <div className="flex flex-wrap items-end gap-2">
            <MiniField label="Entity">
              <EntitySelect
                label="Widget entity"
                value={widget.entity}
                options={entities.map(e => e.name)}
                error={error}
                className="max-w-[10rem]"
                onChange={name => onRetarget({ entity: name })}
              />
            </MiniField>
            {(widget.kind === 'bar' || widget.kind === 'donut') && (
              <MiniField label="Group by" hint={widget.kind === 'donut' ? 'One slice per value (or related record)' : 'One bar per value (or related record)'}>
                <select
                  aria-label="Group by"
                  value={widget.groupBy ?? ''}
                  onChange={e => onChange({ groupBy: e.target.value || undefined })}
                  className={`${inputClass(error)} max-w-[11rem] py-1 text-xs`}
                >
                  <option value="">{defaultOptionLabel(defaultTopGroupBy(entity), 'enum, boolean or relation', labelOf)}</option>
                  {rankableKeys(entity).map(k => <option key={k} value={k}>{labelOf(k)}</option>)}
                  {widget.groupBy && !rankableKeys(entity).includes(widget.groupBy) && (
                    <option value={widget.groupBy}>{widget.groupBy}</option>
                  )}
                </select>
              </MiniField>
            )}
            {widget.kind === 'stacked' && (
              <MiniField label="Group by" hint="One bar per value">
                <select
                  aria-label="Group by"
                  value={widget.groupBy ?? ''}
                  onChange={e => onChange({ groupBy: e.target.value || undefined })}
                  className={`${inputClass(error)} max-w-[11rem] py-1 text-xs`}
                >
                  <option value="">{defaultOptionLabel(defaultBarGroupBy(entity), 'enum or boolean', labelOf)}</option>
                  {groupableFields(entity).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
                  {widget.groupBy && !groupableFields(entity).some(f => f.name === widget.groupBy) && (
                    <option value={widget.groupBy}>{widget.groupBy}</option>
                  )}
                </select>
              </MiniField>
            )}
            {widget.kind === 'stacked' && (
              <MiniField label="Split by" hint="Each bar's segments">
                <select
                  aria-label="Split by"
                  value={widget.series ?? ''}
                  onChange={e => onChange({ series: e.target.value || undefined })}
                  className={`${inputClass(error)} max-w-[11rem] py-1 text-xs`}
                >
                  <option value="">{defaultOptionLabel(defaultSeries(entity, widget.groupBy ?? defaultBarGroupBy(entity)), 'second enum or boolean', labelOf)}</option>
                  {groupableFields(entity).filter(f => f.name !== (widget.groupBy ?? defaultBarGroupBy(entity))).map(f => (
                    <option key={f.name} value={f.name}>{fieldOption(f)}</option>
                  ))}
                  {widget.series && !groupableFields(entity).some(f => f.name === widget.series) && (
                    <option value={widget.series}>{widget.series}</option>
                  )}
                </select>
              </MiniField>
            )}
            {widget.kind === 'line' && (
              <>
                <MiniField label="Over" hint="One point per bucket of this date">
                  <select
                    aria-label="Date field"
                    value={widget.groupBy ?? ''}
                    onChange={e => onChange({ groupBy: e.target.value || undefined })}
                    className={`${inputClass(error)} max-w-[11rem] py-1 text-xs`}
                  >
                    <option value="">{defaultOptionLabel(defaultLineGroupBy(entity), 'date field', labelOf)}</option>
                    {dateFields(entity).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
                    {widget.groupBy && !dateFields(entity).some(f => f.name === widget.groupBy) && (
                      <option value={widget.groupBy}>{widget.groupBy}</option>
                    )}
                  </select>
                </MiniField>
                <MiniField label="Bucket">
                  <BucketSelect value={widget.bucket} onChange={bucket => onChange({ bucket })} />
                </MiniField>
              </>
            )}
            {widget.kind === 'top' && (
              <MiniField label="Rank by" hint="The largest groups, biggest first">
                <select
                  aria-label="Rank by"
                  value={widget.groupBy ?? ''}
                  onChange={e => onChange({ groupBy: e.target.value || undefined })}
                  className={`${inputClass(error)} max-w-[11rem] py-1 text-xs`}
                >
                  <option value="">{defaultOptionLabel(defaultTopGroupBy(entity), 'enum, boolean or relation', labelOf)}</option>
                  {rankableKeys(entity).map(k => <option key={k} value={k}>{labelOf(k)}</option>)}
                  {widget.groupBy && !rankableKeys(entity).includes(widget.groupBy) && (
                    <option value={widget.groupBy}>{widget.groupBy}</option>
                  )}
                </select>
              </MiniField>
            )}
            {widget.kind !== 'recent' && (
              <MiniField label="Measure" hint={AGG_HINT}>
                <span className="inline-flex flex-wrap gap-2">
                  <AggFields agg={widget.agg} field={widget.field} entity={entity} error={error} onChange={onChange} />
                </span>
              </MiniField>
            )}
            {widget.kind === 'progress' && (
              <MiniField label="Target" hint="The value the bar fills up to">
                <input
                  type="number"
                  min={0}
                  step="any"
                  aria-label="Target"
                  aria-invalid={Boolean(error) && !widget.target}
                  value={widget.target ?? ''}
                  placeholder="e.g. 1000"
                  onChange={e => onChange({ target: e.target.value || undefined })}
                  className={`${inputClass(error)} max-w-[7rem] py-1 text-xs`}
                />
              </MiniField>
            )}
            {widget.kind === 'kpi' && (
              <label
                className={`inline-flex items-center gap-1 pb-1 text-xs ${dateRange ? 'text-on-surface' : 'text-secondary/60'}`}
                title={dateRange ? 'Show the change against the previous period' : 'Turn on the period picker to compare periods'}
              >
                <input
                  type="checkbox"
                  checked={Boolean(widget.compare)}
                  disabled={!dateRange && !widget.compare}
                  onChange={e => onChange({ compare: e.target.checked || undefined })}
                />
                vs previous period
              </label>
            )}
          </div>
        </fieldset>

        <fieldset className="min-w-0 space-y-1.5">
          <legend className="text-[10px] font-semibold uppercase tracking-wider text-secondary/80">Display</legend>
          <div className="flex flex-wrap items-end gap-2">
            <MiniField label="Title" grow>
              <input
                type="text"
                aria-label="Widget title"
                value={widget.title ?? ''}
                maxLength={MAX_TITLE}
                placeholder="Optional — named after the data"
                onChange={e => onChange({ title: e.target.value || undefined })}
                className={`${inputClass()} min-w-[8rem] w-full py-1 text-xs`}
              />
            </MiniField>
            <MiniField label="Width" hint={`Columns of 4 · default ${fallbackSpan}`}>
              <SpanPicker span={span} fallback={fallbackSpan} onChange={s => onChange({ span: s })} />
            </MiniField>
            {(widget.kind === 'recent' || widget.kind === 'top') && (
              <MiniField label="Rows" hint={`1–${MAX_RECENT_LIMIT}`}>
                <input
                  type="number"
                  min={1}
                  max={MAX_RECENT_LIMIT}
                  aria-label="How many rows"
                  value={widget.limit ?? ''}
                  placeholder="5"
                  onChange={e => onChange({ limit: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className={`${inputClass(error)} w-[4.5rem] py-1 text-xs`}
                />
              </MiniField>
            )}
            {widget.kind === 'recent' && (
              <MiniField label="Newest by" hint="Ordered by this, newest first">
                <select
                  aria-label="Sort by"
                  value={widget.sortBy ?? ''}
                  onChange={e => onChange({ sortBy: e.target.value || undefined })}
                  className={`${inputClass()} max-w-[11rem] py-1 text-xs`}
                >
                  <option value="">{defaultOptionLabel(pk, 'key', labelOf)}</option>
                  {(entity?.fields ?? []).filter(f => !f.primaryKey).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
                </select>
              </MiniField>
            )}
            {dateRange && (
              <MiniField label="Period applies to" hint="The date the picker limits">
                {dates.length === 0 ? (
                  <p className="py-1 text-[11px] text-secondary">No filterable date — all rows</p>
                ) : (
                  <select
                    aria-label="Period date field"
                    value={widget.dateField ?? ''}
                    onChange={e => onChange({ dateField: e.target.value || undefined })}
                    className={`${inputClass()} max-w-[11rem] py-1 text-xs`}
                  >
                    <option value="">{defaultOptionLabel(dates[0]?.name, 'date field', labelOf)}</option>
                    {dates.map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
                  </select>
                )}
              </MiniField>
            )}
          </div>
        </fieldset>

        <div className="min-w-0 md:col-span-2">
          <PresetFilters
            filter={widget.presetFilter}
            entity={entity}
            errors={filterErrors}
            controlPrefix={filterPrefix}
            onChange={presetFilter => onChange({ presetFilter })}
            heading="Only rows where"
          />
        </div>
      </div>
      )}
      {error && <p className="text-[11px] text-error">{error}</p>}
    </div>
  )
}

const AGG_HINT = 'Count the rows, or sum / average / min / max a number column'

/** A widget's width on the four-column grid; its kind's default is stored as nothing. */
function SpanPicker({ span, fallback, onChange }: { span: number; fallback: number; onChange: (span: number | undefined) => void }) {
  return (
    <div role="radiogroup" aria-label="Widget width" className="inline-flex overflow-hidden rounded border border-outline-variant">
      {Array.from({ length: MAX_SPAN }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={span === n}
          aria-label={`${n} column${n === 1 ? '' : 's'}${n === fallback ? ' (default)' : ''}`}
          onClick={() => onChange(n === fallback ? undefined : n)}
          className={`px-2 py-0.5 text-xs ${span === n ? 'bg-primary/15 font-semibold text-primary' : 'text-secondary hover:bg-primary/5'}`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

/** A small labelled control inside a widget card. */
function MiniField({ label, hint, grow, children }: { label: string; hint?: string; grow?: boolean; children: ReactNode }) {
  return (
    <div className={`space-y-0.5 ${grow ? 'min-w-[8rem] flex-1' : ''}`}>
      <span className="block text-[10px] font-semibold text-secondary">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-secondary/70">{hint}</span>}
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
          {numeric.map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
          {field && !numeric.some(f => f.name === field) && <option value={field}>{field}</option>}
        </select>
      )}
    </>
  )
}

function ReportForm({ page, index, entities, errors, update, lossy, removed, dnd }: FormProps & { dnd: ReturnType<typeof useDragReorder> }) {
  const entity = entities.find(e => e.name === page.entity)
  const charts = reportCharts(page)
  // One chart is sent as `chart`, several as `charts` — the backend takes either spelling.
  const setCharts = (next: FullstackChartDef[]) =>
    update(index, next.length <= 1 ? { chart: next[0] ?? {}, charts: undefined } : { charts: next, chart: undefined })

  return (
    <div className="space-y-2">
      <Field label="Entity" error={errors.entity} control="entity" hint="The report charts and filters this entity's rows">
        <EntitySelect
          label="Report entity"
          value={page.entity ?? ''}
          options={entities.map(e => e.name)}
          error={errors.entity}
          className="max-w-[12rem]"
          // The charts and filter keep whatever the new entity also has.
          onChange={name => {
            const { patch, dropped } = retargetReport(page, entities.find(e => e.name === name))
            lossy(`Reported on ${name} in “${pageLabel(page)}”`, dropped)
            update(index, patch)
          }}
        />
      </Field>
      {charts.map((chart, ci) => (
        <div
          key={ci}
          {...(charts.length > 1 ? dnd.rowProps(`charts:${index}`, ci) : {})}
          className={`space-y-1 rounded border border-outline-variant px-2 py-1.5 ${dnd.isDragging(`charts:${index}`, ci) ? 'opacity-40' : ''} ${dropIndicatorClass(dnd.indicatorFor(`charts:${index}`, ci))}`}
          data-report-chart={ci}
          data-control={ci === 0 ? 'chart' : `chart${ci + 1}`}
        >
          <div className="flex items-center gap-1.5">
            {charts.length > 1 && <DragGrip dnd={dnd} list={`charts:${index}`} index={ci} />}
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
                onClick={() => {
                  removed?.(`Removed chart ${ci + 1} from “${pageLabel(page)}”`)
                  setCharts(charts.filter((_, i) => i !== ci))
                }}
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
            <option value="">{defaultOptionLabel(defaultReportGroupBy(entity), 'enum, boolean or date', k => keyOption(entity, k))}</option>
            {groupableFields(entity).length > 0 && (
              <optgroup label="Breakdown">
                {groupableFields(entity).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
              </optgroup>
            )}
            {dateFields(entity).length > 0 && (
              <optgroup label="Over time">
                {dateFields(entity).map(f => <option key={f.name} value={f.name}>{fieldOption(f)}</option>)}
              </optgroup>
            )}
            {relationKeys(entity).length > 0 && (
              <optgroup label="By related record">
                {relationKeys(entity).map(k => <option key={k} value={k}>{relationOption(k)}</option>)}
              </optgroup>
            )}
            {chart.groupBy && !reportGroupKeys(entity).includes(chart.groupBy) && (
              <option value={chart.groupBy}>{chart.groupBy}</option>
            )}
          </select>
        </label>
        {overTime && (
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
        <label className="inline-flex items-center gap-1.5 pb-1 text-xs text-on-surface" title="The grouped totals under the chart (by default only under the first chart)">
          <input
            type="checkbox"
            className="accent-primary"
            aria-label={`Totals table under chart ${chartIndex + 1}`}
            checked={chart.table ?? chartIndex === 0}
            onChange={e => setChart({ table: e.target.checked === (chartIndex === 0) ? undefined : e.target.checked })}
          />
          Totals table
        </label>
      </div>
      {errors[groupKey] && <p className="text-[11px] text-error">{errors[groupKey]}</p>}
      {errors[fieldKey] && <p className="text-[11px] text-error">{errors[fieldKey]}</p>}
      {errors[bucketKey] && <p className="text-[11px] text-error">{errors[bucketKey]}</p>}
    </div>
  )
}

function TabsForm({ page, index, pages, errors, update, dnd, removed }: Omit<FormProps, 'entities' | 'lossy'> & { pages: FullstackPageDef[]; dnd: ReturnType<typeof useDragReorder> }) {
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
          <div
            key={`${ti}:${tab.page}`}
            {...dnd.rowProps(`tabs:${index}`, ti)}
            className={`flex items-center gap-2 rounded ${dnd.isDragging(`tabs:${index}`, ti) ? 'opacity-40' : ''} ${dropIndicatorClass(dnd.indicatorFor(`tabs:${index}`, ti))}`}
            data-tab={ti}
            data-control={`tab.${ti}`}
          >
            <DragGrip dnd={dnd} list={`tabs:${index}`} index={ti} />
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
              maxLength={MAX_TITLE}
              placeholder="Tab label (optional)"
              onChange={e => setTabs(tabs.map((t, i) => (i === ti ? { ...t, title: e.target.value || undefined } : t)))}
              className={`${inputClass()} max-w-[12rem] py-1 text-xs`}
            />
            <button
              type="button"
              onClick={() => {
                const target = pages.find(p => p.id === tab.page)
                removed?.(`Removed the “${tab.title || (target ? pageLabel(target) : tab.page)}” tab from “${pageLabel(page)}”`,
                  target?.hidden ? 'its page stays in the layout, hidden' : undefined)
                setTabs(tabs.filter((_, i) => i !== ti))
              }}
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

function MasterDetailForm({ page, index, entities, errors, update, lossy, projectOpts }: FormProps & { projectOpts: string[] }) {
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
            // The child and its link stay when they still fit the new parent (a lone candidate
            // child is picked, so the page is complete in one step); anything dropped is named.
            const { patch, dropped } = retargetMasterDetail(page, name, entities)
            lossy(`Listed ${name} on the left of “${pageLabel(page)}”`, dropped)
            update(index, patch)
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
          onChange={name => {
            const { patch, dropped } = retargetMasterDetailChild(page, name, entities)
            lossy(`Showed ${name} on the right of “${pageLabel(page)}”`, dropped)
            update(index, patch)
          }}
        />
        {parent && children.length === 0 && (
          <p className="text-[10px] text-secondary" data-md-no-child>
            Add a many-to-one relation to {parent.name} on another entity (its Relations table), then pick it here.
          </p>
        )}
      </Field>
      <Field label="Parent card" control="showParent" hint={page.showParent ? `${parent?.name ?? 'The parent'}’s details above its rows, with Edit when it is writable` : 'The right side shows the child rows only'}>
        <label className="inline-flex items-center gap-1.5 text-xs text-on-surface">
          <input
            type="checkbox"
            className="accent-primary"
            checked={Boolean(page.showParent)}
            aria-label="Show the selected parent's details"
            onChange={e => update(index, { showParent: e.target.checked ? true : undefined })}
          />
          Show the selected {parent?.name ?? 'parent'}
        </label>
      </Field>
      <Field label="Child list opens with" error={errors.columns ?? errors.sort} control="columns" hint="Its columns and sort — each absent: the list's own default">
        <ListOptions
          label={`${child?.name ?? 'child'} list`}
          entity={child}
          projectOpts={projectOpts}
          columns={page.columns}
          sort={page.sort}
          onChange={patch => update(index, patch)}
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
            {vias.map(v => <option key={v} value={v}>{relationOption(v)}</option>)}
          </select>
        </Field>
      )}
    </div>
  )
}

function RecordForm({ page, index, entities, errors, update, lossy, removed, dnd, projectOpts }: FormProps & { dnd: ReturnType<typeof useDragReorder>; projectOpts: string[] }) {
  const entity = entities.find(e => e.name === page.entity)
  const related = entities.filter(e => relationsTo(e, page.entity).length > 0).map(e => e.name)
  // Omitted childTabs means "every related list" — the same default the generator applies.
  const tabs = page.childTabs ?? related
  const selected = tabs.map(childTabEntity)
  const ordered = [...selected, ...related.filter(n => !selected.includes(n))]

  function toggle(name: string) {
    update(index, {
      childTabs: selected.includes(name) ? tabs.filter(t => childTabEntity(t) !== name) : [...tabs, name],
    })
  }
  function setVia(name: string, via: string) {
    update(index, { childTabs: tabs.map(t => (childTabEntity(t) === name ? withChildTab(t, { via: via || undefined }) : t)) })
  }
  function setShown(name: string, patch: { columns?: string[]; sort?: FullstackListSort }) {
    update(index, { childTabs: tabs.map(t => (childTabEntity(t) === name ? withChildTab(t, patch) : t)) })
  }

  return (
    <div className="space-y-2">
      <Field label="Entity" error={errors.entity} control="entity" hint="Rows of this entity open on this page">
        <EntitySelect
          label="Record entity"
          value={page.entity ?? ''}
          options={entities.map(e => e.name)}
          error={errors.entity}
          onChange={name => {
            // The related lists and header numbers described the old entity's relations.
            const { patch, dropped } = retargetRecord(page, name)
            lossy(`Opened ${name} on “${pageLabel(page)}”`, dropped)
            update(index, patch)
          }}
        />
      </Field>
      <div className="space-y-1" data-control="childTabs">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          Related lists as tabs, in order
          {page.childTabs == null && related.length > 0 && <span className="font-normal normal-case tracking-normal"> · every related list (default)</span>}
        </p>
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
                <li
                  key={name}
                  {...(on ? dnd.rowProps(`childTabs:${index}`, at) : {})}
                  className={`flex items-center gap-1.5 ${on ? dropIndicatorClass(dnd.indicatorFor(`childTabs:${index}`, at)) : ''}`}
                >
                  {on ? <DragGrip dnd={dnd} list={`childTabs:${index}`} index={at} /> : <span className="w-[14px]" />}
                  {on ? (
                    <MoveButtons
                      label={`the ${name} tab`}
                      canUp={at > 0}
                      canDown={at < selected.length - 1}
                      onMove={delta => update(index, { childTabs: moveItem(tabs, at, at + delta) })}
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
                  {on && (
                    <ViaSelect
                      label={`Link ${name} through`}
                      relations={relationsTo(entities.find(e => e.name === name), page.entity)}
                      value={childTabVia(tabs[at])}
                      error={errors[`childTab.${at}`]}
                      onChange={via => setVia(name, via)}
                    />
                  )}
                  {on && (
                    <ListOptions
                      label={`${name} tab`}
                      entity={entities.find(e => e.name === name)}
                      projectOpts={projectOpts}
                      columns={childTabPresentation(tabs[at]).columns}
                      sort={childTabPresentation(tabs[at]).sort}
                      onChange={patch => setShown(name, patch)}
                    />
                  )}
                  {on && errors[`childTab.${at}`] && <span className="text-[11px] text-error">{errors[`childTab.${at}`]}</span>}
                </li>
              )
            })}
          </ul>
        )}
        {errors.childTabs && <p className="text-[11px] text-error">{errors.childTabs}</p>}
        {page.childTabs != null && related.length > 0 && (
          <button type="button" onClick={() => update(index, { childTabs: undefined })} className={SMALL_BUTTON}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">restart_alt</span>
            All related lists (default)
          </button>
        )}
      </div>
      <HeaderStatsFields page={page} index={index} entities={entities} errors={errors} update={update} lossy={lossy} removed={removed} />
    </div>
  )
}

/** A record page's header tiles: none, the default (a count per related tab), or a list of
 *  counts/aggregates over related entities. */
function HeaderStatsFields({ page, index, entities, errors, update, lossy, removed }: FormProps) {
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
              onChange={name => {
                const { stat, dropped } = retargetHeaderStat(s, entities.find(e => e.name === name), page.entity)
                lossy(`Switched header number ${si + 1} to ${name}`, dropped)
                set(stats.map((x, i) => (i === si ? stat : x)))
              }}
            />
            <ViaSelect
              label="Link the tile through"
              relations={relationsTo(child, page.entity)}
              value={s.via}
              error={error}
              onChange={via => set(stats.map((x, i) => (i === si ? { ...x, via: via || undefined } : x)))}
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
              aria-label="Header number title"
              value={s.title ?? ''}
              maxLength={MAX_TITLE}
              placeholder="Title (optional)"
              onChange={e => set(stats.map((x, i) => (i === si ? { ...x, title: e.target.value || undefined } : x)))}
              className={`${inputClass()} min-w-[8rem] flex-1 py-1 text-xs`}
            />
            <button
              type="button"
              onClick={() => {
                removed?.(`Removed header number ${si + 1} from “${pageLabel(page)}”`)
                set(stats.filter((_, i) => i !== si))
              }}
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
function WizardForm({ page, index, entities, errors, update, lossy, removed, dnd }: FormProps & { dnd: ReturnType<typeof useDragReorder> }) {
  const entity = entities.find(e => e.name === page.entity)
  const askable = askableFields(entity)
  const steps = page.steps ?? defaultWizardSteps(entity)
  const setSteps = (next: { title?: string; fields: string[] }[]) => update(index, { steps: next })
  const stepOf = (name: string) => steps.findIndex(s => s.fields.includes(name))
  const unasked = askable.filter(a => stepOf(a.name) < 0)

  // The field chip being dragged to another step (native drag, across steps).
  const [draggedField, setDraggedField] = useState<string | null>(null)
  const [dropStep, setDropStep] = useState<number | null>(null)
  const unaskedRequired = unasked.filter(a => a.required)

  // Moves a field into step `si`, out of whichever step had it.
  const place = (name: string, si: number) => setSteps(steps.map((s, i) => ({
    ...s,
    fields: i === si ? (s.fields.includes(name) ? s.fields : [...s.fields, name]) : s.fields.filter(f => f !== name),
  })))

  return (
    <div className="space-y-2">
      <Field
        label="Entity"
        error={errors.entity}
        control="entity"
        hint="Creates rows — and edits them too (#/page/<id>); a record page's Edit opens the wizard"
      >
        <EntitySelect
          label="Wizard entity"
          value={page.entity ?? ''}
          options={entities.filter(e => !e.readOnly).map(e => e.name)}
          error={errors.entity}
          // Steps keep the fields the new entity also has; the rest are dealt in after them.
          onChange={name => {
            const { steps: next, dropped } = retargetWizardSteps(page.steps, entities.find(e => e.name === name))
            lossy(`Asked for ${name} in “${pageLabel(page)}”`, dropped)
            update(index, { entity: name, steps: next })
          }}
        />
      </Field>
      <div className="space-y-1" data-control="steps">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          Steps <span className="font-normal normal-case tracking-normal">· then a review before saving</span>
        </p>
        {steps.map((step, si) => {
          const error = errors[`step.${si}`]
          return (
            <div
              key={si}
              {...dnd.rowProps(`steps:${index}`, si)}
              onDragOver={e => {
                if (draggedField) {
                  e.preventDefault()
                  if (dropStep !== si) setDropStep(si)
                } else dnd.rowProps(`steps:${index}`, si).onDragOver(e)
              }}
              onDrop={e => {
                if (draggedField) {
                  e.preventDefault()
                  place(draggedField, si)
                  setDraggedField(null)
                  setDropStep(null)
                } else dnd.rowProps(`steps:${index}`, si).onDrop(e)
              }}
              className={`space-y-1 rounded border px-2 py-1.5 ${error ? 'border-error/50' : draggedField && dropStep === si ? 'border-primary bg-primary/5' : 'border-outline-variant'} ${
                dnd.isDragging(`steps:${index}`, si) ? 'opacity-40' : ''} ${dropIndicatorClass(dnd.indicatorFor(`steps:${index}`, si))}`}
              data-control={`step.${si}`}
              data-wizard-step={si}
            >
              <div className="flex items-center gap-1.5">
                <DragGrip dnd={dnd} list={`steps:${index}`} index={si} />
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
                  maxLength={MAX_TITLE}
                  placeholder={`Step ${si + 1}`}
                  onChange={e => setSteps(steps.map((s, i) => (i === si ? { ...s, title: e.target.value || undefined } : s)))}
                  className={`${inputClass()} min-w-[8rem] flex-1 py-1 text-xs`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const fields = steps[si].fields
                    removed?.(`Removed step ${si + 1} from “${pageLabel(page)}”`,
                      fields.length ? `${fields.join(', ')} ${fields.length === 1 ? 'is' : 'are'} no longer asked — add ${fields.length === 1 ? 'it' : 'them'} to another step` : undefined)
                    setSteps(steps.filter((_, i) => i !== si))
                  }}
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
                    <span
                      key={name}
                      draggable
                      onDragStart={e => {
                        e.stopPropagation()
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', name)
                        setDraggedField(name)
                      }}
                      onDragEnd={() => { setDraggedField(null); setDropStep(null) }}
                      title="Drag to another step"
                      className={`inline-flex cursor-grab items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${a ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'} ${draggedField === name ? 'opacity-40' : ''}`}
                      data-step-field={name}
                    >
                      {a?.relation && <span className="material-symbols-outlined" style={{ fontSize: '12px' }} aria-hidden="true">link</span>}
                      {keyOption(entity, name)}{a?.required && <span aria-label="required">*</span>}
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
                        {keyOption(entity, a.name)}{a.required ? ' *' : ''}{stepOf(a.name) >= 0 ? ` (from step ${stepOf(a.name) + 1})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {error && <p className="text-[11px] text-error">{error}</p>}
            </div>
          )
        })}
        {unaskedRequired.length > 0 && (
          <p className="text-[11px] text-error" data-wizard-unasked-required>
            Required but not asked: {unaskedRequired.map(a => a.name).join(', ')} — add each to a step, or the wizard cannot save.
          </p>
        )}
        {unasked.length > unaskedRequired.length && (
          <p className="text-[11px] text-secondary" data-wizard-unasked>
            Not asked (optional): {unasked.filter(a => !a.required).map(a => a.name).join(', ')}
          </p>
        )}
        <p className="text-[10px] text-secondary/80">Drag a field chip onto another step to move it.</p>
        <div className="flex flex-wrap items-center gap-2">
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
          {page.steps != null && (
            <button
              type="button"
              onClick={() => update(index, { steps: undefined })}
              className={SMALL_BUTTON}
              title={`The generator's steps: ${askable.length} field${askable.length === 1 ? '' : 's'}, four to a step, relations last`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">restart_alt</span>
              Reset to default steps
            </button>
          )}
        </div>
        {errors.steps && <p className="text-[11px] text-error">{errors.steps}</p>}
      </div>
    </div>
  )
}

// ── Small shared pieces ────────────────────────────────────────────────────

/** The grip that starts a drag of a row in `list` (the row itself is the drop target). */
function DragGrip({ dnd, list, index }: { dnd: ReturnType<typeof useDragReorder>; list: string; index: number }) {
  return (
    <span {...dnd.handleProps(list, index)} className="cursor-grab select-none text-secondary/70 hover:text-secondary" title="Drag to reorder" aria-hidden="true">
      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>drag_indicator</span>
    </span>
  )
}

/**
 * How an embedded list opens — a record's related list, a master–detail child: its columns (chips,
 * on or off; the shown ones in their order, each movable earlier) and its sort. Folded unless
 * something is set; absent parts are the list's own defaults.
 */
function ListOptions({ label, entity, projectOpts, columns, sort, onChange }: {
  label: string
  entity: FullstackEntityDef | undefined
  projectOpts: string[]
  columns?: string[]
  sort?: FullstackListSort
  onChange: (patch: { columns?: string[]; sort?: FullstackListSort }) => void
}) {
  const all = listColumns(entity, projectOpts)
  const keys = all.map(c => c.key)
  const shown = columns ?? keys
  const summary = [columns ? `${columns.length} column${columns.length === 1 ? '' : 's'}` : null, sort ? `by ${sort.field} ${sort.dir === 'desc' ? '↓' : '↑'}` : null].filter(Boolean).join(' · ')
  // Open on arrival when something is already set, so it is not missed; then the user's to fold.
  const [startOpen] = useState(Boolean(columns || sort))
  // The entity's order is the default: a list back to it drops the setting.
  const keep = (next: string[]) => onChange({ columns: next.join() === keys.join() ? undefined : next, sort })
  const ordered = [...shown.flatMap(k => all.filter(c => c.key === k)), ...all.filter(c => !shown.includes(c.key))]
  return (
    <details className="text-[11px]" data-list-options open={startOpen}>
      <summary className="cursor-pointer select-none text-secondary hover:text-primary">{summary || 'Columns & sort'}</summary>
      <div className="mt-1 space-y-1.5">
        <div className="flex flex-wrap gap-1">
          {ordered.map(c => {
            const on = shown.includes(c.key)
            const at = shown.indexOf(c.key)
            return (
              <span key={c.key} className="inline-flex items-center">
                {on && at > 0 && (
                  <button
                    type="button"
                    onClick={() => keep(moveItem(shown, at, at - 1))}
                    className="rounded-full px-1 text-secondary hover:text-primary"
                    aria-label={`Move the ${c.label} column earlier in the ${label}`}
                    title="Move earlier"
                  >
                    ‹
                  </button>
                )}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`${c.label} column of the ${label}`}
                  disabled={on && shown.length === 1}
                  onClick={() => keep(on ? shown.filter(k => k !== c.key) : [...shown, c.key])}
                  className={`rounded-full px-2 py-0.5 ${on ? 'bg-primary/10 text-primary' : 'border border-dashed border-outline-variant text-secondary'} disabled:opacity-50`}
                >
                  {c.label}
                </button>
              </span>
            )
          })}
        </div>
        <span className="inline-flex items-center gap-1.5">
          <select
            aria-label={`Sort of the ${label}`}
            value={sort?.field ?? ''}
            onChange={e => onChange({ columns, sort: e.target.value ? { field: e.target.value, ...(sort?.dir ? { dir: sort.dir } : {}) } : undefined })}
            className={`${inputClass()} max-w-[11rem] py-0.5 text-[11px]`}
          >
            <option value="">Default order (the key)</option>
            {sortableKeys(entity, projectOpts).map(k => <option key={k} value={k}>{all.find(c => c.key === k)?.label ?? k}</option>)}
          </select>
          {sort && (
            <button
              type="button"
              onClick={() => onChange({ columns, sort: { field: sort.field, ...(sort.dir === 'desc' ? {} : { dir: 'desc' as const }) } })}
              className="rounded border border-outline-variant px-1.5 py-0.5 text-secondary hover:text-primary"
              aria-label={`Sort the ${label} ${sort.dir === 'desc' ? 'ascending' : 'descending'}`}
            >
              {sort.dir === 'desc' ? '↓' : '↑'}
            </button>
          )}
        </span>
      </div>
    </details>
  )
}

/** The layout preview as a slide-over, for widths where it cannot sit beside the page list. */
function PreviewDrawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Modal for real: Tab stays inside, and focus goes back where it was when it closes.
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), select, input, [tabindex="0"]'))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex justify-end" data-preview-drawer>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Layout preview" className="relative flex h-full w-full max-w-md flex-col gap-2 overflow-y-auto bg-surface-container-lowest p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-secondary">
            <span className="font-semibold uppercase tracking-wider">Preview</span> · sample data · click a part to edit it
          </p>
          <button type="button" onClick={onClose} className={ICON_BUTTON} aria-label="Close the preview" autoFocus>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, error, hint, control, children }: { label: string; error?: string; hint?: string; control?: string; children: ReactNode }) {
  return (
    <div className="space-y-1" data-control={control}>
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-secondary">{label}</span>
      {children}
      {error ? <p className="text-[11px] text-error">{error}</p> : hint ? <p className="text-[10px] text-secondary">{hint}</p> : null}
    </div>
  )
}

/** Which of a child's several relations to the record entity links them — shown only when there
 *  is a choice. The default (blank) is the first relation, as the generator picks it. */
function ViaSelect({ label, relations, value, error, onChange }: {
  label: string
  relations: string[]
  value: string | undefined
  error?: string
  onChange: (via: string) => void
}) {
  if (relations.length < 2 && !value) return null
  return (
    <select
      aria-label={label}
      title="Which relation links these rows to the record"
      aria-invalid={Boolean(error)}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className={`${inputClass(error)} max-w-[10rem] py-0.5 text-[11px]`}
    >
      <option value="">via {relations[0] ? relationOption(relations[0]) : '?'} (default)</option>
      {relations.slice(1).map(r => <option key={r} value={r}>via {relationOption(r)}</option>)}
      {value && !relations.includes(value) && <option value={value}>via {value}</option>}
    </select>
  )
}

/** Entity picker that keeps an unknown (renamed away) value visible instead of dropping it. */
/** Entity name → its picker text (label, then name when they differ), for every EntitySelect. */
const EntityOptions = createContext<ReadonlyMap<string, string>>(new Map())

function EntitySelect({ label, value, options, error, empty, className, onChange }: {
  label: string
  value: string
  options: string[]
  error?: string
  empty?: string
  className?: string
  onChange: (name: string) => void
}) {
  const text = useContext(EntityOptions)
  return (
    <select
      aria-label={label}
      aria-invalid={Boolean(error)}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`${inputClass(error)} py-1 text-xs ${className ?? ''}`}
    >
      <option value="">{empty ?? '— pick an entity —'}</option>
      {options.map(n => <option key={n} value={n}>{text.get(n) ?? n}</option>)}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
    </select>
  )
}

