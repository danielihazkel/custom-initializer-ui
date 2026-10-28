import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { FullstackEntityDef, FullstackPageDef, FullstackPageType, FullstackWidgetDef } from '../../../types'
import { entityOption } from '../fieldOptions'
import { buildLayoutPreview } from '../layoutPreviewModel'
import { placePart as placePagePart, renamePart as renamePagePart, type PagePart } from '../pageParts'
import { moveItem } from '../reorder'
import { useStableKeys } from '../rowKeys'
import { LAYOUT_TEMPLATES, buildLayoutTemplate, deletePageTemplate, readPageTemplates, savePageTemplate } from '../layoutTemplates'
import { useDragReorder } from '../useDragReorder'
import {
  deleteWidgetTemplate, fitWidget, pasteWidgets, readWidgetTemplates, saveWidgetTemplate, widgetName, type WidgetClip,
} from '../widgetClipboard'
import {
  MAX_PAGES, MAX_WIDGETS, MIN_TABS, PAGE_TYPE_META, defaultSpan, removePageAt, adoptedGroup, blankPage,
  masterDetailPairs, newPageChoices, newPageTypeReason, moveNavGroup, navSections, renameGroupInPages,
  fixAllProblems, retargetPage, retargetWidget, tabCandidates, duplicatePage, listColumns, newWidget, pageLabel,
  pagesEmbedding, relationsTo, reportCharts, renamePageIdInPages, seedLayout, slugify, suggestPages,
  uniquePageId, type PageFix, type PageLayoutValidation,
} from '../pageLayout'
import type { Lossy, Removed } from './formTypes'
import { WIDGET_KINDS } from './constants'

/** What the layout's view-model needs beyond the layout: the chrome language, the project-wide
 *  scaffold opts (list toolbars follow them) and what the model's design kit allows. */
export interface PagesPreviewSettings {
  locale: 'en' | 'he'
  projectOpts: string[]
  /** The kit's shell honours the layout's nav options (sidebar/top bar, folding groups); absent = it does. */
  navOptions?: boolean
  /** Nav icons the model's design kit adds to the lucide ones. */
  kitNavIcons?: string[]
  /** The setup panel's dashboard heading — "Start from my entities" puts it on the dashboard page. */
  dashboardTitle?: string
  dashboardOverview?: string
}

export const DEFAULT_PREVIEW_SETTINGS: PagesPreviewSettings = { locale: 'en', projectOpts: [] }

export interface PagesModelOptions {
  pages: FullstackPageDef[]
  entities: FullstackEntityDef[]
  validation: PageLayoutValidation
  onChange: (next: FullstackPageDef[]) => void
  /** Records a labelled undo entry before a change that would be annoying to retype. */
  pushUndo: (label: string) => void
  previewSettings?: PagesPreviewSettings
  /** A 400 from Generate that names a page of this layout — listed first with the problems. */
  serverIssue?: { page: number; message: string } | null
  /** A page was just added (or duplicated): its row key, once the key exists — the host opens it. */
  onOpenKey?: (key: string) => void
  /** A page is being added — the host closes its gallery, clears a search that would hide it. */
  onAdd?: () => void
  /** A page was removed: its row key, so the host can forget it was open. */
  onRemovedKey?: (key: string) => void
  /** Whether an LDAP auth dependency is selected — "Fix all" validates with it, as the host does. */
  ldapAuth?: boolean
}

/** Why a page is not in the navigation, said where its preview is shown; undefined when it is. */
export function offNavNoteFor(page: FullstackPageDef | undefined): string | undefined {
  if (!page) return undefined
  if (page.type === 'record') return `Opens from a ${page.entity || 'record'} row — not in the navigation.`
  if (page.hidden && (page.type === 'wizard' || page.type === 'form')) return 'Link only — opened from a Page links widget or a list’s New button, not from the navigation.'
  if (page.hidden) return 'Tab only — reachable inside a tabs page, not from the navigation.'
  return undefined
}

export interface LayoutIssue {
  page?: number
  field?: string
  summary: string
  fix?: PageFix
  alsoFix?: PageFix
}

/**
 * The page layout's editing model, shared by the inline Pages editor and the full-screen layout
 * designer: every change to the pages goes through here (each with the undo entry and notice it
 * deserves), so the two hosts cannot drift apart. Selection, galleries and other view state stay
 * with each host.
 */
/**
 * `pages` for what is only drawn from them — the canvas preview, suggestion lists — a render behind
 * while typing, so a keystroke in the inspector doesn't wait for every page to be redrawn from
 * sample data. Only while the layout keeps its shape (the same pages, of the same types, with the
 * same widgets): an add, a remove or a type switch is drawn at once, so indices never disagree.
 */
export function useDrawnPages(pages: FullstackPageDef[]): FullstackPageDef[] {
  const deferred = useDeferredValue(pages)
  if (deferred === pages || deferred.length !== pages.length) return pages
  for (let i = 0; i < pages.length; i++) {
    const a = deferred[i]; const b = pages[i]
    if (a.type !== b.type || (a.widgets?.length ?? 0) !== (b.widgets?.length ?? 0)) return pages
  }
  return deferred
}

export function usePagesModel({ pages, entities, validation, onChange, pushUndo, previewSettings, serverIssue, onOpenKey, onAdd, onRemovedKey, ldapAuth }: PagesModelOptions) {
  const keys = useStableKeys(pages, p => p.id)
  const named = entities.filter(e => e.name.trim())
  const settings = previewSettings ?? DEFAULT_PREVIEW_SETTINGS
  // The project-wide scaffold opts: a list page's audit columns exist only with `audit` on.
  const projectOpts = previewSettings?.projectOpts ?? []
  const atPageCap = pages.length >= MAX_PAGES

  // "Changed widget 2 — dropped: target" after a switch that could not keep everything.
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null)

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

  // A new row's key is minted on the next render; it is handed to the host by position once it exists.
  const pendingOpen = useRef<number | null>(null)
  useEffect(() => {
    if (pendingOpen.current == null) return
    const index = pendingOpen.current
    pendingOpen.current = null
    if (keys[index]) onOpenKey?.(keys[index])
  }, [keys])

  /** Adds a page at the end, or at `at`; the host opens it once its key exists. */
  function add(page: FullstackPageDef, at = pages.length) {
    onAdd?.()
    const next = [...pages]
    next.splice(at, 0, page)
    onChange(next)
    pendingOpen.current = at
  }

  function addPage(type: FullstackPageType, pick?: string, at?: number) {
    add(blankPage(type, named, pages, pick), at)
  }

  /** Why a gallery card is off: no entity fits the type (each entity's own reason is in the chooser). */
  function noFitReason(type: FullstackPageType, others: FullstackPageDef[] = pages): string | undefined {
    const choices = newPageChoices(type, named, others)
    if (!choices || choices.length === 0 || choices.some(c => !c.reason)) return undefined
    return `No entity fits: ${[...new Set(choices.map(c => c.reason!))].join('; ').toLowerCase()}`
  }
  const hasMdPair = masterDetailPairs(named).length > 0
  const tabsEligible = tabCandidates(pages)
  /** Why a new page of `type` cannot be added — the gallery card's reason, or undefined when it can. */
  function newTypeReason(type: FullstackPageType): string | undefined {
    if (type === 'master-detail' && !hasMdPair) return 'Add a many-to-one relation between two entities first (the child’s Relations table)'
    if (type === 'tabs' && tabsEligible.length < MIN_TABS) return 'Add two pages that can be tabs first — a list, dashboard, report or master–detail'
    return newPageTypeReason(type, named, pages) ?? noFitReason(type)
  }
  /** The entities a new page of `type` can be about (none needed: undefined). */
  function fittingChoices(type: FullstackPageType) {
    return (newPageChoices(type, named, pages) ?? []).filter(c => !c.reason)
  }
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

  /** A tabs page over the `picked` pages, at the end or at `at`; `hide` takes them out of the nav. */
  function addTabsPage({ picked, title, hide }: { picked: string[]; title: string; hide: boolean }, at = pages.length) {
    const tabsPage: FullstackPageDef = {
      id: uniquePageId(slugify(title) || 'tabs', pages.map(p => p.id)),
      type: 'tabs',
      title: title.trim() || 'Tabs',
      tabs: picked.map(page => ({ page })),
    }
    pushUndo(`Added a tabs page over ${picked.length} pages`)
    onAdd?.()
    const next = hide ? pages.map(p => (picked.includes(p.id) && !p.hidden ? { ...p, hidden: true, group: undefined, icon: undefined } : p)) : [...pages]
    const index = Math.max(0, Math.min(at, next.length))
    next.splice(index, 0, tabsPage)
    onChange(next)
    pendingOpen.current = index
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
  /** A new widget of `kind` reading `entity`, at the end or at `at`; returns where it landed. */
  function addWidget(pageIndex: number, kind: FullstackWidgetDef['kind'], entity: string, at?: number): number {
    const page = pages[pageIndex]
    return addWidgetDef(pageIndex, newWidget(kind, entity, pages.filter(p => p !== page)), at)
  }
  /** A widget made elsewhere (a suggestion), at the end or at `at`; returns where it landed. */
  function addWidgetDef(pageIndex: number, widget: FullstackWidgetDef, at?: number): number {
    const widgets = pages[pageIndex]?.widgets ?? []
    const index = at == null ? widgets.length : Math.max(0, Math.min(at, widgets.length))
    const next = [...widgets]
    next.splice(index, 0, { ...widget })
    update(pageIndex, { widgets: next })
    return index
  }
  function setWidget(pageIndex: number, wi: number, patch: Partial<FullstackWidgetDef>) {
    const widgets = pages[pageIndex]?.widgets ?? []
    update(pageIndex, { widgets: widgets.map((w, i) => (i === wi ? { ...w, ...patch } : w)) })
  }
  /** A new kind or entity keeps what still fits; anything dropped is named, with an undo. */
  function retargetWidgetAt(pageIndex: number, wi: number, patch: { kind?: FullstackWidgetDef['kind']; entity?: string }) {
    const page = pages[pageIndex]
    const before = page?.widgets?.[wi]
    if (!page || !before) return
    if ((patch.kind ?? before.kind) === before.kind && (patch.entity ?? before.entity) === before.entity) return
    const { widget, dropped } = retargetWidget(before, patch, entities.find(e => e.name === (patch.entity ?? before.entity)))
    lossy(`Changed widget ${wi + 1} of “${pageLabel(page)}”`, dropped)
    update(pageIndex, { widgets: (page.widgets ?? []).map((w, i) => (i === wi ? widget : w)) })
  }
  /** A copy of widget `wi` right after it; returns where the copy landed (undefined at the cap). */
  function duplicateWidget(pageIndex: number, wi: number): number | undefined {
    const widgets = pages[pageIndex]?.widgets ?? []
    if (!widgets[wi]) return undefined
    if (widgets.length >= MAX_WIDGETS) {
      setNotice(`A dashboard can have at most ${MAX_WIDGETS} widgets`)
      return undefined
    }
    const next = [...widgets]
    next.splice(wi + 1, 0, { ...widgets[wi] })
    update(pageIndex, { widgets: next })
    return wi + 1
  }
  function removeWidget(pageIndex: number, wi: number) {
    const page = pages[pageIndex]
    const widget = page?.widgets?.[wi]
    if (!page || !widget) return
    removed(`Removed widget ${wi + 1} (${WIDGET_KINDS.find(k => k.kind === widget.kind)?.label ?? widget.kind}) from “${pageLabel(page)}”`)
    update(pageIndex, { widgets: (page.widgets ?? []).filter((_, i) => i !== wi) })
  }

  /** Widgets from the clipboard (or a saved widget) into dashboard `pageIndex` at `at`, as one
   *  undo step. Returns where they landed, or undefined — the reason is in the notice. */
  function pasteWidgetsAt(pageIndex: number, clip: WidgetClip, at?: number): { at: number; added: number } | undefined {
    const pasted = pasteWidgets(pages, pageIndex, clip, named, at)
    if ('reason' in pasted) {
      setNotice(pasted.reason)
      return undefined
    }
    pushUndo(pasted.label)
    update(pageIndex, { widgets: pasted.widgets })
    setNotice(pasted.skipped.length ? `${pasted.label}. Left out — ${pasted.skipped.join('; ')}` : null)
    return { at: pasted.at, added: pasted.added }
  }
  /** Widget `wi` of one dashboard moved to the end of another, as one undo step. Returns its new
   *  index, or undefined (the reason is in the notice). */
  function moveWidgetTo(pageIndex: number, wi: number, toIndex: number): number | undefined {
    const from = pages[pageIndex]
    const to = pages[toIndex]
    const widget = from?.widgets?.[wi]
    if (!from || !widget || to?.type !== 'dashboard' || toIndex === pageIndex) return undefined
    const target = to.widgets ?? []
    if (target.length >= MAX_WIDGETS) {
      setNotice(`“${pageLabel(to)}” already has the most widgets a dashboard can have (${MAX_WIDGETS})`)
      return undefined
    }
    const fit = fitWidget(widget, pages, named)
    if ('reason' in fit) {
      setNotice(fit.reason)
      return undefined
    }
    pushUndo(`Moved “${widgetName(widget)}” from “${pageLabel(from)}” to “${pageLabel(to)}”`)
    onChange(pages.map((p, i) => (i === pageIndex ? { ...p, widgets: (p.widgets ?? []).filter((_, j) => j !== wi) }
      : i === toIndex ? { ...p, widgets: [...target, fit.widget] } : p)))
    return target.length
  }

  // Widgets saved in this browser: offered in the library's Widgets tab.
  const [widgetTemplates, setWidgetTemplates] = useState(readWidgetTemplates)
  function saveWidgetAsTemplate(widget: FullstackWidgetDef) {
    const name = widgetName(widget)
    const replaced = widgetTemplates.some(t => t.name === name)
    if (!saveWidgetTemplate(name, widget)) {
      setNotice('This browser refused to store the widget (storage full or blocked).')
      return
    }
    setWidgetTemplates(readWidgetTemplates())
    setNotice(`${replaced ? 'Updated' : 'Saved'} “${name}” — add it to any dashboard from the library's Widgets tab › My widgets.`)
  }
  function forgetWidgetTemplate(name: string) {
    deleteWidgetTemplate(name)
    setWidgetTemplates(readWidgetTemplates())
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
    if (keys[index]) onRemovedKey?.(keys[index])
  }

  /** Removes a page — after a confirm when another page embeds it as a tab. */
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

  /** Moves a page to `to` (the index it lands on); dropped among a group's pages, it joins the group. */
  function movePageTo(from: number, to: number) {
    const moved = moveItem(pages, from, to)
    const group = adoptedGroup(moved, to)
    if (group == null) return onChange(moved)
    pushUndo(`Moved “${pageLabel(moved[to])}” into the “${group}” group`)
    return onChange(moved.map((p, i) => (i === to ? { ...p, group } : p)))
  }

  function makeStart(index: number, startIndex: number) {
    pushUndo(`Made “${pageLabel(pages[index])}” the start page`)
    onChange(moveItem(pages, index, startIndex))
  }

  function toggleHidden(index: number) {
    const page = pages[index]
    update(index, page.hidden ? { hidden: false } : { hidden: true, group: undefined, icon: undefined })
  }

  function startFromEntities() {
    pushUndo('Started a page layout from the entities')
    onChange(seedLayout(entities, { title: previewSettings?.dashboardTitle, description: previewSettings?.dashboardOverview }))
  }
  // Building all the whole-layout templates is a few ms per model edit, and the gallery is rarely
  // on screen: built on first call (only a visible gallery calls it), then kept until the model changes.
  const layoutTemplates = useMemo(() => {
    let built: { template: (typeof LAYOUT_TEMPLATES)[number]; result: ReturnType<typeof buildLayoutTemplate> }[] | undefined
    return () => (built ??= LAYOUT_TEMPLATES.map(t => ({ template: t, result: buildLayoutTemplate(t, entities) })))
  }, [entities])
  function startFromTemplate(label: string, built: FullstackPageDef[]) {
    pushUndo(pages.length > 0 ? `Replaced the page layout with the “${label}” template` : `Started a page layout from the “${label}” template`)
    onChange(built)
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
  function forgetTemplate(name: string) {
    deletePageTemplate(name)
    setMyTemplates(readPageTemplates())
  }

  const dnd = useDragReorder((list, from, to) => {
    if (list === 'pages') return movePageTo(from, to)
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

  /** A part dragged (or clicked) onto a page — a tab, a chart, a related list or number, a wizard
   *  field — as its own undo entry. Returns why it could not go there, if it could not. */
  function placePart(pageIndex: number, part: PagePart, at?: number): string | undefined {
    const placed = placePagePart(pages, pageIndex, named, part, at)
    if ('reason' in placed) return placed.reason
    pushUndo(placed.label)
    update(pageIndex, placed.patch)
    return undefined
  }

  /** A title renamed on the canvas — the page's own, or a widget's, tab's, step's or header
   *  number's — as its own undo step. A blank title goes back to the default. */
  function renamePart(pageIndex: number, control: string, value: string) {
    const page = pages[pageIndex]
    if (!page) return
    if (control === 'title') {
      const title = value.trim()
      if (!title && page.type === 'tabs') {
        setNotice('A tabs page needs a title — it heads the tab strip')
        return
      }
      pushUndo(title ? `Renamed “${pageLabel(page)}” to “${title}”` : `Cleared the title of “${pageLabel(page)}”`)
      retitle(pageIndex, title)
      return
    }
    if (control === 'description') {
      const description = value.trim()
      pushUndo(description ? `Changed the description of “${pageLabel(page)}”` : `Cleared the description of “${pageLabel(page)}”`)
      update(pageIndex, { description: description || undefined })
      return
    }
    const renamed = renamePagePart(pages, pageIndex, named, control, value)
    if ('reason' in renamed) {
      setNotice(renamed.reason)
      return
    }
    pushUndo(renamed.label)
    update(pageIndex, renamed.patch)
  }

  /** A problem's or warning's fix: its own undo entry, then the change. */
  function applyFix(fix: PageFix) {
    pushUndo(fix.label)
    onChange(fix.apply(pages))
  }
  /** Every problem's own fix, as one undo step; the notice names how many held. */
  function fixAll() {
    const { pages: next, applied } = fixAllProblems(pages, entities, { scaffoldOpts: projectOpts, ldapAuth })
    if (applied.length === 0) return
    pushUndo(applied.length === 1 ? applied[0] : `Applied ${applied.length} fixes`)
    onChange(next)
    setNotice(`Applied ${applied.length} fix${applied.length === 1 ? '' : 'es'}: ${applied.join('; ')}.`)
  }

  const entityOptions = useMemo(() => new Map(entities.map(e => [e.name, entityOption(e)])), [entities])
  const warnPages = useMemo(() => new Set(validation.warnings.map(w => w.page).filter((p): p is number => p != null)), [validation.warnings])
  const drawnPages = useDrawnPages(pages)
  const preview = useMemo(
    () => buildLayoutPreview(drawnPages, entities, { locale: settings.locale, projectOpts: settings.projectOpts, warnPages }),
    [drawnPages, entities, settings.locale, settings.projectOpts, warnPages],
  )
  const suggestions = useMemo(() => suggestPages(entities, drawnPages), [entities, drawnPages])

  const issues: LayoutIssue[] = serverIssue && pages[serverIssue.page]
    ? [{ page: serverIssue.page, field: undefined, summary: `The server rejected “${pageLabel(pages[serverIssue.page])}”: ${serverIssue.message}`, fix: undefined }, ...validation.issues]
    : validation.issues

  return {
    keys, named, settings, projectOpts, atPageCap,
    notice, setNotice, lossy, removed,
    confirmRemove, setConfirmRemove,
    update, retitle, unlockId,
    add, addPage, addTabsPage, newTypeReason, fittingChoices, noFitReason, switchBlocked, hasMdPair, tabsEligible,
    navGroupSections, renameGroup, moveGroup,
    renamePart, reorderWidget, resizeWidget, addWidget, addWidgetDef, setWidget, retargetWidgetAt, duplicateWidget, removeWidget,
    pasteWidgetsAt, moveWidgetTo, widgetTemplates, saveWidgetAsTemplate, forgetWidgetTemplate,
    changeType, removePage, requestRemove, duplicate, move, movePageTo, makeStart, toggleHidden,
    startFromEntities, layoutTemplates, startFromTemplate, myTemplates, saveAsTemplate, forgetTemplate,
    placePart, dnd, applyFix, fixAll, entityOptions, preview, suggestions, issues,
    pushUndo, onChange,
    /** The messages on one page's controls, by control key. */
    validationErrors: (index: number): Record<string, string> => validation.byPage[index] ?? {},
  }
}

export type PagesModel = ReturnType<typeof usePagesModel>
