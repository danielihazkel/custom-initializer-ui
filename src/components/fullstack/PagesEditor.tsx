import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { handleRadioKeys, syncRadioTabStops } from './rovingRadios'
import type { FullstackEntityDef, FullstackNav, FullstackPageDef, FullstackPageType } from '../../types'
import { ConfirmDialog } from '../ConfirmDialog'
import { inputClass } from './controls'
import { entityOption } from './fieldOptions'
import { cssEscape } from './focus'
import { buildLayoutPreview } from './layoutPreviewModel'
import { LayoutPreview, type EditTarget, type PreviewPalette } from './LayoutPreview'
import { moveItem } from './reorder'
import { useStableKeys } from './rowKeys'
import { focusWithoutClipping, scrollToElement } from './scroll'
import { LAYOUT_TEMPLATES, buildLayoutTemplate, deletePageTemplate, pageFromTemplate, readPageTemplates, savePageTemplate } from './layoutTemplates'
import { useDragReorder } from './useDragReorder'
import {
  MAX_PAGES, MAX_TABS, MIN_TABS, PAGE_TYPE_META, defaultSpan, removePageAt, adoptedGroup, blankPage,
  masterDetailPairs, newPageChoices, newPageTypeReason, moveNavGroup, navSections, renameGroupInPages,
  retargetPage, tabCandidates, duplicatePage, inNav, listColumns, pageFromSuggestion, pageLabel,
  pagesEmbedding, relationsTo, reportCharts, renamePageIdInPages, seedLayout, slugify, suggestPages,
  uniquePageId, type PageLayoutValidation,
} from './pageLayout'
import type { Lossy, Removed } from './pages/formTypes'
import { ICON_BUTTON, SMALL_BUTTON } from './pages/constants'
import { EntityOptions, GroupChip, MoveButtons } from './pages/fields'
import { TemplateGallery } from './pages/TemplateGallery'
import { PreviewDrawer } from './pages/PreviewDrawer'
import { LayoutWarnings } from './pages/LayoutWarnings'
import { PageList } from './pages/PageList'

/** What the layout preview needs beyond the layout: the chrome language, the project-wide
 *  scaffold opts (list toolbars follow them) and which frontend set draws the shell. */
export interface PagesPreviewSettings {
  locale: 'en' | 'he'
  projectOpts: string[]
  skin: 'tailwind' | 'menora'
  /** The colour palette the generator will use — the tailwind shell and accents follow it. */
  palette?: PreviewPalette
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

const PREVIEW_KEY = 'fullstack:layoutPreview'
const SECTION_KEY = 'fullstack:pagesSection'
/** From this many pages on, the page list carries a search box (fewer: `/` or the palette shows it). */
const PAGE_SEARCH_FROM = 6
/** Nav page names the collapsed summary lists before it says "and N more". */
const SUMMARY_NAMES = 5

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
    // The new page must be on screen to open: a page search that would hide it is cleared.
    setPageQuery('')
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
    const own = newPageTypeReason(type, named, others)
    if (own) return { short: 'not available', reason: own }
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
    onChange(removePageAt(pages, index, dropTabs))
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
    // A jump to a page the search is hiding clears the search, or there would be nothing to open.
    if (!matchesQuery(pages[target.page])) setPageQuery('')
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
                  : newPageTypeReason(type, named, pages) ?? noFitReason(type)
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
        <LayoutWarnings warnings={validation.warnings} pages={pages} reveal={reveal} pushUndo={pushUndo} onChange={onChange} />
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
                palette={settings.palette}
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
          <PageList
            pages={pages}
            keys={keys}
            validation={validation}
            openKey={openKey}
            dnd={dnd}
            preview={preview}
            previewIndex={previewIndex}
            showPreview={showPreview}
            matchesQuery={matchesQuery}
            setHoverTo={setHoverTo}
            targetOf={targetOf}
            hoverFocused={hoverFocused}
            move={move}
            openPage={openPage}
            pushUndo={pushUndo}
            onChange={onChange}
            update={update}
            atPageCap={atPageCap}
            duplicate={duplicate}
            requestRemove={requestRemove}
            saveAsTemplate={saveAsTemplate}
            changeType={changeType}
            switchBlocked={switchBlocked}
            retitle={retitle}
            unlockId={unlockId}
            ldapAuth={ldapAuth}
            onAddDep={onAddDep}
            named={named}
            lossy={lossy}
            removed={removed}
            projectOpts={projectOpts}
            expandRequest={expandRequest}
          />
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
                palette={settings.palette}
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
            palette={settings.palette}
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
