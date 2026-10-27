import type { FullstackEntityDef, FullstackPageDef, FullstackWidgetDef } from '../../types'
import { MAX_WIDGETS, pageLabel } from './pageLayout'
import { WIDGET_KINDS } from './pages/constants'

/**
 * The designer's widget clipboard and saved widgets. Copying keeps widgets in this tab's
 * `sessionStorage` (so the clipboard outlives closing the designer and switching dashboards,
 * not the browser session); "Save as widget" keeps one in `localStorage`, offered in the
 * library's Widgets tab. Either may come back to a model that changed meanwhile, so every
 * widget is fitted to the layout before it lands (`fitWidget`).
 */
export interface WidgetClip {
  widgets: FullstackWidgetDef[]
  /** The dashboard it was copied from, for the notice. */
  from: string
}
export interface WidgetTemplate {
  name: string
  widget: FullstackWidgetDef
}

const CLIP_KEY = 'fullstack:widgetClipboard'
const TEMPLATES_KEY = 'fullstack:widgetTemplates'

/** Kinds that read no single entity. */
const ENTITYLESS: FullstackWidgetDef['kind'][] = ['text', 'links', 'activity']

const isWidget = (w: unknown): w is FullstackWidgetDef =>
  !!w && typeof w === 'object' && typeof (w as FullstackWidgetDef).kind === 'string' && WIDGET_KINDS.some(k => k.kind === (w as FullstackWidgetDef).kind)
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export function readClipboard(): WidgetClip | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(CLIP_KEY) ?? 'null') as WidgetClip | null
    if (!raw || !Array.isArray(raw.widgets)) return null
    const widgets = raw.widgets.filter(isWidget)
    return widgets.length ? { widgets, from: String(raw.from ?? '') } : null
  } catch {
    return null
  }
}

/** False when the browser refused to store it. */
export function writeClipboard(clip: WidgetClip): boolean {
  try {
    sessionStorage.setItem(CLIP_KEY, JSON.stringify({ widgets: clip.widgets.map(clone), from: clip.from }))
    return true
  } catch {
    return false
  }
}

export function readWidgetTemplates(): WidgetTemplate[] {
  try {
    const raw = JSON.parse(localStorage.getItem(TEMPLATES_KEY) ?? '[]') as unknown
    return Array.isArray(raw)
      ? raw.filter((t): t is WidgetTemplate => !!t && typeof t === 'object' && typeof (t as WidgetTemplate).name === 'string' && isWidget((t as WidgetTemplate).widget))
      : []
  } catch {
    return []
  }
}

/** Saves `widget` under `name`, replacing one of that name. False when storage refused. */
export function saveWidgetTemplate(name: string, widget: FullstackWidgetDef): boolean {
  const next = [...readWidgetTemplates().filter(t => t.name !== name), { name, widget: clone(widget) }]
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

export function deleteWidgetTemplate(name: string): void {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(readWidgetTemplates().filter(t => t.name !== name)))
  } catch { /* a preference only */ }
}

/** What a widget is called in notices and the library: its title, else its kind and entity. */
export function widgetName(w: FullstackWidgetDef): string {
  if (w.title?.trim()) return w.title.trim()
  const kind = WIDGET_KINDS.find(k => k.kind === w.kind)?.label ?? w.kind
  return w.entity && !ENTITYLESS.includes(w.kind) ? `${kind} · ${w.entity}` : kind
}

export type FittedWidget = { widget: FullstackWidgetDef; dropped: string[] } | { reason: string }

/**
 * A copied or saved widget, made to fit this layout: its entity must still exist; links to pages
 * that are gone are dropped (said in `dropped`), and so is a drill target that is gone. Field
 * settings are left for the validator, which names anything that no longer fits.
 */
export function fitWidget(widget: FullstackWidgetDef, pages: FullstackPageDef[], entities: FullstackEntityDef[]): FittedWidget {
  const w = clone(widget)
  const dropped: string[] = []
  const names = new Set(entities.map(e => e.name))
  const ids = new Set(pages.map(p => p.id))
  if (!ENTITYLESS.includes(w.kind) && !names.has(w.entity)) {
    return { reason: w.entity ? `There is no ${w.entity} entity in this model` : 'It reads no entity' }
  }
  if (w.drillTo && !ids.has(w.drillTo)) {
    dropped.push(`its drill-down to “${w.drillTo}”`)
    delete w.drillTo
  }
  if (w.kind === 'links') {
    const kept = (w.pages ?? []).filter(id => ids.has(id))
    if (kept.length === 0) return { reason: 'None of the pages it links to are in this layout' }
    if (kept.length < (w.pages ?? []).length) dropped.push(`${(w.pages ?? []).length - kept.length} link${(w.pages ?? []).length - kept.length === 1 ? '' : 's'} to pages that are gone`)
    w.pages = kept
  }
  if (w.kind === 'activity' && w.entities) {
    const kept = w.entities.filter(e => names.has(e))
    if (kept.length < w.entities.length) dropped.push('entities that are gone')
    if (kept.length) w.entities = kept
    else delete w.entities
  }
  return { widget: w, dropped }
}

export type PastedWidgets =
  | { widgets: FullstackWidgetDef[]; at: number; added: number; label: string; skipped: string[] }
  | { reason: string }

/**
 * `clip` pasted into dashboard `index` at `at` (default: the end): as many as fit under the cap,
 * each fitted to the layout. Returns the new widget list and the undo label, or why nothing went in.
 */
export function pasteWidgets(pages: FullstackPageDef[], index: number, clip: WidgetClip, entities: FullstackEntityDef[], at?: number): PastedWidgets {
  const page = pages[index]
  if (page?.type !== 'dashboard') return { reason: 'Widgets go on a dashboard — pick one, then paste' }
  const widgets = page.widgets ?? []
  const room = MAX_WIDGETS - widgets.length
  if (room <= 0) return { reason: `“${pageLabel(page)}” already has the most widgets a dashboard can have (${MAX_WIDGETS})` }
  const fitted: FullstackWidgetDef[] = []
  const skipped: string[] = []
  for (const w of clip.widgets) {
    const fit = fitWidget(w, pages, entities)
    if ('reason' in fit) skipped.push(`${widgetName(w)}: ${fit.reason}`)
    else if (fitted.length >= room) skipped.push(`${widgetName(w)}: no room under the ${MAX_WIDGETS}-widget cap`)
    else fitted.push(fit.widget)
  }
  if (fitted.length === 0) return { reason: `Nothing to paste — ${skipped.join('; ')}` }
  const where = at == null ? widgets.length : Math.max(0, Math.min(at, widgets.length))
  const next = [...widgets]
  next.splice(where, 0, ...fitted)
  const what = fitted.length === 1 ? `“${widgetName(fitted[0])}”` : `${fitted.length} widgets`
  return { widgets: next, at: where, added: fitted.length, label: `Pasted ${what} into “${pageLabel(page)}”`, skipped }
}
