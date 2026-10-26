import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { FullstackPageType, FullstackWidgetDef } from '../../../types'
import { ConfirmDialog } from '../../ConfirmDialog'
import { cssEscape } from '../focus'
import { isTypingTarget } from '../undo'
import { LayoutPreview, type EditTarget } from '../LayoutPreview'
import { pageFromTemplate } from '../layoutTemplates'
import { MIN_TABS, PAGE_TYPE_META, defaultSpan, newPageChoices, pageFromSuggestion, pageLabel, pagesEmbedding } from '../pageLayout'
import type { PagesEditorProps } from '../PagesEditor'
import { handleRadioKeys, syncRadioTabStops } from '../rovingRadios'
import { focusWithoutClipping } from '../scroll'
import { ICON_BUTTON, SMALL_BUTTON } from '../pages/constants'
import { EntityOptions } from '../pages/fields'
import { offNavNoteFor, usePagesModel } from '../pages/usePagesModel'
import { DesignerInspector, tabOfControl, type InspectorTab } from './DesignerInspector'
import { DesignerLibrary, type LibraryTab } from './DesignerLibrary'
import { isPageDrag, type LibraryDrag } from './dragPayload'
import { IssuesPanel } from './IssuesPanel'
import { PageStrip } from './PageStrip'
import { SitemapView } from './SitemapView'

/** Where the designer opens: a page (and control), and which panel is showing. */
export interface DesignerTarget {
  page?: number
  control?: string
  panel?: 'add' | 'issues' | 'find' | 'templates' | 'widgets'
}

type DesignerProps = Omit<PagesEditorProps, 'revealRequest' | 'addRequest' | 'previewRequest' | 'findRequest' | 'layout'> & {
  target: DesignerTarget
  onClose: () => void
}

/** How much larger the canvas draws the preview than the editor's side panel does. */
const CANVAS_ZOOM = 1.35

/**
 * The full-screen layout designer: the library of page types, widgets and templates on the left,
 * the page strip over a live canvas of the generated app in the middle, and the selected page's
 * or widget's settings on the right. Every change goes through the shared page model, so undo,
 * validation and the request are the inline editor's.
 */
export function LayoutDesigner({ pages, entities, validation, onChange, pushUndo, previewSettings, history, serverIssue, ldapAuth, onAddDep, onOpenGuide, nav, onNavChange, dismissedWarnings, onDismissedWarningsChange, target, onClose }: DesignerProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [selectedWidget, setSelectedWidget] = useState<number | null>(null)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('basics')
  const [libraryTab, setLibraryTab] = useState<LibraryTab>(target.panel === 'templates' ? 'templates' : target.panel === 'add' ? 'pages' : 'widgets')
  const [issuesOpen, setIssuesOpen] = useState(target.panel === 'issues')
  const [view, setView] = useState<'design' | 'sitemap'>('design')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [drag, setDrag] = useState<LibraryDrag | null>(null)
  // A page type more than one entity fits: which one, and where it goes.
  const [entityForm, setEntityForm] = useState<{ type: FullstackPageType; pick: string; at?: number } | null>(null)
  const [confirmTemplate, setConfirmTemplate] = useState<{ label: string; built: typeof pages } | null>(null)
  const [findRequest] = useState(target.panel === 'find' ? 1 : 0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const inspectorRef = useRef<HTMLElement>(null)
  const librarySearchRef = useRef<HTMLInputElement>(null)

  const model = usePagesModel({
    pages, entities, validation, onChange, pushUndo, previewSettings, serverIssue,
    onOpenKey: key => { setSelectedKey(key); setSelectedWidget(null); setInspectorTab('basics') },
    onAdd: () => setEntityForm(null),
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

  /** Opens a page in the inspector on one of its controls (or its first invalid one), from the
   *  canvas, a problem or a jump. A widget control selects that widget. */
  function reveal(t: EditTarget) {
    const key = keys[t.page]
    if (!key) return
    setSelectedKey(key)
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
    if (target.panel === 'add') requestAnimationFrame(() => librarySearchRef.current?.focus())
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
      else if (widget != null) setSelectedWidget(null)
      else if (entityForm) setEntityForm(null)
      else onClose()
      return
    }
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || isTypingTarget(e.target) || view !== 'design') return
    if (e.key === '/' && !e.altKey) {
      e.preventDefault()
      librarySearchRef.current?.focus()
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

  /** A library page type, clicked or dropped at `at`: straight in, or ask which entity first. */
  function chooseType(type: FullstackPageType, at?: number) {
    if (type === 'tabs') {
      const picked = model.tabsEligible.slice(0, MIN_TABS).map(p => p.id)
      model.addTabsPage({ picked, title: 'Tabs', hide: true })
      return
    }
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
  function addWidget(kind: FullstackWidgetDef['kind'], entity: string, at?: number) {
    if (page?.type !== 'dashboard') return
    const index = model.addWidget(selectedIndex, kind, entity, at)
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

  return createPortal(
    <EntityOptions.Provider value={model.entityOptions}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Layout designer"
        tabIndex={-1}
        onKeyDown={onDialogKey}
        className="fixed inset-0 z-[55] flex flex-col bg-background text-on-surface outline-none"
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
            {([['design', 'Design'], ['sitemap', 'Sitemap']] as const).map(([value, label]) => (
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

        {view === 'sitemap' ? (
          <SitemapView pages={pages} model={model} nav={nav} onNavChange={onNavChange} onOpenPage={i => { selectPage(i); setView('design') }} />
        ) : (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
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
            onChooseType={type => chooseType(type)}
            onAddSuggestion={key => addSuggestion(key)}
            onAddMyTemplate={name => addMyTemplate(name)}
            onTemplate={useTemplate}
            onDrag={setDrag}
            searchRef={librarySearchRef}
          />

          <main className="flex min-h-[28rem] min-w-0 flex-1 flex-col" aria-label="Canvas">
            <PageStrip
              pages={pages}
              model={model}
              validation={validation}
              selected={selectedIndex}
              onSelect={selectPage}
              onAddPage={() => { setLibraryTab('pages'); requestAnimationFrame(() => librarySearchRef.current?.focus()) }}
              findRequest={findRequest}
              newPageDrop={isPageDrag(drag) ? { onDrop: dropPage } : null}
            />
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
              {page ? (
                <>
                  <span className="font-semibold text-on-surface">{pageLabel(page)}</span>
                  <span>{PAGE_TYPE_META[page.type]?.label}</span>
                  <span className="font-mono">#/{page.id || '…'}</span>
                  <span className="ms-auto">{page.type === 'dashboard' ? 'Click a widget to edit it · drag to move · drag its edge to resize' : 'Click a part of the page to edit it'}</span>
                  <span role="radiogroup" aria-label="Preview width" className="inline-flex overflow-hidden rounded-md border border-outline-variant">
                    {([['desktop', 'Desktop', 'computer'], ['mobile', 'Mobile', 'smartphone']] as const).map(([value, label, icon]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={device === value}
                        aria-label={label}
                        title={`${label} width`}
                        onClick={() => setDevice(value)}
                        className={`px-1.5 py-0.5 ${device === value ? 'bg-primary/15 text-on-surface' : 'text-secondary hover:text-on-surface'}`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">{icon}</span>
                      </button>
                    ))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedWidget(null)}
                    aria-pressed={widget == null}
                    className={`rounded-md border px-2 py-1 font-semibold ${widget == null ? 'border-primary/50 bg-primary/10 text-on-surface' : 'border-outline-variant text-secondary hover:text-on-surface'}`}
                  >
                    Page settings
                  </button>
                </>
              ) : <span>No pages yet</span>}
            </div>
            <div
              className="min-h-0 flex-1 overflow-auto bg-background p-6 [background-image:radial-gradient(var(--color-outline-variant)_1px,transparent_1px)] [background-size:16px_16px]"
              data-designer-canvas
            >
              {page ? (
                <div className={`mx-auto ${device === 'mobile' ? 'max-w-[18rem]' : 'max-w-[56rem]'}`} style={{ zoom: CANVAS_ZOOM }}>
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
                    widgetDrop={widgetDrag ? {
                      span: defaultSpan(widgetDrag.widget),
                      onDrop: (pageIndex, at) => {
                        setDrag(null)
                        if (pageIndex === selectedIndex) addWidget(widgetDrag.widget, widgetEntity, at)
                      },
                    } : null}
                  />
                </div>
              ) : (
                <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-outline px-8 py-14 text-center" data-designer-empty>
                  <h2 className="text-lg font-semibold">Start your layout</h2>
                  <p className="text-xs text-secondary">Pick a whole layout from Templates, start from your entities, or add pages one at a time from the library.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => model.startFromEntities()} disabled={model.named.length === 0} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-on-primary disabled:opacity-40" data-seed-layout>
                      Start from my entities
                    </button>
                    <button type="button" onClick={() => setLibraryTab('templates')} className={SMALL_BUTTON}>Browse templates</button>
                  </div>
                </div>
              )}
            </div>
          </main>

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
          />

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
