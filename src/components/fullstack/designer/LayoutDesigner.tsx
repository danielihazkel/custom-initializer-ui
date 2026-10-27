import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { FullstackPageType, FullstackWidgetDef } from '../../../types'
import { ConfirmDialog } from '../../ConfirmDialog'
import { cssEscape } from '../focus'
import { isTypingTarget } from '../undo'
import { LayoutPreview, type EditTarget } from '../LayoutPreview'
import { pageFromTemplate } from '../layoutTemplates'
import { buildPlayLinks } from '../playLinks'
import { PAGE_TYPE_META, defaultSpan, newPageChoices, pageFromSuggestion, pageLabel, pagesEmbedding } from '../pageLayout'
import type { PagesEditorProps } from '../PagesEditor'
import { handleRadioKeys, syncRadioTabStops } from '../rovingRadios'
import { focusWithoutClipping } from '../scroll'
import { ICON_BUTTON, SMALL_BUTTON } from '../pages/constants'
import { BulkPageBar } from '../pages/BulkPageBar'
import { EntityOptions } from '../pages/fields'
import { NewTabsForm, initialTabsForm, type TabsFormState } from '../pages/NewTabsForm'
import { offNavNoteFor, usePagesModel } from '../pages/usePagesModel'
import { DesignerInspector, tabOfControl, type InspectorTab } from './DesignerInspector'
import { DesignerLibrary, type LibraryTab } from './DesignerLibrary'
import { isPageDrag, type LibraryDrag } from './dragPayload'
import { PAGE_SLOTS, type PagePart } from '../pageParts'
import { readClipboard, widgetName, writeClipboard, type WidgetClip } from '../widgetClipboard'
import { IssuesPanel } from './IssuesPanel'
import { PageStrip } from './PageStrip'
import { SitemapView } from './SitemapView'
import { AppearanceView } from './AppearanceView'
import { CANVAS_ZOOM, CanvasFrame, DeviceSwitch, ZOOM_LEVELS, ZoomControl, type PreviewDevice } from './CanvasFrame'
import { DesignerMenu, type MenuItem } from './DesignerMenu'
import type { FrontendAppearance } from './FrontendSettings'

/** Where the designer opens: a page (and control), and which panel is showing. */
export interface DesignerTarget {
  page?: number
  control?: string
  panel?: 'add' | 'issues' | 'find' | 'templates' | 'widgets' | 'appearance'
}

type DesignerProps = Omit<PagesEditorProps, 'revealRequest' | 'addRequest' | 'previewRequest' | 'findRequest' | 'layout'> & {
  /** The generated app's look, edited in the Appearance view. Absent: no Appearance view. */
  appearance?: FrontendAppearance
  target: DesignerTarget
  onClose: () => void
}

/** How the designer was last laid out in this browser: the canvas zoom and which side panes show. */
interface DesignerPrefs {
  zoom: number
  library: boolean
  inspector: boolean
}
const PREFS_KEY = 'fullstack:designerView'
const DEFAULT_PREFS: DesignerPrefs = { zoom: CANVAS_ZOOM, library: true, inspector: true }

function readPrefs(): DesignerPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<DesignerPrefs> | null
    if (!raw || typeof raw !== 'object') return DEFAULT_PREFS
    return {
      zoom: ZOOM_LEVELS.includes(raw.zoom as number) ? raw.zoom as number : DEFAULT_PREFS.zoom,
      library: raw.library !== false,
      inspector: raw.inspector !== false,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

/** The history list under the undo button: the edits redo would replay (furthest first), then
 *  the ones undo would take back (latest first). Picking one jumps there in one step. */
export function historyMenuItems(undoEntries: string[], redoEntries: string[], onJump: (steps: number) => void): MenuItem[] {
  const redo = redoEntries.map((label, i): MenuItem => ({
    key: `redo:${i}`,
    label: `Redo to: ${label}`,
    icon: 'redo',
    tone: 'muted',
    onSelect: () => onJump(redoEntries.length - i),
  }))
  const undo = [...undoEntries].reverse().map((label, i): MenuItem => ({
    key: `undo:${i}`,
    label: i === 0 ? `Undo: ${label}` : `Undo ${i + 1} back to before: ${label}`,
    icon: 'undo',
    onSelect: () => onJump(-(i + 1)),
  }))
  return [...redo, ...undo]
}

/**
 * The full-screen layout designer: the library of page types, widgets and templates on the left,
 * the page strip over a live canvas of the generated app in the middle, and the selected page's
 * or widget's settings on the right. Every change goes through the shared page model, so undo,
 * validation and the request are the inline editor's.
 */
export function LayoutDesigner({ pages, entities, validation, onChange, pushUndo, previewSettings, history, serverIssue, ldapAuth, onAddDep, onOpenGuide, nav, onNavChange, appearance, dismissedWarnings, onDismissedWarningsChange, codeRequest, target, onClose }: DesignerProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [selectedWidget, setSelectedWidget] = useState<number | null>(null)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('basics')
  const [libraryTab, setLibraryTab] = useState<LibraryTab>(target.panel === 'templates' ? 'templates' : target.panel === 'add' ? 'pages' : 'widgets')
  const [issuesOpen, setIssuesOpen] = useState(target.panel === 'issues')
  const [view, setView] = useState<'design' | 'sitemap' | 'appearance'>(target.panel === 'appearance' && appearance ? 'appearance' : 'design')
  const [device, setDevice] = useState<PreviewDevice>('desktop')
  const [drag, setDrag] = useState<LibraryDrag | null>(null)
  // Play mode: the canvas follows the generated app's links. `trail` is the pages walked through
  // (row keys, so a reorder does not lose it); `playNote` says why a click opened no page.
  const [mode, setMode] = useState<'design' | 'play'>('design')
  const [trail, setTrail] = useState<string[]>([])
  const [playNote, setPlayNote] = useState<string | null>(null)
  // A page type more than one entity fits: which one, and where it goes.
  const [entityForm, setEntityForm] = useState<{ type: FullstackPageType; pick: string; at?: number } | null>(null)
  const [confirmTemplate, setConfirmTemplate] = useState<{ label: string; built: typeof pages } | null>(null)
  const [findRequest] = useState(target.panel === 'find' ? 1 : 0)
  // The "which pages become tabs" step of a new tabs page, and where it goes.
  const [tabsForm, setTabsForm] = useState<(TabsFormState & { at?: number }) | null>(null)
  // Pages picked in the strip for a bulk action, by id (ids that no longer exist drop out).
  const [pickedIds, setPickedIds] = useState<string[]>([])
  const picked = pickedIds.filter(id => pages.some(p => p.id === id))
  const [bulkRemove, setBulkRemove] = useState<{ count: number; run: () => void } | null>(null)
  const [prefs, setPrefs] = useState(readPrefs)
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* preference only */ }
  }, [prefs])
  const [historyOpen, setHistoryOpen] = useState(false)
  // Copied widgets (also in sessionStorage, so a copy survives closing the designer).
  const [clip, setClip] = useState<WidgetClip | null>(readClipboard)
  const historyButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const inspectorRef = useRef<HTMLElement>(null)
  const librarySearchRef = useRef<HTMLInputElement>(null)
  // Bumped to focus the library search once the library is on screen (it may be hidden now).
  const [searchFocus, setSearchFocus] = useState(target.panel === 'add' ? 1 : 0)
  useEffect(() => { if (searchFocus) librarySearchRef.current?.focus() }, [searchFocus])

  const model = usePagesModel({
    pages, entities, validation, onChange, pushUndo, previewSettings, serverIssue, ldapAuth,
    onOpenKey: key => { setSelectedKey(key); setSelectedWidget(null); setInspectorTab('basics') },
    onAdd: () => { setEntityForm(null); setTabsForm(null) },
    onRemovedKey: key => setSelectedKey(prev => (prev === key ? null : prev)),
  })
  const { keys, preview, settings } = model
  const selectedIndex = (() => {
    const i = selectedKey ? keys.indexOf(selectedKey) : -1
    return i >= 0 ? i : preview.nav[0]?.index ?? 0
  })()
  const page = pages[selectedIndex]
  const widget = page?.type === 'dashboard' && selectedWidget != null && selectedWidget < (page.widgets?.length ?? 0) ? selectedWidget : null
  // The entity new widgets read: the one picked in the library, else the dashboard's last widget's
  // (the likeliest next one), else the first entity.
  const [pickedEntity, setPickedEntity] = useState('')
  const lastEntity = [...(page?.widgets ?? [])].reverse().find(w => w.entity && model.named.some(e => e.name === w.entity))?.entity
  const widgetEntity = model.named.some(e => e.name === pickedEntity) ? pickedEntity : lastEntity ?? model.named[0]?.name ?? ''

  function selectPage(index: number) {
    setSelectedKey(keys[index] ?? null)
    setSelectedWidget(null)
  }

  const playLinks = useMemo(() => buildPlayLinks(pages, entities), [pages, entities])
  // The walked pages that still exist, as indexes; the last is the one on the canvas.
  const trailIndexes = trail.map(k => keys.indexOf(k)).filter(i => i >= 0)
  function startPlay() {
    if (!page) return
    setMode('play')
    setTrail([keys[selectedIndex]])
    setSelectedWidget(null)
    setPlayNote(null)
  }
  function stopPlay() {
    setMode('design')
    setPlayNote(null)
  }
  /** Follows a link in Play mode: the page opens on the canvas (and in the inspector). */
  function playGo(index: number) {
    const key = keys[index]
    if (!key) return
    setTrail(t => (t[t.length - 1] === key ? t : [...t, key].slice(-30)))
    setSelectedKey(key)
    setSelectedWidget(null)
    setPlayNote(null)
  }
  /** Back to the `at`-th page of the trail (default: the one before this). */
  function playBackTo(at = trailIndexes.length - 2) {
    if (at < 0) return
    const kept = trail.filter(k => keys.includes(k)).slice(0, at + 1)
    setTrail(kept)
    setSelectedKey(kept[kept.length - 1] ?? null)
    setPlayNote(null)
  }

  /** Opens a page in the inspector on one of its controls (or its first invalid one), from the
   *  canvas, a problem or a jump. A widget control selects that widget. */
  function reveal(t: EditTarget) {
    const key = keys[t.page]
    if (!key) return
    setSelectedKey(key)
    if (!prefs.inspector) setPrefs(p => ({ ...p, inspector: true }))
    const w = t.control ? /^widget\.(\d+)/.exec(t.control) : null
    if (w) setSelectedWidget(Number(w[1]))
    else {
      setSelectedWidget(null)
      setInspectorTab(tabOfControl(t.control?.split('.')[0]))
    }
    const attempt = (triesLeft: number) => {
      const root = inspectorRef.current
      const scope = t.control
        ? root?.querySelector<HTMLElement>(`[data-control="${cssEscape(t.control)}"]`)
        : root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.closest<HTMLElement>('[data-control]') ?? null
      const control = scope?.matches('input, select, textarea, button')
        ? scope
        : scope?.querySelector<HTMLElement>('input:not([type="checkbox"]), select, textarea, button, input')
      // A click on a widget selects it; only a jump to a deeper control moves the focus there.
      if (control && !(w && t.control === w[0])) {
        focusWithoutClipping(control, 'center')
        return
      }
      if (triesLeft > 0) requestAnimationFrame(() => attempt(triesLeft - 1))
    }
    requestAnimationFrame(() => attempt(2))
  }

  // Where the designer was asked to open.
  useEffect(() => {
    if (target.page != null) reveal({ page: target.page, control: target.control })
    if (target.panel === 'add' || target.panel === 'templates') openLibrary()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, [])

  // Modal for real: the page behind does not scroll, Tab stays inside, focus returns on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [])
  // The designer's keys (listed in FULLSTACK_SHORTCUTS): read through a ref, so the one listener
  // always sees the current selection.
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  onKeyRef.current = (e: KeyboardEvent) => {
    // A confirm opened over the designer owns the keyboard.
    if (document.querySelectorAll('[role="dialog"][aria-modal="true"]').length > 1) return
    if (e.key === 'Escape' && !e.defaultPrevented) {
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      if (issuesOpen) setIssuesOpen(false)
      else if (mode === 'play') stopPlay()
      else if (widget != null) setSelectedWidget(null)
      else if (entityForm) setEntityForm(null)
      else if (tabsForm) setTabsForm(null)
      else if (picked.length > 0) setPickedIds([])
      else onClose()
      return
    }
    if ((e.ctrlKey || e.metaKey) && !e.defaultPrevented && !isTypingTarget(e.target) && view === 'design' && mode === 'design') {
      // Copy, cut and paste widgets — unless text is selected, which the browser's own copy is for.
      if (e.altKey || e.shiftKey || window.getSelection()?.toString()) return
      const key = e.key.toLowerCase()
      if ((key === 'c' || key === 'x') && copyWidgets(key === 'x')) e.preventDefault()
      else if (key === 'v' && clip) { e.preventDefault(); pasteClip() }
      return
    }
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || isTypingTarget(e.target) || view !== 'design') return
    if ((e.key === 'p' || e.key === 'P') && !e.altKey && !e.shiftKey) {
      e.preventDefault()
      if (mode === 'play') stopPlay()
      else startPlay()
      return
    }
    if (e.key === '/' && !e.altKey) {
      e.preventDefault()
      openLibrary()
      setSearchFocus(n => n + 1)
      return
    }
    if (widget == null) return
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.altKey) {
      e.preventDefault()
      model.removeWidget(selectedIndex, widget)
      setSelectedWidget(null)
      return
    }
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    e.preventDefault()
    const forward = (e.key === 'ArrowRight') !== Boolean(preview.rtl)
    const w = page?.widgets?.[widget]
    if (!w) return
    if (e.shiftKey) {
      const span = Math.max(1, Math.min(4, (w.span ?? defaultSpan(w.kind)) + (forward ? 1 : -1)))
      model.resizeWidget(selectedIndex, widget, span)
    } else {
      const to = widget + (forward ? 1 : -1)
      if (to >= 0 && to < (page?.widgets?.length ?? 0)) reorderWidget(selectedIndex, widget, to)
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      onKeyRef.current(e)
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea, [tabindex="0"]'))
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Each radio group is one Tab stop, walked with the arrow keys (the forms' own convention).
  useLayoutEffect(() => syncRadioTabStops(dialogRef.current))
  function onDialogKey(e: ReactKeyboardEvent<HTMLElement>) {
    if (!e.ctrlKey && !e.metaKey && !e.altKey) handleRadioKeys(e)
  }

  /** Shows the library pane when it was hidden — before a search or a tab in it is focused. */
  function openLibrary() {
    if (!prefs.library) setPrefs(p => ({ ...p, library: true }))
  }

  /** A library page type, clicked or dropped at `at`: straight in, or ask which entity first. */
  function chooseType(type: FullstackPageType, at?: number) {
    if (type === 'tabs') {
      setEntityForm(null)
      setTabsForm({ ...initialTabsForm(model.tabsEligible), at })
      return
    }
    setTabsForm(null)
    const fit = model.fittingChoices(type)
    if (fit.length <= 1) model.addPage(type, fit[0]?.value, at)
    else setEntityForm({ type, pick: fit[0].value, at })
  }
  function addSuggestion(key: string, at?: number) {
    const s = model.suggestions.find(x => x.key === key)
    if (s) model.add(pageFromSuggestion(s, pages.map(p => p.id)), at)
  }
  function addMyTemplate(name: string, at?: number) {
    const t = model.myTemplates.find(x => x.name === name)
    if (t) model.add(pageFromTemplate(t, pages), at)
  }
  function addWidget(kind: FullstackWidgetDef['kind'], entity: string, at?: number, def?: FullstackWidgetDef) {
    if (page?.type !== 'dashboard') return
    const index = def ? model.addWidgetDef(selectedIndex, def, at) : model.addWidget(selectedIndex, kind, entity, at)
    setSelectedWidget(index)
  }
  function useTemplate(label: string, built: typeof pages) {
    if (pages.length > 0) setConfirmTemplate({ label, built })
    else model.startFromTemplate(label, built)
  }
  function dropPage(at: number) {
    const d = drag
    setDrag(null)
    if (!d) return
    if (d.kind === 'page') chooseType(d.type, at)
    else if (d.kind === 'suggestion') addSuggestion(d.key, at)
    else if (d.kind === 'my-template') addMyTemplate(d.name, at)
  }
  /** A part dropped or clicked onto the page on the canvas; a refusal is said in the notice. */
  function placePart(part: PagePart, at?: number) {
    const reason = model.placePart(selectedIndex, part, at)
    if (reason) model.setNotice(reason)
  }
  /** A strip chip dragged while a tabs page is on the canvas: it can become one of its tabs. */
  function chipDrag(index: number | null) {
    const target = index == null ? undefined : pages[index]
    setDrag(page?.type === 'tabs' && target && index !== selectedIndex ? { kind: 'part', part: { kind: 'tab', page: target.id } } : null)
  }
  /** Copies the selected widget — or every widget, with none selected — of the dashboard on the
   *  canvas; `cut` removes the selected one too. False when there was nothing to copy. */
  function copyWidgets(cut = false): boolean {
    if (page?.type !== 'dashboard') return false
    const all = page.widgets ?? []
    if (cut && widget == null) return false
    const copied = widget != null ? [all[widget]] : all
    if (copied.length === 0) return false
    const next = { widgets: copied, from: pageLabel(page) }
    setClip(next)
    const kept = writeClipboard(next)
    const what = copied.length === 1 ? `“${widgetName(copied[0])}”` : `${copied.length} widgets`
    if (cut && widget != null) {
      model.removeWidget(selectedIndex, widget)
      setSelectedWidget(null)
      model.setNotice(`Cut ${what} — Ctrl+V pastes it on any dashboard`)
    } else {
      model.setNotice(`Copied ${what} — Ctrl+V pastes ${copied.length === 1 ? 'it' : 'them'} on any dashboard${kept ? '' : ' (until the designer closes: this browser refused to keep it)'}`)
    }
    return true
  }
  /** The clipboard onto the dashboard on the canvas: after the selected widget, else at the end. */
  function pasteClip() {
    if (!clip) return
    const placed = model.pasteWidgetsAt(selectedIndex, clip, widget != null ? widget + 1 : undefined)
    if (placed) setSelectedWidget(placed.at)
  }
  /** The selected widget moved to another dashboard, which then opens with it selected. */
  function moveWidget(toIndex: number) {
    if (widget == null) return
    const at = model.moveWidgetTo(selectedIndex, widget, toIndex)
    if (at == null) return
    setSelectedKey(keys[toIndex] ?? null)
    setSelectedWidget(at)
  }
  function reorderWidget(pageIndex: number, from: number, to: number) {
    model.reorderWidget(pageIndex, from, to)
    if (pageIndex !== selectedIndex || widget == null) return
    if (widget === from) setSelectedWidget(to)
    else if (from < widget && to >= widget) setSelectedWidget(widget - 1)
    else if (from > widget && to <= widget) setSelectedWidget(widget + 1)
  }

  const issueCount = model.issues.length
  const tipCount = validation.warnings.length
  const widgetDrag = drag?.kind === 'widget' ? drag : null
  const partDrag = drag?.kind === 'part' && page && (PAGE_SLOTS[page.type] ?? []).includes(drag.part.kind) ? drag : null
  const takesParts = page != null && (PAGE_SLOTS[page.type] ?? []).length > 0

  return createPortal(
    <EntityOptions.Provider value={model.entityOptions}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Layout designer"
        tabIndex={-1}
        onKeyDown={onDialogKey}
        // Above the app header (z-50) and every view, below confirms and toasts (z-60/70). Inline, so
        // it never hangs on Tailwind having generated a class only this file uses.
        style={{ zIndex: 55 }}
        className="fixed inset-0 flex flex-col bg-background text-on-surface outline-none"
        data-layout-designer
      >
        <header className="flex flex-wrap items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-4 py-2">
          <button type="button" onClick={onClose} className={ICON_BUTTON} aria-label="Close the layout designer" title="Close (Esc)">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
          <div className="me-auto min-w-0">
            <h1 className="text-sm font-semibold">Layout designer</h1>
            <p className="text-[11px] text-secondary">
              {pages.length} page{pages.length === 1 ? '' : 's'} · {model.named.length} entit{model.named.length === 1 ? 'y' : 'ies'}
            </p>
          </div>
          <div role="radiogroup" aria-label="View" className="flex gap-0.5 rounded-lg border border-outline-variant bg-surface-container p-0.5">
            {([['design', 'Design'], ['sitemap', 'Sitemap'], ...(appearance ? [['appearance', 'Appearance'] as const] : [])] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={view === value}
                onClick={() => setView(value)}
                className={`rounded-md px-3 py-1 text-xs ${view === value ? 'bg-surface-container-high font-semibold text-on-surface' : 'text-secondary hover:text-on-surface'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {history && (
            <span className="inline-flex items-center">
              <button type="button" onClick={history.onUndo} disabled={!history.undoLabel} className={ICON_BUTTON} title={history.undoLabel ? `${history.undoLabel} (Ctrl+Z)` : 'Nothing to undo'} aria-label={history.undoLabel ?? 'Undo (nothing to undo)'} data-designer-undo>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>undo</span>
              </button>
              <button type="button" onClick={history.onRedo} disabled={!history.redoLabel} className={ICON_BUTTON} title={history.redoLabel ? `${history.redoLabel} (Ctrl+Shift+Z)` : 'Nothing to redo'} aria-label={history.redoLabel ?? 'Redo (nothing to redo)'} data-designer-redo>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>redo</span>
              </button>
              {history.onJump && (
                <span className="relative">
                  <button
                    ref={historyButtonRef}
                    type="button"
                    onClick={() => setHistoryOpen(o => !o)}
                    disabled={!history.undoEntries?.length && !history.redoEntries?.length}
                    aria-expanded={historyOpen}
                    aria-haspopup="menu"
                    className={ICON_BUTTON}
                    title="History — jump back several changes"
                    aria-label="History"
                    data-designer-history
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>history</span>
                  </button>
                  {historyOpen && (
                    <DesignerMenu
                      label="History"
                      heading="History"
                      items={historyMenuItems(history.undoEntries ?? [], history.redoEntries ?? [], history.onJump)}
                      returnFocus={historyButtonRef.current}
                      onClose={() => setHistoryOpen(false)}
                      className="end-0 top-full mt-1"
                    />
                  )}
                </span>
              )}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIssuesOpen(o => !o)}
            aria-expanded={issuesOpen}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              issueCount > 0 ? 'bg-error/10 text-error' : tipCount > 0 ? 'bg-amber-400/15 text-amber-600' : 'bg-tertiary/10 text-tertiary'}`}
            data-designer-issues-toggle
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">{issueCount > 0 ? 'error' : tipCount > 0 ? 'lightbulb' : 'check_circle'}</span>
            {issueCount > 0 ? `${issueCount} problem${issueCount === 1 ? '' : 's'}` : 'Ready'}
            {tipCount > 0 && ` · ${tipCount} tip${tipCount === 1 ? '' : 's'}`}
          </button>
          {onOpenGuide && (
            <button type="button" onClick={() => { onClose(); onOpenGuide('fs-pages') }} className={ICON_BUTTON} aria-label="Open the guide on frontend pages" title="How page layouts work">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>help</span>
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-on-primary">Done</button>
        </header>

        {model.notice && (
          <div className="flex flex-wrap items-center gap-2 border-b border-amber-400/40 bg-amber-400/10 px-4 py-1.5 text-[11px] text-on-surface" role="status" data-pages-notice>
            <span className="material-symbols-outlined text-amber-600" style={{ fontSize: '14px' }} aria-hidden="true">info</span>
            <span className="flex-1">{model.notice}</span>
            {history?.undoLabel && (
              <button type="button" onClick={() => { model.setNotice(null); history.onUndo() }} className="font-semibold text-primary hover:underline">Undo</button>
            )}
            <button type="button" onClick={() => model.setNotice(null)} className={ICON_BUTTON} aria-label="Dismiss">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
            </button>
          </div>
        )}

        {view === 'appearance' && appearance ? (
          <AppearanceView
            pages={pages}
            entities={entities}
            model={model}
            appearance={appearance}
            nav={nav}
            selected={selectedIndex}
            onSelectPage={selectPage}
            onEdit={t => { setView('design'); reveal(t) }}
            device={device}
            onDevice={setDevice}
            zoom={prefs.zoom}
            onZoom={zoom => setPrefs(p => ({ ...p, zoom }))}
            onEditStartDashboard={() => {
              const dashboard = pages.findIndex(p => p.type === 'dashboard')
              setView('design')
              reveal({ page: dashboard >= 0 ? dashboard : selectedIndex, control: 'title' })
            }}
          />
        ) : view === 'sitemap' ? (
          <SitemapView pages={pages} model={model} nav={nav} onNavChange={onNavChange} onOpenPage={i => { selectPage(i); setView('design') }} />
        ) : (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {prefs.library && (
          <DesignerLibrary
            pages={pages}
            model={model}
            tab={libraryTab}
            onTab={setLibraryTab}
            page={page}
            onSelectPage={selectPage}
            entity={widgetEntity}
            onEntity={setPickedEntity}
            onAddWidget={kind => addWidget(kind, widgetEntity)}
            onAddWidgetDef={def => addWidget(def.kind, def.entity, undefined, def)}
            onAddPart={placePart}
            clip={clip}
            onPaste={pasteClip}
            pageIndex={selectedIndex}
            onChooseType={type => chooseType(type)}
            onAddSuggestion={key => addSuggestion(key)}
            onAddMyTemplate={name => addMyTemplate(name)}
            onTemplate={useTemplate}
            onDrag={setDrag}
            searchRef={librarySearchRef}
          />
          )}

          <main className="flex min-h-[28rem] min-w-0 flex-1 flex-col" aria-label="Canvas">
            <PageStrip
              pages={pages}
              model={model}
              validation={validation}
              selected={selectedIndex}
              onSelect={selectPage}
              onAddPage={() => { setLibraryTab('pages'); openLibrary(); setSearchFocus(n => n + 1) }}
              findRequest={findRequest}
              newPageDrop={isPageDrag(drag) ? { onDrop: dropPage } : null}
              picked={picked}
              onPick={setPickedIds}
              onChipDrag={chipDrag}
            />
            {picked.length > 0 && (
              <div className="border-b border-outline-variant bg-surface-container-lowest px-4 py-2">
                <BulkPageBar
                  pages={pages}
                  picked={picked}
                  onPick={setPickedIds}
                  pushUndo={pushUndo}
                  onChange={onChange}
                  ldapAuth={ldapAuth}
                  onRemoveRequest={(count, run) => setBulkRemove({ count, run })}
                />
              </div>
            )}
            {tabsForm && (
              <NewTabsForm
                eligible={model.tabsEligible}
                form={tabsForm}
                onChange={form => setTabsForm({ ...form, at: tabsForm.at })}
                onAdd={() => model.addTabsPage(tabsForm, tabsForm.at)}
                onCancel={() => setTabsForm(null)}
                className="border-b border-primary/30 bg-primary/5 px-4 py-2"
              />
            )}
            {entityForm && (
              <div className="flex flex-wrap items-center gap-2 border-b border-primary/30 bg-primary/5 px-4 py-2" data-entity-form>
                <p className="text-xs font-semibold text-on-surface">
                  New {PAGE_TYPE_META[entityForm.type].label.toLowerCase()} page — {entityForm.type === 'master-detail' ? 'which parent and child?' : 'which entity?'}
                </p>
                <ul role="radiogroup" aria-label="Entity for the new page" className="flex flex-wrap gap-1.5">
                  {(newPageChoices(entityForm.type, model.named, pages) ?? []).map(c => {
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
                          onDoubleClick={() => { if (!c.reason) model.addPage(entityForm.type, c.value, entityForm.at) }}
                          className={`rounded-full border px-2.5 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-primary/50 bg-primary/10 font-semibold text-primary' : 'border-outline-variant text-on-surface hover:border-primary/40'}`}
                        >
                          {c.label}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <button type="button" onClick={() => model.addPage(entityForm.type, entityForm.pick, entityForm.at)} className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary">
                  Add {PAGE_TYPE_META[entityForm.type].label.toLowerCase()} page
                </button>
                <button type="button" onClick={() => setEntityForm(null)} className={SMALL_BUTTON}>Cancel</button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-4 py-1.5 text-[11px] text-secondary">
              <button
                type="button"
                onClick={() => setPrefs(p => ({ ...p, library: !p.library }))}
                aria-pressed={prefs.library}
                className={`${ICON_BUTTON} hidden lg:inline-flex`}
                title={prefs.library ? 'Hide the library' : 'Show the library'}
                aria-label={prefs.library ? 'Hide the library' : 'Show the library'}
                data-toggle-library
              >
                <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>{prefs.library ? 'left_panel_close' : 'left_panel_open'}</span>
              </button>
              {page && (
                <span role="radiogroup" aria-label="Canvas mode" className="inline-flex overflow-hidden rounded-md border border-outline-variant" data-canvas-mode>
                  {([['design', 'Design', 'edit'], ['play', 'Play', 'play_arrow']] as const).map(([value, label, icon]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={mode === value}
                      onClick={() => (value === 'play' ? (mode === 'play' ? undefined : startPlay()) : stopPlay())}
                      title={value === 'play' ? 'Click through the app as its users will (P)' : 'Click a part to edit it (P)'}
                      className={`inline-flex items-center gap-0.5 px-2 py-0.5 font-semibold ${mode === value ? 'bg-primary/15 text-on-surface' : 'text-secondary hover:text-on-surface'}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">{icon}</span>
                      {label}
                    </button>
                  ))}
                </span>
              )}
              {page && mode === 'play' ? (
                <>
                  <button
                    type="button"
                    onClick={() => playBackTo()}
                    disabled={trailIndexes.length < 2}
                    className={ICON_BUTTON}
                    aria-label="Back to the page before"
                    title="Back"
                    data-play-back
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>arrow_back</span>
                  </button>
                  <nav aria-label="Pages walked through" className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5" data-play-trail>
                    {trailIndexes.map((index, i) => {
                      const last = i === trailIndexes.length - 1
                      return (
                        <span key={`${i}:${keys[index]}`} className="inline-flex items-center gap-0.5">
                          {i > 0 && <span className="material-symbols-outlined text-secondary/70" style={{ fontSize: '13px' }} aria-hidden="true">chevron_right</span>}
                          {last
                            ? <span className="font-semibold text-on-surface" aria-current="page">{pageLabel(pages[index])}</span>
                            : <button type="button" onClick={() => playBackTo(i)} className="text-primary hover:underline">{pageLabel(pages[index])}</button>}
                        </span>
                      )
                    })}
                  </nav>
                  <ZoomControl zoom={prefs.zoom} onChange={zoom => setPrefs(p => ({ ...p, zoom }))} />
                  <DeviceSwitch device={device} onChange={setDevice} />
                </>
              ) : page ? (
                <>
                  <span className="font-semibold text-on-surface">{pageLabel(page)}</span>
                  <span>{PAGE_TYPE_META[page.type]?.label}</span>
                  <span className="font-mono">#/{page.id || '…'}</span>
                  <span className="ms-auto">{page.type === 'dashboard' ? 'Click a widget to edit it · drag to move · drag its edge to resize' : takesParts ? 'Click a part to edit it · drag parts in from the library' : 'Click a part of the page to edit it'}</span>
                  <ZoomControl zoom={prefs.zoom} onChange={zoom => setPrefs(p => ({ ...p, zoom }))} />
                  <DeviceSwitch device={device} onChange={setDevice} />
                  <button
                    type="button"
                    onClick={() => setSelectedWidget(null)}
                    aria-pressed={widget == null}
                    className={`rounded-md border px-2 py-1 font-semibold ${widget == null ? 'border-primary/50 bg-primary/10 text-on-surface' : 'border-outline-variant text-secondary hover:text-on-surface'}`}
                  >
                    Page settings
                  </button>
                </>
              ) : <span className="me-auto">No pages yet</span>}
              <button
                type="button"
                onClick={() => setPrefs(p => ({ ...p, inspector: !p.inspector }))}
                aria-pressed={prefs.inspector}
                className={`${ICON_BUTTON} hidden lg:inline-flex`}
                title={prefs.inspector ? 'Hide the settings pane' : 'Show the settings pane'}
                aria-label={prefs.inspector ? 'Hide the settings pane' : 'Show the settings pane'}
                data-toggle-inspector
              >
                <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>{prefs.inspector ? 'right_panel_close' : 'right_panel_open'}</span>
              </button>
            </div>
            {mode === 'play' && page && (
              <p className="flex items-center gap-1.5 border-b border-outline-variant bg-primary/5 px-4 py-1 text-[11px] text-secondary" role="status" data-play-status>
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '14px' }} aria-hidden="true">{playNote ? 'info' : 'touch_app'}</span>
                {playNote ?? 'Playing: rows, tiles, charts, Back and Save go where the generated app goes. Esc or P to edit again.'}
              </p>
            )}
            {page ? (
                <CanvasFrame device={device} zoom={prefs.zoom}>
                  {mode === 'play' ? (
                    <LayoutPreview
                      // A new page remounts the screen, so tabs and wizard steps start at the first.
                      key={keys[selectedIndex]}
                      preview={preview}
                      selected={selectedIndex}
                      onSelect={playGo}
                      onEdit={() => {}}
                      skin={settings.skin}
                      palette={settings.palette}
                      offNavNote={offNavNoteFor(page)}
                      navStyle={nav?.style}
                      collapsibleGroups={nav?.collapsibleGroups}
                      narrow={device === 'mobile'}
                      play={{ links: playLinks, go: playGo, note: setPlayNote }}
                    />
                  ) : (
                  <LayoutPreview
                    preview={preview}
                    selected={selectedIndex}
                    onSelect={selectPage}
                    onEdit={reveal}
                    highlight={widget != null ? { page: selectedIndex, control: `widget.${widget}` } : null}
                    skin={settings.skin}
                    palette={settings.palette}
                    offNavNote={offNavNoteFor(page)}
                    onReorderWidget={reorderWidget}
                    onResizeWidget={model.resizeWidget}
                    navStyle={nav?.style}
                    collapsibleGroups={nav?.collapsibleGroups}
                    narrow={device === 'mobile'}
                    problems={validation.byPage}
                    widgetDrop={widgetDrag ? {
                      span: defaultSpan(widgetDrag.widget),
                      onDrop: (pageIndex, at) => {
                        setDrag(null)
                        if (pageIndex === selectedIndex) addWidget(widgetDrag.widget, widgetEntity, at, widgetDrag.def)
                      },
                    } : null}
                    partDrop={partDrag ? {
                      slot: partDrag.part.kind,
                      onDrop: (pageIndex, at) => {
                        setDrag(null)
                        if (pageIndex === selectedIndex) placePart(partDrag.part, at)
                      },
                    } : null}
                  />
                  )}
                </CanvasFrame>
              ) : (
              <div className="min-h-0 flex-1 overflow-auto bg-background p-6" data-designer-canvas>
                <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-outline px-8 py-14 text-center" data-designer-empty>
                  <h2 className="text-lg font-semibold">Start your layout</h2>
                  <p className="text-xs text-secondary">Pick a whole layout from Templates, start from your entities, or add pages one at a time from the library.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => model.startFromEntities()} disabled={model.named.length === 0} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-on-primary disabled:opacity-40" data-seed-layout>
                      Start from my entities
                    </button>
                    <button type="button" onClick={() => { setLibraryTab('templates'); openLibrary() }} className={SMALL_BUTTON}>Browse templates</button>
                  </div>
                </div>
              </div>
            )}
          </main>

          {prefs.inspector && (
          <DesignerInspector
            pages={pages}
            model={model}
            index={selectedIndex}
            widget={widget}
            tab={inspectorTab}
            onTab={setInspectorTab}
            onDeselectWidget={() => setSelectedWidget(null)}
            ldapAuth={ldapAuth}
            onAddDep={onAddDep}
            rootRef={inspectorRef}
            codeRequest={codeRequest}
            problems={validation.issues.length}
            clip={clip}
            onCopyWidgets={() => copyWidgets()}
            onPasteWidgets={pasteClip}
            onMoveWidget={moveWidget}
          />
          )}

          {issuesOpen && (
            <IssuesPanel
              pages={pages}
              model={model}
              issues={model.issues}
              validation={validation}
              reveal={t => { setIssuesOpen(false); reveal(t) }}
              onClose={() => setIssuesOpen(false)}
              dismissedWarnings={dismissedWarnings}
              onDismissedWarningsChange={onDismissedWarningsChange}
            />
          )}
        </div>
        )}
        <p className="sr-only" role="status">{issueCount === 0 ? '' : `${issueCount} layout problem${issueCount === 1 ? '' : 's'}`}</p>
      </div>

      {model.confirmRemove != null && pages[model.confirmRemove] && (
        <ConfirmDialog
          title={`Remove “${pageLabel(pages[model.confirmRemove])}”?`}
          message={`It is a tab of ${pagesEmbedding(pages, pages[model.confirmRemove].id).map(p => `“${pageLabel(p)}”`).join(', ')}. Removing it removes that tab too.`}
          confirmLabel="Remove page and tab"
          tone="danger"
          onConfirm={() => model.removePage(model.confirmRemove!, true)}
          onCancel={() => model.setConfirmRemove(null)}
        />
      )}
      {bulkRemove && (
        <ConfirmDialog
          title={`Remove ${bulkRemove.count} page${bulkRemove.count === 1 ? '' : 's'}?`}
          message="Tabs, links and record openings that point at them go too. Undo brings them back."
          confirmLabel="Remove pages"
          tone="danger"
          onConfirm={() => { bulkRemove.run(); setBulkRemove(null) }}
          onCancel={() => setBulkRemove(null)}
        />
      )}
      {confirmTemplate && (
        <ConfirmDialog
          title={`Replace the layout with “${confirmTemplate.label}”?`}
          message={`This builds ${confirmTemplate.built.length} page${confirmTemplate.built.length === 1 ? '' : 's'} from your entities in place of the ${pages.length} you have. Undo brings them back.`}
          confirmLabel="Replace the layout"
          onConfirm={() => { model.startFromTemplate(confirmTemplate.label, confirmTemplate.built); setConfirmTemplate(null); setSelectedKey(null) }}
          onCancel={() => setConfirmTemplate(null)}
        />
      )}
    </EntityOptions.Provider>,
    document.body,
  )
}
