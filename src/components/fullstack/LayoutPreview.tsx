import { Fragment, createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import type { ContentBlock, ContentRun } from './contentMarkdown'
import { highlights, previewPartOf, type EditTarget, type LayoutPreview as LayoutPreviewModel, type PreviewBar, type PreviewDataState, type PreviewScreen, type PreviewStateStrings, type PreviewTable, type PreviewWidget } from './layoutPreviewModel'
import { dropIndicatorClass, useDragReorder, type DragReorder } from './useDragReorder'
import type { PagePlayLinks } from './playLinks'
import { MAX_STEPS, MAX_TITLE } from './pageLayout'
import { cssEscape } from './focus'
import type { PartSlot } from './pageParts'

export type { EditTarget }

interface Props {
  preview: LayoutPreviewModel
  /** The page shown — follows the row opened in the editor, and the preview's own nav. */
  selected: number
  onSelect: (index: number) => void
  onEdit: (target: EditTarget) => void
  /** The editor part under the pointer (or keyboard focus): its counterpart here is ringed. */
  highlight?: EditTarget | null
  /** The frontend set's look: the default dark-sidebar shell, or the Menora Digital top bar. */
  skin: 'tailwind' | 'menora'
  /** Why the selected page is not in the nav, when it is not ("Tab only", "Opens from a row"). */
  offNavNote?: string
  /** A dashboard widget dragged to another slot of its page. Absent: no grips. */
  onReorderWidget?: (page: number, from: number, to: number) => void
  /** A dashboard widget given another width (1–4 columns). Absent: no handles. */
  onResizeWidget?: (page: number, index: number, span: number) => void
  /** More tools on a dashboard widget's hover bar: Duplicate and a kind switcher. Absent: none. */
  widgetTools?: WidgetTools
  /** The tailwind shell's navigation: the default sidebar, or a top bar. */
  navStyle?: 'sidebar' | 'topbar'
  /** Sidebar sections with a group name fold. */
  collapsibleGroups?: boolean
  /** The colour palette the generator will use. The tailwind shell and its accents follow it
   *  (the Menora set keeps its fixed brand tokens, as the generated app does). */
  palette?: PreviewPalette
  /** A widget being dragged in from the layout designer's library: the dashboard shows where it
   *  would land, and a drop adds it there (`at` = the index it takes). */
  widgetDrop?: WidgetDrop | null
  /** A page part being dragged in from the layout designer (a tab, a chart, a related list or
   *  number, a wizard field): the matching part of the selected page shows where it would land. */
  partDrop?: PartDrop | null
  /** A phone-width app: the menu as a top bar, dashboard widgets one per row. */
  narrow?: boolean
  /** Page index → control → message (`validation.byPage`): the parts with a problem are ringed in
   *  the error colour and name it. Absent: no rings. */
  problems?: Record<number, Record<string, string>>
  /** Play mode: the parts follow the generated app's links instead of opening their editor. */
  play?: PlayNavigation
  /** A title renamed in place (double-click or F2 on it): the page's own (`title`), a widget's
   *  (`widget.N.title`), a tab's (`tabs.N.title`), a step's (`steps.N.title`) or a record header
   *  number's (`headerStats.N.title`). Blank means back to the default. Absent: no renaming. */
  onRename?: (target: EditTarget, value: string) => void
  /** Draw the data parts with sample rows (default), or as the generated app does when there are
   *  no rows, while they load, or when the load failed. */
  dataState?: PreviewDataState
}

/** Play mode: where the parts of each page lead (`buildPlayLinks`), and how to go there. */
export interface PlayNavigation {
  links: PagePlayLinks[]
  go: (page: number) => void
  /** A click that opens no page (a drawer, a side pane): said rather than ignored. */
  note: (text: string) => void
}

const Play = createContext<PlayNavigation | undefined>(undefined)

/** What the data parts draw: sample rows, or the generated app's empty, loading or failed state. */
const DataState = createContext<PreviewDataState>('data')

/** The app's chrome words (its locale), for the chart pieces drawn without the model at hand. */
const Words = createContext<PreviewStateStrings | undefined>(undefined)

/** A data part outside the Data state: skeleton bars while loading, the generated "Couldn't load
 *  data. Try again" on a failure, and `empty` (the part's own empty text) with no rows. */
function StateNote({ states, empty, lines = 3 }: { states: PreviewStateStrings; empty: ReactNode; lines?: number }) {
  const state = useContext(DataState)
  if (state === 'loading') {
    return (
      <div className="mt-0.5 space-y-1" role="status" aria-label="Loading" data-preview-state="loading">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="h-1.5 animate-pulse rounded bg-surface-container-high" style={{ width: `${[92, 74, 84, 64][i % 4]}%` }} />
        ))}
      </div>
    )
  }
  if (state === 'error') {
    return (
      <p className="mt-0.5 text-[9px] text-error" data-preview-state="error">
        {states.couldNotLoad} <span className="font-semibold underline underline-offset-2">{states.retry}</span>
      </p>
    )
  }
  return <div className="mt-0.5 text-[9px] text-secondary" data-preview-state="empty">{empty}</div>
}

/** A title being renamed on the canvas: which one, its text when it started, and the part that
 *  opened it (focused again after Enter or Escape). */
interface RenameEdit { page: number; control: string; initial: string; owner: string }
interface RenameApi {
  editing: RenameEdit | null
  start: (edit: RenameEdit) => void
  /** `value` null: cancelled. `back`: return the focus to the part. */
  finish: (value: string | null, back: boolean) => void
}
const Rename = createContext<RenameApi | undefined>(undefined)

/** Starts renaming the title under the pointer inside `scope` (else its first): false when it
 *  holds none. */
function renameFrom(r: RenameApi, owner: string, scope: HTMLElement, x?: number, y?: number): boolean {
  const hit = x != null && y != null && typeof document.elementsFromPoint === 'function'
    ? document.elementsFromPoint(x, y).map(el => el.closest<HTMLElement>('[data-rename]')).find(el => el != null && scope.contains(el))
    : undefined
  const slot = hit ?? scope.querySelector<HTMLElement>('[data-rename]')
  if (!slot) return false
  r.start({ page: Number(slot.dataset.renamePage), control: slot.dataset.rename ?? '', initial: slot.dataset.renameValue ?? '', owner })
  return true
}

/** A title that can be renamed in place: its text, or the input while it is being renamed. */
function RenameSlot({ page, control, value, children }: { page: number; control: string; value: string; children: ReactNode }) {
  const r = useContext(Rename)
  if (!r) return <>{children}</>
  if (r.editing?.page === page && r.editing.control === control) return <RenameInput api={r} initial={r.editing.initial} />
  return <span data-rename={control} data-rename-page={page} data-rename-value={value}>{children}</span>
}

function RenameInput({ api, initial }: { api: RenameApi; initial: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useLayoutEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const finish = (value: string | null, back: boolean) => {
    if (done.current) return
    done.current = true
    api.finish(value, back)
  }
  return (
    <input
      ref={ref}
      type="text"
      defaultValue={initial}
      maxLength={MAX_TITLE}
      aria-label="Rename — Enter saves, Escape cancels, blank goes back to the default"
      onKeyDown={e => {
        e.stopPropagation()
        if (e.key === 'Enter') { e.preventDefault(); finish(e.currentTarget.value, true) }
        else if (e.key === 'Escape') { e.preventDefault(); finish(null, true) }
      }}
      onBlur={e => finish(e.currentTarget.value, false)}
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      className="w-full min-w-[5rem] rounded border border-primary bg-surface-container-lowest px-0.5 text-on-surface outline-none ring-2 ring-primary/30"
      style={{ font: 'inherit' }}
      data-preview-rename
    />
  )
}

/** What makes an element a link in Play mode: `props` to spread and `cls` to add to its class.
 *  Nothing outside Play, or with neither a target nor a note. */
function playLink(play: PlayNavigation | undefined, to: number | null | undefined, label: string, note?: string): {
  props: Record<string, unknown>
  cls: string
} {
  if (!play || (to == null && !note)) return { props: {}, cls: '' }
  const follow = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (to != null) play.go(to)
    else if (note) play.note(note)
  }
  return {
    props: {
      role: 'link',
      tabIndex: 0,
      title: label,
      'aria-label': label,
      onClick: follow,
      onKeyDown: (e: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        follow(e)
      },
      'data-play-link': to ?? 'note',
    },
    cls: 'cursor-pointer rounded-sm hover:outline hover:outline-1 hover:outline-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
  }
}

/** The layout's problems, read by every clickable part of the mock (see `Editable`). */
const Problems = createContext<Record<number, Record<string, string>> | undefined>(undefined)

/** The first problem message on the preview part drawn for `control` of `page`, if any. */
function problemOf(problems: Record<number, Record<string, string>> | undefined, page: number, control: string): string | undefined {
  const byControl = problems?.[page]
  if (!byControl) return undefined
  const part = previewPartOf(control)
  const key = Object.keys(byControl).find(k => previewPartOf(k) === part)
  return key == null ? undefined : byControl[key]
}

export interface PartDrop {
  slot: PartSlot
  /** `at`: the index the part takes — for a wizard field, the step it moves into. */
  onDrop: (page: number, at: number) => void
}

/** A part dragged over a screen: the slot it fits, where it would land, and the drop. */
interface PartTarget {
  slot: PartSlot
  at: number | null
  hover: (at: number | null) => void
  drop: (at: number) => void
}

/** Drop handlers for a part over one element; `at` reads where it lands from the event. */
function partDropProps(t: PartTarget, at: (e: DragEvent<HTMLElement>) => number) {
  return {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      e.preventDefault()
      e.stopPropagation()
      // A chip from the page strip is a move; a library card a copy.
      e.dataTransfer.dropEffect = e.dataTransfer.effectAllowed === 'move' ? 'move' : 'copy'
      const a = at(e)
      if (a !== t.at) t.hover(a)
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) t.hover(null) },
    onDrop: (e: DragEvent<HTMLElement>) => { e.preventDefault(); e.stopPropagation(); t.drop(at(e)) },
  }
}

/** Before item `index` or after it, by which half of it the pointer is over (`x`: reading order). */
function halfOf(index: number, axis: 'x' | 'y' = 'x') {
  return (e: DragEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    if (axis === 'y') return e.clientY < r.top + r.height / 2 ? index : index + 1
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
    return (e.clientX < r.left + r.width / 2) !== rtl ? index : index + 1
  }
}

/** Where a header number dropped on the four-column row lands: the column under the pointer,
 *  at most after the last tile. */
function statSlot(e: DragEvent<HTMLElement>, count: number): number {
  const r = e.currentTarget.getBoundingClientRect()
  if (r.width === 0) return count
  const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
  const x = rtl ? r.right - e.clientX : e.clientX - r.left
  return Math.max(0, Math.min(count, Math.round(x / (r.width / 4))))
}

/** The drop line on item `index` of `count`: before it, or after the last. */
function partIndicator(t: PartTarget | undefined, index: number, count: number): 'before' | 'after' | null {
  if (t?.at == null) return null
  return t.at === index ? 'before' : index === count - 1 && t.at === count ? 'after' : null
}

/** The slot at the end of a row of parts: "Drop to add a tab". */
function PartEndSlot({ target, at, label, className = '' }: { target: PartTarget; at: number; label: string; className?: string }) {
  return (
    <div
      {...partDropProps(target, () => at)}
      className={`flex items-center justify-center rounded border-2 border-dashed px-2 py-1 text-center text-[9px] ${
        target.at === at ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-secondary'} ${className}`}
      data-preview-part-drop={at}
    >
      {label}
    </div>
  )
}

/** The designer's extra widget tools (the inline editor passes none). */
export interface WidgetTools {
  duplicate: (page: number, index: number) => void
  /** Opens the designer's kind menu under `anchor` (the button pressed). */
  kindMenu: (page: number, index: number, anchor: HTMLElement) => void
}

export interface WidgetDrop {
  /** The default width of the widget being dragged — the end slot is drawn that wide. */
  span: number
  onDrop: (page: number, at: number) => void
}

/** The part of a colour palette the preview draws with. */
export interface PreviewPalette {
  primary: string
  secondary: string
}

const MENORA = { purple: '#684eed', yellow: '#ffc700', ink: '#37374e' }
/** The Menora table's header ground and its lavender value chip (tokens.css --surface-subtle / --lavender). */
const MENORA_HEAD = 'color-mix(in srgb, #684eed 6%, transparent)'
const MENORA_CHIP = { background: '#ede9fe', color: MENORA.ink }
const WIDGET_LIST = 'preview-widgets:'

/**
 * A wireframe of the generated frontend for the page layout being edited — the shell with its
 * nav, and the selected screen with sample data. Everything is drawn from `buildLayoutPreview`;
 * a click on a part of a screen asks the editor to open that page on the matching control.
 */
export function LayoutPreview({ preview, selected, onSelect, onEdit, highlight, skin, offNavNote, onReorderWidget, onResizeWidget, widgetTools, navStyle, collapsibleGroups, palette, widgetDrop, partDrop, narrow, problems, play, onRename, dataState = 'data' }: Props) {
  // The title being renamed in place, and the part to focus again once Enter or Escape ends it.
  const [renaming, setRenaming] = useState<RenameEdit | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const refocus = useRef<string | null>(null)
  useEffect(() => {
    if (renaming || !refocus.current) return
    const owner = refocus.current
    refocus.current = null
    rootRef.current?.querySelector<HTMLElement>(`[data-rename-owner="${cssEscape(owner)}"]`)?.focus()
  }, [renaming])
  const rename: RenameApi | undefined = onRename && !play ? {
    editing: renaming,
    start: setRenaming,
    finish: (value, back) => {
      const edit = renaming
      setRenaming(null)
      if (!edit) return
      if (back) refocus.current = edit.owner
      if (value != null && value.trim() !== edit.initial) onRename({ page: edit.page, control: edit.control }, value.trim())
    },
  } : undefined
  const screen = preview.screens[selected]
  const menora = skin === 'menora'
  // The generated tailwind shell: `--color-brand`/`--color-primary` = palette primary,
  // `--color-gold` = palette secondary, and `bg-app-shell`/`bg-app-bar` a brand → gold gradient.
  const brand = palette?.primary ?? 'var(--color-primary)'
  const gold = palette?.secondary ?? '#FEDB41'
  const accent = menora ? MENORA.purple : brand
  const shellBackground = (direction: string) => palette
    ? `linear-gradient(${direction}, ${brand} 0%, ${brand} 75%, ${gold} 100%)`
    : '#2B2F4C'
  // The tailwind shell's top bar lays the nav out like the Menora one, on the dark shell colour.
  const topbar = !menora && (navStyle === 'topbar' || Boolean(narrow))
  const horizontal = menora || topbar
  // One drag context for every dashboard drawn (a tab may embed another): the list key names the page.
  const dnd = useDragReorder((list, from, to) => onReorderWidget?.(Number(list.slice(WIDGET_LIST.length)), from, to))

  const navButton = (item: LayoutPreviewModel['nav'][number]) => {
    const active = item.index === selected
    // The page row itself hovered in the editor (no control under the pointer): its nav entry.
    const lit = highlight != null && highlight.page === item.index && highlight.control === undefined
    return (
      <button
        key={item.index}
        type="button"
        onClick={() => onSelect(item.index)}
        aria-current={active ? 'page' : undefined}
        data-preview-nav={item.index}
        data-preview-highlight={lit ? '' : undefined}
        title={item.start ? `${item.label} — ${preview.strings.startPage}` : item.label}
        className={`${menora
          ? `shrink-0 whitespace-nowrap border-b-2 px-1.5 py-1 text-[10px] font-semibold ${active ? 'border-[#684eed] text-[#684eed]' : 'border-transparent text-[#37374e]/70'}`
          : topbar
            ? `flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-1.5 py-1 text-[10px] ${active ? 'text-white' : 'border-transparent text-slate-200 hover:text-white'}`
            : `flex w-full items-center gap-1.5 rounded border-s-2 px-1.5 py-1 text-start text-[10px] ${active ? 'bg-white/15 text-white' : 'border-transparent text-slate-200 hover:bg-white/10'}`
        } ${lit ? 'ring-2 ring-inset ring-primary' : ''}`}
        style={!menora && active ? { borderColor: gold } : undefined}
      >
        {!menora && <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{item.icon}</span>}
        <span className="truncate">{item.label}</span>
        {item.start && (
          <span className="material-symbols-outlined ms-auto" style={{ fontSize: '10px', color: menora ? undefined : gold }} aria-label={preview.strings.startPage}>home</span>
        )}
        {item.roles.length > 0 && (
          <span className="material-symbols-outlined shrink-0 opacity-70" style={{ fontSize: '10px' }} title={`Only ${item.roles.join(' or ')}`} aria-label={`Only ${item.roles.join(' or ')}`} data-preview-lock>lock</span>
        )}
        {item.warning && (
          <span className={`${item.start ? '' : 'ms-auto '}h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400`} aria-label="Has a warning" data-preview-warning />
        )}
      </button>
    )
  }
  // Grouped like the generated nav: a labelled section in the sidebar, a caret item in the Menora
  // top bar (its menu is not drawn — the pages are listed after it, dimmed, instead).
  // "View as": the nav a signed-in user of that role gets (the generated shell hides the rest).
  const [viewAs, setViewAs] = useState<'' | 'USER' | 'ADMIN'>('')
  const guarded = preview.nav.some(item => item.roles.length > 0)
  const visible = (item: LayoutPreviewModel['nav'][number]) => !viewAs || item.roles.length === 0 || item.roles.includes(viewAs)
  const navItems = preview.sections.filter(section => section.items.some(visible)).map((section, i) => (
    <div key={i} className={horizontal ? 'flex shrink-0 items-center gap-1' : 'space-y-0.5'} data-preview-nav-group={section.group ?? ''}>
      {section.group && (
        menora ? (
          <span className="shrink-0 whitespace-nowrap px-1 text-[10px] font-semibold text-[#37374e]">
            {section.group}<span aria-hidden="true"> ▾</span>
          </span>
        ) : topbar ? (
          <span className="shrink-0 whitespace-nowrap px-1 text-[8px] font-semibold uppercase tracking-wider text-slate-500">{section.group}</span>
        ) : (
          <div className="px-1.5 pt-1 text-[8px] font-semibold uppercase tracking-wider text-slate-500">
            {collapsibleGroups && <span aria-hidden="true" data-preview-fold>▾ </span>}{section.group}
          </div>
        )
      )}
      {section.items.filter(visible).map(navButton)}
    </div>
  ))

  const body = (
    <div className="min-w-0 flex-1 overflow-hidden p-2.5 space-y-2" data-preview-screen={screen?.type}>
      {offNavNote && (
        <p className="rounded bg-surface-container px-2 py-1 text-[10px] text-secondary">{offNavNote}</p>
      )}
      {screen ? (
        <Screen screen={screen} page={selected} preview={preview} onEdit={onEdit} highlight={highlight} onSelect={onSelect} accent={accent} menora={menora} dnd={onReorderWidget ? dnd : undefined} onResizeWidget={narrow ? undefined : onResizeWidget} widgetTools={widgetTools} widgetDrop={widgetDrop} partDrop={partDrop} narrow={narrow} />
      ) : (
        <p className="text-[11px] text-secondary">Nothing to show.</p>
      )}
    </div>
  )

  return (
    <Play.Provider value={play}>
    <Problems.Provider value={problems}>
    <Rename.Provider value={rename}>
    <DataState.Provider value={dataState}>
    <Words.Provider value={preview.strings.states}>
    <div
      ref={rootRef}
      data-preview-data-state={dataState}
      dir={preview.rtl ? 'rtl' : 'ltr'}
      className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-sm"
      // The Menora set's face: Assistant (Almoni is licensed), self-hosted like the generated app's.
      style={menora ? { fontFamily: "'Assistant', Arial, sans-serif" } : undefined}
      data-layout-preview
    >
      {/* Window chrome, so the mock reads as "the app", not as part of the editor. */}
      <div className="flex items-center gap-1 border-b border-outline-variant bg-surface-container px-2 py-1" dir="ltr">
        <span className="h-1.5 w-1.5 rounded-full bg-error/60" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
        <span className="ms-2 truncate font-mono text-[9px] text-secondary">localhost:5173</span>
        {guarded && (
          <label className="ms-auto flex items-center gap-1 text-[9px] text-secondary">
            View as
            <select
              value={viewAs}
              onChange={e => setViewAs(e.target.value as '' | 'USER' | 'ADMIN')}
              className="rounded border border-outline-variant bg-surface-container-lowest px-0.5 text-[9px]"
              aria-label="View the preview as"
              data-preview-view-as
            >
              <option value="">Everyone (all pages)</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
        )}
      </div>
      {menora ? (
        <div className="flex min-h-[18rem] flex-col">
          <div className="flex items-center gap-2 border-b border-outline-variant bg-white px-2.5 py-1.5">
            <span className="shrink-0 rounded px-1 text-[10px] font-black" style={{ color: MENORA.purple }}>menora</span>
            <nav className="flex min-w-0 gap-1 overflow-x-auto" aria-label="Preview navigation">{navItems}</nav>
          </div>
          {body}
          <div className="h-3" style={{ background: MENORA.ink }} />
        </div>
      ) : topbar ? (
        <div className="flex min-h-[18rem] flex-col">
          <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ background: shellBackground('to right') }} data-preview-shell>
            {!palette && <span className="h-1 w-6 shrink-0 rounded-full" style={{ background: 'linear-gradient(90deg,#9A83F7,#FEDB41)' }} />}
            <nav className="flex min-w-0 gap-1 overflow-x-auto" aria-label="Preview navigation" data-preview-topbar>{navItems}</nav>
          </div>
          {body}
        </div>
      ) : (
        <div className="flex min-h-[18rem]">
          <nav
            className="w-28 shrink-0 space-y-0.5 p-1.5"
            style={{ background: shellBackground('to bottom') }}
            aria-label="Preview navigation"
            data-preview-shell
          >
            {!palette && <div className="mb-1.5 h-1 rounded-full" style={{ background: 'linear-gradient(90deg,#9A83F7,#FEDB41)' }} />}
            {navItems}
          </nav>
          {body}
        </div>
      )}
    </div>
    </Words.Provider>
    </DataState.Provider>
    </Rename.Provider>
    </Problems.Provider>
    </Play.Provider>
  )
}

// ── Screens ─────────────────────────────────────────────────────────────────

interface ScreenProps {
  screen: PreviewScreen
  page: number
  preview: LayoutPreviewModel
  onEdit: (target: EditTarget) => void
  highlight: EditTarget | null | undefined
  onSelect: (index: number) => void
  accent: string
  menora: boolean
  /** Inside a tabs page: no second heading. */
  embedded?: boolean
  dnd?: DragReorder
  onResizeWidget?: (page: number, index: number, span: number) => void
  widgetTools?: WidgetTools
  widgetDrop?: WidgetDrop | null
  partDrop?: PartDrop | null
  narrow?: boolean
}

function Screen({ screen, page, preview, onEdit, highlight, onSelect, accent, menora, embedded, dnd, onResizeWidget, widgetTools, widgetDrop, partDrop, narrow }: ScreenProps) {
  // Every part of this screen jumps to its editor control, and lights when that control is hovered.
  const link = { page, onEdit, highlight }
  // In Play mode, where this screen's parts lead instead.
  const play = useContext(Play)
  const here = play?.links[page]
  const state = useContext(DataState)
  const states = preview.strings.states
  // The dashboard grid, measured while a widget's edge is dragged to a new width.
  const gridRef = useRef<HTMLDivElement>(null)
  // A widget's edge being dragged: the grid shows its columns.
  const [resizing, setResizing] = useState(false)
  // A library widget hovering the grid: the index it would take.
  const [dropAt, setDropAt] = useState<number | null>(null)
  const newDrop = widgetDrop && screen.type === 'dashboard' && !embedded
    ? { at: dropAt, hover: setDropAt, drop: (at: number) => { setDropAt(null); widgetDrop.onDrop(page, at) } }
    : undefined
  // A page part hovering this screen: the index it would take.
  const [partAt, setPartAt] = useState<number | null>(null)
  const parts: PartTarget | undefined = partDrop && !embedded
    ? { slot: partDrop.slot, at: partAt, hover: setPartAt, drop: (at: number) => { setPartAt(null); partDrop.onDrop(page, at) } }
    : undefined
  const heading = !embedded && (
    <Editable {...link} control="title" label="Edit the page title" className="block text-start">
      <h3 className="text-[13px] font-bold text-on-surface">
        <RenameSlot page={page} control="title" value={screen.title}>{screen.title}</RenameSlot>
        {menora && <span style={{ color: MENORA.yellow }}>.</span>}
      </h3>
      {'description' in screen && screen.description && (
        <p className="text-[10px] text-secondary">{screen.description}</p>
      )}
    </Editable>
  )

  switch (screen.type) {
    case 'broken':
      return (
        <div className="space-y-1">
          {heading}
          <p className="rounded border border-error/40 bg-error/5 px-2 py-1.5 text-[10px] text-error">{screen.message}</p>
        </div>
      )
    case 'dashboard':
      return (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            {heading}
            <span className="flex shrink-0 items-center gap-1">
              {screen.period && (
                <Editable {...link} control="dateRange" label="Edit the period picker" className="shrink-0">
                  <span className="inline-flex items-center gap-0.5 rounded border border-outline-variant px-1 py-0.5 text-[9px] text-secondary" data-preview-period>
                    <span className="material-symbols-outlined" style={{ fontSize: '10px' }} aria-hidden="true">date_range</span>
                    {screen.period}
                  </span>
                </Editable>
              )}
              {screen.refresh && (
                <Editable {...link} control="refreshSeconds" label="Edit the auto-refresh" className="shrink-0">
                  <span className="inline-flex items-center gap-0.5 rounded border border-outline-variant px-1 py-0.5 text-[9px] text-secondary" data-preview-refresh>
                    <span className="material-symbols-outlined" style={{ fontSize: '10px' }} aria-hidden="true">refresh</span>
                    {screen.refresh.label}{screen.refresh.every && ` · ${screen.refresh.every}`}
                  </span>
                </Editable>
              )}
            </span>
          </div>
          {screen.filters.length > 0 && (
            <Editable {...link} control="filters" label="Edit the dashboard filters" className="block w-full">
              <div className="flex flex-wrap items-center gap-1" data-preview-dashboard-filters>
                <span className="inline-flex items-center gap-0.5 text-[9px] text-secondary">
                  <span className="material-symbols-outlined" style={{ fontSize: '10px' }} aria-hidden="true">filter_alt</span>
                  {preview.strings.filters}
                </span>
                {screen.filters.map((label, i) => (
                  <span key={`${i}:${label}`} className="inline-flex items-center gap-0.5 rounded border border-outline-variant px-1 py-0.5 text-[9px] text-secondary">
                    {label}
                    <span className="material-symbols-outlined" style={{ fontSize: '10px' }} aria-hidden="true">expand_more</span>
                  </span>
                ))}
              </div>
            </Editable>
          )}
          <div ref={gridRef} className={`relative grid ${narrow ? 'grid-cols-1' : 'grid-cols-4'} gap-1.5`} data-preview-widget-grid>
            {!narrow && (resizing || screen.widgets.some(w => dnd?.isDragging(`${WIDGET_LIST}${page}`, w.index))) && (
              <div className="pointer-events-none absolute inset-0 grid grid-cols-4 gap-1.5" aria-hidden="true" data-preview-grid-guides>
                {SPAN.map(c => <div key={c} className="rounded border border-dashed border-primary/40 bg-primary/5" />)}
              </div>
            )}
            {screen.widgets.map(w => (
              <Widget
                key={w.index}
                widget={w}
                accent={accent}
                viewAll={preview.strings.viewAll}
                preview={preview}
                menora={menora}
                dnd={dnd}
                list={`${WIDGET_LIST}${page}`}
                gridRef={gridRef}
                onResize={onResizeWidget ? span => onResizeWidget(page, w.index, span) : undefined}
                onResizing={setResizing}
                onDuplicate={widgetTools ? () => widgetTools.duplicate(page, w.index) : undefined}
                onKindMenu={widgetTools ? anchor => widgetTools.kindMenu(page, w.index, anchor) : undefined}
                newDrop={newDrop}
                last={w.index === screen.widgets.length - 1}
                narrow={narrow}
                {...link}
              />
            ))}
            {newDrop && (
              <div
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (dropAt !== screen.widgets.length) setDropAt(screen.widgets.length) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(null) }}
                onDrop={e => { e.preventDefault(); newDrop.drop(screen.widgets.length) }}
                className={`${narrow ? 'col-span-1' : SPAN[(widgetDrop?.span ?? 2) - 1] ?? 'col-span-2'} flex min-h-12 items-center justify-center rounded border-2 border-dashed px-2 text-center text-[10px] ${
                  dropAt === screen.widgets.length ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-secondary'}`}
                data-preview-drop-end
              >
                Drop here to add it at the end
              </div>
            )}
          </div>
          {screen.widgets.length === 0 && !newDrop && (
            <Editable {...link} control="widgets" label="Add a widget" className="block w-full">
              <p className="rounded border border-dashed border-outline-variant px-2 py-3 text-center text-[10px] text-secondary">No widgets yet — click to add one</p>
            </Editable>
          )}
        </div>
      )
    case 'entity-list':
      return (
        <div className="space-y-2">
          {heading}
          <MiniTable table={screen.table} preview={preview} accent={accent} menora={menora} link={link} rowTo={here?.row} rowNote={here?.rowNote} newTo={here?.create} />
        </div>
      )
    case 'tabs':
      return <TabsScreen screen={screen} page={page} preview={preview} onEdit={onEdit} highlight={highlight} onSelect={onSelect} accent={accent} menora={menora} heading={heading} dnd={dnd} onResizeWidget={onResizeWidget} widgetTools={widgetTools} parts={parts?.slot === 'tab' ? parts : undefined} />
    case 'master-detail':
      return (
        <div className="space-y-2">
          {heading}
          <div className="flex gap-1.5">
            <Editable {...link} control="parent" label="Edit the parent entity" className="w-[34%] shrink-0">
              <div className="rounded border border-outline-variant p-1">
                <p className="px-1 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-secondary">{screen.parentTitle}</p>
                {state !== 'data' && <div className="px-1"><StateNote states={states} empty={states.noRecordsYet} /></div>}
                {state === 'data' && screen.parentItems.map((item, i) => (
                  <p
                    key={i}
                    className={`truncate rounded px-1 py-0.5 text-[10px] ${i === 0 ? 'font-semibold text-white' : 'text-on-surface'}`}
                    style={i === 0 ? { background: accent } : undefined}
                  >
                    {item}
                  </p>
                ))}
              </div>
            </Editable>
            <div className="min-w-0 flex-1 space-y-1">
              {screen.parentDetails && state === 'data' && (
                <Editable {...link} control="showParent" label="Edit the parent card" className="block w-full">
                  <div className="rounded border border-outline-variant px-1.5 py-1 text-[8px]" data-preview-parent-card>
                    <p className="mb-0.5 text-[9px] font-semibold text-on-surface">{screen.parentItems[0]}</p>
                    {screen.parentDetails.map(item => (
                      <p key={item.label} className="truncate"><span className="text-secondary">{item.label}:</span> <span className="text-on-surface">{item.value}</span></p>
                    ))}
                  </div>
                </Editable>
              )}
              <Editable {...link} control="child" label="Edit the child entity" className="block w-full">
                <MiniTable table={screen.child} preview={preview} accent={accent} menora={menora} compact rowTo={here?.childRows[0]} newTo={here?.create} />
              </Editable>
            </div>
          </div>
        </div>
      )
    case 'record':
      return <RecordScreen screen={screen} link={link} preview={preview} accent={accent} menora={menora} parts={parts} />
    case 'inbox':
      return <InboxScreen screen={screen} link={link} heading={heading} accent={accent} menora={menora} />
    case 'form':
      return <FormScreen screen={screen} link={link} heading={heading} accent={accent} menora={menora} />
    case 'wizard':
      return <WizardScreen screen={screen} link={link} heading={heading} accent={accent} menora={menora} parts={parts?.slot === 'step-field' ? parts : undefined} />
    case 'report': {
      const charts = parts?.slot === 'chart' ? parts : undefined
      const chartCount = 1 + screen.moreCharts.length
      return (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            {heading}
            {screen.exportLabel && <FakeButton outline>{screen.exportLabel}</FakeButton>}
          </div>
          <FilterRow filters={screen.filters} chips={screen.presetChips} label={preview.strings.filters} />
          <div {...(charts ? partDropProps(charts, halfOf(0, 'y')) : {})} className={charts ? `rounded ${dropIndicatorClass(partIndicator(charts, 0, chartCount))}` : undefined}>
            <Editable {...link} control="chart.groupBy" label="Edit the chart" className="block w-full">
              <div {...playLink(play, here?.drill, `Open the ${screen.chartTitle} rows`).props} className={`rounded border border-outline-variant p-2 ${playLink(play, here?.drill, '').cls}`}>
                <p className="mb-1 text-[10px] font-semibold text-on-surface">{screen.chartTitle}</p>
                {state === 'data'
                  ? <ReportChartShape kind={screen.chart.kind} line={screen.chart.line} bars={screen.chart.bars} accent={accent} />
                  : <StateNote states={states} empty={states.noRecordsYet} />}
              </div>
            </Editable>
          </div>
          {screen.chartTable && state === 'data' && <TotalsTable bars={screen.chart.bars} group={screen.groupLabel} value={screen.valueLabel} total={screen.totalLabel} />}
          {screen.moreCharts.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {screen.moreCharts.map((c, ci) => (
                <div key={ci} {...(charts ? partDropProps(charts, halfOf(ci + 1)) : {})} className={`min-w-0 rounded ${dropIndicatorClass(partIndicator(charts, ci + 1, chartCount), 'x')}`}>
                  <Editable {...link} control={`chart${ci + 2}.groupBy`} label={`Edit chart ${ci + 2}`} className="block min-w-0">
                    <div className="rounded border border-outline-variant p-1.5" data-preview-chart={ci + 1}>
                      <p className="mb-1 truncate text-[9px] font-semibold text-on-surface">{c.title}</p>
                      {state === 'data'
                        ? <ReportChartShape kind={c.kind} line={c.line} bars={c.line ? c.bars : c.bars.slice(0, 4)} accent={accent} />
                        : <StateNote states={states} empty={states.noRecordsYet} lines={2} />}
                      {c.table && state === 'data' && <TotalsTable bars={c.bars} value={screen.valueLabel} total={screen.totalLabel} />}
                    </div>
                  </Editable>
                </div>
              ))}
            </div>
          )}
          {charts && <PartEndSlot target={charts} at={chartCount} label="Drop here to add a chart" className="min-h-10" />}
        </div>
      )
    }
    case 'calendar':
      return (
        <div className="space-y-2" data-preview-calendar>
          <div className="flex items-start justify-between gap-2">
            {heading}
            {screen.modes.length > 1 && (
              <Editable {...link} control="modes" label="Edit the calendar views" className="shrink-0">
                <span className="inline-flex overflow-hidden rounded border border-outline-variant text-[9px]">
                  {screen.modes.map((m, i) => (
                    <span key={m} className="px-1.5 py-0.5" style={i === 0 ? { background: accent, color: 'white' } : undefined}>{m}</span>
                  ))}
                </span>
              </Editable>
            )}
          </div>
          <Editable {...link} control="dateField" label="Edit the date rows are placed by" className="block w-full">
            <div className="grid grid-cols-7 overflow-hidden rounded border border-outline-variant">
              {screen.days.map((d, i) => (
                <div key={i} className="min-h-9 border-b border-e border-outline-variant/60 p-0.5">
                  <span className="block text-end text-[8px] text-secondary">{d.day}</span>
                  {state === 'data' && d.events.slice(0, 2).map((ev, j) => {
                    const go = playLink(play, here?.row, `Open ${ev}`, here?.rowNote)
                    return <span key={j} {...go.props} className={`mt-0.5 block truncate rounded px-0.5 text-[8px] ${go.cls}`} style={{ background: `color-mix(in srgb, ${accent} 13%, transparent)`, color: accent }}>{ev}</span>
                  })}
                </div>
              ))}
            </div>
          </Editable>
          {state !== 'data' && <StateNote states={states} empty={states.nothingScheduled} lines={2} />}
          {screen.creates && <p className="text-[9px] text-secondary">Click a day to add a row on it</p>}
        </div>
      )
    case 'board':
      return (
        <div className="space-y-2" data-preview-board>
          {heading}
          <Editable {...link} control="lanes" label="Edit the lanes" className="block w-full">
            <div className="flex gap-1.5 overflow-x-auto">
              {screen.lanes.map((lane, i) => {
                const over = lane.limit != null && lane.count > lane.limit
                return (
                  <div key={i} className="w-28 shrink-0 space-y-1 rounded border border-outline-variant bg-surface-container-low p-1">
                    <div className="flex items-center justify-between gap-1 text-[9px] font-semibold text-on-surface">
                      <span className="truncate">{lane.label}</span>
                      <span className={`tabular-nums ${over && state === 'data' ? 'text-error' : 'text-secondary'}`}>
                        {state === 'data' ? (lane.limit != null ? `${lane.count}/${lane.limit}` : lane.count) : state === 'empty' ? (lane.limit != null ? `0/${lane.limit}` : 0) : '…'}
                      </span>
                    </div>
                    {state === 'empty' && <p className="px-0.5 text-[8px] text-secondary" data-preview-state="empty">{states.emptyLane}</p>}
                    {state === 'data' && lane.cards.map((card, j) => {
                      const go = playLink(play, here?.row, `Open ${card.heading}`, here?.rowNote)
                      return (
                        <div key={j} {...go.props} className={`rounded border border-outline-variant bg-surface p-1 ${go.cls}`}>
                          <p className="truncate text-[9px] font-semibold text-on-surface">{card.heading}</p>
                          {card.details.map((d, k) => <p key={k} className="truncate text-[8px] text-secondary">{d}</p>)}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </Editable>
          {(state === 'loading' || state === 'error') && <StateNote states={states} empty={null} lines={2} />}
        </div>
      )
    case 'content':
      return (
        <div className="space-y-2" data-preview-content>
          {heading}
          <Editable {...link} control="body" label="Edit the text" className="block w-full text-start">
            <div className="space-y-1.5 rounded border border-outline-variant p-2">
              {screen.blocks.length === 0 && <p className="text-[10px] text-secondary">No text yet</p>}
              {screen.blocks.map((b, i) => <ContentBlockView key={i} block={b} accent={accent} page={page} />)}
            </div>
          </Editable>
        </div>
      )
    case 'import':
      return (
        <div className="space-y-2" data-preview-import>
          {heading}
          <Editable {...link} control="entity" label="Edit the imported entity" className="block w-full">
            <div className="space-y-1.5 rounded border border-outline-variant p-2">
              <div className="flex gap-1 text-[9px]">
                {screen.steps.map((step, i) => `${i + 1} · ${step}`).map((s, i) => (
                  <span key={s} className="rounded-full px-1.5 py-0.5" style={i === 0 ? { background: accent, color: 'white' } : { background: 'var(--color-surface-container-high, #eee)' }}>{s}</span>
                ))}
              </div>
              <div className="rounded border-2 border-dashed border-outline-variant px-2 py-3 text-center text-[10px] text-secondary">
                {screen.drop}
              </div>
              <p className="text-[9px] text-secondary">
                {screen.columnsLabel}: {screen.fields.map(f => f.label + (f.required ? '*' : '')).join(', ')}
              </p>
            </div>
          </Editable>
        </div>
      )
    case 'search':
      return (
        <div className="space-y-2" data-preview-search>
          {heading}
          <div className="rounded-full border border-outline-variant px-2 py-1 text-[10px] text-secondary">{screen.words}</div>
          <Editable {...link} control="entities" label="Edit the searched entities" className="block w-full">
            <div className="space-y-1">
              {state !== 'data' && <StateNote states={states} empty={states.nothingMatches.replace('{q}', screen.words)} />}
              {state === 'data' && screen.groups.map((g, i) => (
                <div key={i} className="rounded border border-outline-variant">
                  <p className="border-b border-outline-variant px-1.5 py-0.5 text-[9px] font-semibold text-on-surface">
                    {g.title} <span className="font-normal text-secondary">{g.total}</span>
                  </p>
                  {g.rows.map((r, j) => {
                    const go = playLink(play, here?.groups[i], `Open ${r}`)
                    return <p key={j} {...go.props} className={`truncate px-1.5 py-0.5 text-[9px] text-on-surface ${go.cls}`}>{r}</p>
                  })}
                </div>
              ))}
            </div>
          </Editable>
          {screen.header && <p className="text-[9px] text-secondary">Also opened from the search box in the app’s header</p>}
        </div>
      )
  }
}

/** One block of a content page, drawn from the same parse the generator makes. */
function ContentBlockView({ block, accent, page }: { block: ContentBlock; accent: string; page: number }) {
  const play = useContext(Play)
  const runs = (items: ContentRun[]) => items.map((r, i) => {
    switch (r.kind) {
      case 'bold': return <strong key={i}>{r.text}</strong>
      case 'em': return <em key={i}>{r.text}</em>
      case 'code': return <code key={i} className="rounded bg-surface-container-high px-0.5">{r.text}</code>
      case 'page-link': {
        const go = playLink(play, play?.links[page]?.pageIds.get(r.target ?? ''), `Open ${r.text}`)
        return <span key={i} {...go.props} className={`font-semibold underline ${go.cls}`} style={{ color: accent }}>{r.text}</span>
      }
      case 'link': return <span key={i} className="font-semibold underline" style={{ color: accent }}>{r.text}</span>
      default: return <span key={i}>{r.text}</span>
    }
  })
  switch (block.kind) {
    case 'heading': return <p className={`font-bold text-on-surface ${block.level === 1 ? 'text-[12px]' : 'text-[11px]'}`}>{runs(block.items[0] ?? [])}</p>
    case 'paragraph': return <p className="text-[10px] text-on-surface">{runs(block.items[0] ?? [])}</p>
    case 'callout': return <p className="border-s-2 ps-1.5 text-[10px] text-on-surface" style={{ borderColor: accent }}>{runs(block.items[0] ?? [])}</p>
    case 'rule': return <hr className="border-outline-variant" />
    default: {
      const List = block.kind === 'bullets' ? 'ul' : 'ol'
      return (
        <List className={`${block.kind === 'bullets' ? 'list-disc' : 'list-decimal'} ps-4 text-[10px] text-on-surface`}>
          {block.items.map((item, i) => <li key={i}>{runs(item)}</li>)}
        </List>
      )
    }
  }
}

function TabsScreen({ screen, page, preview, onEdit, highlight, onSelect, accent, menora, heading, dnd, onResizeWidget, widgetTools, parts }:
  Omit<ScreenProps, 'screen'> & { screen: Extract<PreviewScreen, { type: 'tabs' }>; heading: ReactNode; parts?: PartTarget }) {
  const [active, setActive] = useState(0)
  const rename = useContext(Rename)
  const current = Math.min(active, Math.max(screen.tabs.length - 1, 0))
  const target = screen.tabs[current]?.target
  const embedded = target != null ? preview.screens[target] : undefined
  return (
    <div className="space-y-2">
      {heading}
      {screen.tabs.length === 0 ? (
        parts ? <PartEndSlot target={parts} at={0} label="Drop a page here to make it a tab" className="py-3" /> : (
          <Editable page={page} onEdit={onEdit} highlight={highlight} control="tabs" label="Add tabs" className="block w-full">
            <p className="rounded border border-dashed border-outline-variant px-2 py-3 text-center text-[10px] text-secondary">No tabs yet</p>
          </Editable>
        )
      ) : (
        <div className="flex items-end gap-2">
        <div role="tablist" className="flex min-w-0 flex-1 gap-3 border-b border-outline-variant">
          {screen.tabs.map((tab, i) => {
            // The tab's card hovered in the editor rings the tab, like an Editable would.
            const lit = highlights(highlight, { page, control: `tab.${i}` })
            const line = partIndicator(parts, i, screen.tabs.length)
            const owner = `${page}:tabs.${i}.title`
            const slot = <RenameSlot page={page} control={`tabs.${i}.title`} value={tab.label}>{tab.label}</RenameSlot>
            if (rename?.editing?.owner === owner) return <span key={i} className="-mb-px pb-1 text-[10px] font-semibold">{slot}</span>
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === current}
                onClick={() => setActive(i)}
                onDoubleClick={rename ? e => renameFrom(rename, owner, e.currentTarget) : undefined}
                onKeyDown={rename ? e => { if (e.key === 'F2') { e.preventDefault(); renameFrom(rename, owner, e.currentTarget) } } : undefined}
                title={rename ? 'Double-click to rename' : undefined}
                data-rename-owner={rename ? owner : undefined}
                {...(parts ? partDropProps(parts, halfOf(i)) : {})}
                data-preview-highlight={lit ? '' : undefined}
                className={`-mb-px border-b-2 pb-1 text-[10px] font-semibold ${i === current ? '' : 'border-transparent text-secondary'} ${lit ? HIGHLIGHT : ''} ${line ? `px-1 ${dropIndicatorClass(line, 'x')}` : ''}`}
                style={i === current ? { borderBottomColor: accent, color: accent } : undefined}
              >
                {slot}
              </button>
            )
          })}
        </div>
        {parts && <PartEndSlot target={parts} at={screen.tabs.length} label="Drop to add a tab" className="shrink-0" />}
        </div>
      )}
      {embedded && target != null && embedded.type !== 'tabs' && (
        <Screen screen={embedded} page={target} preview={preview} onEdit={onEdit} highlight={highlight} onSelect={onSelect} accent={accent} menora={menora} dnd={dnd} onResizeWidget={onResizeWidget} widgetTools={widgetTools} embedded />
      )}
      {screen.tabs.length > 0 && target == null && (
        <p className="text-[10px] text-error">This tab points at no page.</p>
      )}
    </div>
  )
}

/** A record page: its tabs switch between the details and each related list. */
/** A report chart's grouped totals: the first few groups, then the total. */
function TotalsTable({ bars, group, value, total }: { bars: PreviewBar[]; group?: string; value: string; total: string }) {
  return (
    <table className="mt-1 w-full text-[10px]" data-preview-totals>
      <thead>
        <tr className="text-secondary">
          <th className="text-start font-semibold">{group ?? ''}</th>
          <th className="text-end font-semibold">{value}</th>
        </tr>
      </thead>
      <tbody>
        {bars.slice(0, 4).map((b, i) => (
          <tr key={i} className="border-t border-outline-variant/60">
            <td className="truncate text-on-surface">{b.label}</td>
            <td className="text-end tabular-nums text-on-surface">{b.value}</td>
          </tr>
        ))}
        <tr className="border-t border-outline-variant font-semibold">
          <td className="text-on-surface">{total}</td>
          <td className="text-end tabular-nums text-on-surface">{bars.reduce((s, b) => s + b.value, 0)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function RecordScreen({ screen, link, preview, accent, menora, parts }: {
  screen: Extract<PreviewScreen, { type: 'record' }>
  link: LinkProps
  preview: LayoutPreviewModel
  accent: string
  menora: boolean
  parts?: PartTarget
}) {
  const [active, setActive] = useState(0)
  const current = Math.min(active, screen.tabs.length - 1)
  const tabTable = current > 0 ? screen.tabTables[current - 1] : undefined
  const play = useContext(Play)
  const here = play?.links[link.page]
  const back = playLink(play, here?.back, 'Back')
  // Loading or failed, the record is not there yet: only its heading shows above the state.
  const state = useContext(DataState)
  const held = state === 'loading' || state === 'error'
  const tabParts = parts?.slot === 'child-tab' ? parts : undefined
  const statParts = parts?.slot === 'header-stat' ? parts : undefined
  // The related tabs come after the details tab: tab i is related list i - 1.
  const childCount = screen.tabs.length - 1
  return (
    <div className="space-y-2">
      {screen.back && <p {...back.props} className={`w-fit text-[10px] text-secondary ${back.cls}`}>{preview.rtl ? '→' : '←'} {screen.back}</p>}
      <Editable {...link} control="entity" label="Edit the record entity" className="block text-start">
        <h3 className="text-[13px] font-bold text-on-surface">{screen.heading}</h3>
      </Editable>
      {held ? <StateNote states={preview.strings.states} empty={null} lines={4} /> : (<>
      {screen.stats.length > 0 && (
        <div {...(statParts ? partDropProps(statParts, e => statSlot(e, screen.stats.length)) : {})}>
        <Editable {...link} control="headerStats" label="Edit the header numbers" className="block w-full">
          <div className="grid grid-cols-4 gap-1.5" data-preview-stats>
            {screen.stats.map((s, i) => (
              <div key={i} className={`min-w-0 rounded border border-outline-variant p-1 ${dropIndicatorClass(partIndicator(statParts, i, screen.stats.length), 'x')}`}>
                <p className="truncate text-[8px] text-secondary">
                  <RenameSlot page={link.page} control={`headerStats.${i}.title`} value={s.title}>{s.title}</RenameSlot>
                </p>
                <p className="text-[12px] font-bold tabular-nums text-on-surface" data-preview-state={state === 'empty' ? 'empty' : undefined}>{state === 'empty' ? '0' : s.value}</p>
              </div>
            ))}
          </div>
        </Editable>
        </div>
      )}
      {statParts && <PartEndSlot target={statParts} at={screen.stats.length} label="Drop here to add a number above the tabs" />}
      <div className="flex items-end gap-1">
        <div role="tablist" className="flex min-w-0 flex-1 gap-3 border-b border-outline-variant" data-preview-record-tabs>
          {screen.tabs.map((label, i) => {
            // The details tab drops in front of the first related list; a related tab before or after itself.
            const line = i === 0 ? (childCount === 0 && tabParts?.at === 0 ? 'after' : null) : partIndicator(tabParts, i - 1, childCount)
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === current}
                onClick={() => setActive(i)}
                {...(tabParts ? partDropProps(tabParts, i === 0 ? () => 0 : halfOf(i - 1)) : {})}
                className={`-mb-px truncate border-b-2 pb-1 text-[10px] font-semibold ${i === current ? '' : 'border-transparent text-secondary'} ${line ? `px-1 ${dropIndicatorClass(line, 'x')}` : ''}`}
                style={i === current ? { borderBottomColor: accent, color: accent } : undefined}
              >
                {label}
              </button>
            )
          })}
        </div>
        {tabParts && <PartEndSlot target={tabParts} at={childCount} label="Drop to add a tab" className="shrink-0" />}
        <Editable {...link} control="childTabs" label="Edit the related tabs" className="shrink-0 px-1 text-secondary">
          <span className="material-symbols-outlined" style={{ fontSize: '12px' }} aria-hidden="true">edit</span>
        </Editable>
      </div>
      {current === 0 ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded border border-outline-variant p-2">
          {screen.details.map((d, i) => (
            <Fragment key={i}>
              {d.section && <p className="col-span-2 mt-0.5 text-[9px] font-semibold text-on-surface first:mt-0" data-preview-section>{d.section}</p>}
              <div className="min-w-0">
                <dt className="truncate text-[9px] uppercase tracking-wide text-secondary">{d.label}</dt>
                <dd className="truncate text-[10px] text-on-surface">{d.value}</dd>
              </div>
            </Fragment>
          ))}
        </dl>
      ) : tabTable ? (
        <div data-preview-record-tab={current}>
          <MiniTable table={tabTable} preview={preview} accent={accent} menora={menora} rowTo={here?.childRows[current - 1]} />
        </div>
      ) : (
        <p className="text-[10px] text-error">This tab lists no entity.</p>
      )}
      </>)}
    </div>
  )
}

/** An inbox: its queue tabs over the tasks, each with its status, assignee, due date and moves. */
function InboxScreen({ screen, link, heading, accent, menora }: {
  screen: Extract<PreviewScreen, { type: 'inbox' }>
  link: LinkProps
  heading: ReactNode
  accent: string
  menora: boolean
}) {
  const [queue, setQueue] = useState(0)
  // In Play mode a row opens where the generated inbox opens it: its record page, else a quick look.
  const play = useContext(Play)
  const rowTo = play?.links[link.page]?.row
  return (
    <div className="space-y-2">
      {heading}
      <div className="flex gap-2 border-b border-outline-variant text-[9px]" role="tablist" data-preview-queues>
        {screen.queues.map((q, i) => (
          <button key={q} type="button" role="tab" aria-selected={i === queue} onClick={() => setQueue(i)}
                  className="-mb-px border-b-2 px-1 py-0.5 font-semibold"
                  style={i === queue ? { borderColor: accent, color: accent } : { borderColor: 'transparent' }}>
            {q}
          </button>
        ))}
      </div>
      <table className="w-full text-[9px]" data-preview-inbox>
        <thead>
          <tr className="text-start text-secondary" style={menora ? { background: MENORA_HEAD } : undefined}>
            {screen.columns.map(c => <th key={c} className="px-1 py-0.5 text-start font-semibold">{c}</th>)}
            <th className="px-1 py-0.5" />
          </tr>
        </thead>
        <tbody>
          {screen.rows.map((r, i) => (
            <tr key={i} className="border-t border-outline-variant"
                onClick={() => (rowTo != null ? play?.go(rowTo) : play?.note('A row opens in a quick look — add a record page to open a page'))}
                data-play-link={play ? rowTo ?? 'note' : undefined}>
              {r.cells.map((c, j) => <td key={j} className={`truncate px-1 py-0.5 ${j === 0 ? 'font-semibold text-on-surface' : 'text-secondary'}`}>{c}</td>)}
              <td className="px-1 py-0.5"><span className="rounded-full px-1" style={menora ? MENORA_CHIP : { background: `${accent}1a`, color: accent }}>{r.status}</span></td>
              <td className="px-1 py-0.5 text-secondary">{r.assignee}</td>
              {r.due != null && <td className={`px-1 py-0.5 tabular-nums ${r.late ? 'font-semibold text-error' : 'text-secondary'}`} data-preview-late={r.late || undefined}>{r.due}</td>}
              <td className="px-1 py-0.5 text-end">
                {screen.actions.map(a => <span key={a} className="ms-0.5 inline-block rounded border border-outline-variant px-1 text-[8px]">{a}</span>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A form page: the entity's whole form, in its sections, with Cancel and Save. */
function FormScreen({ screen, link, heading, accent, menora }: {
  screen: Extract<PreviewScreen, { type: 'form' }>
  link: LinkProps
  heading: ReactNode
  accent: string
  menora: boolean
}) {
  const primary = menora ? { background: MENORA.yellow, color: MENORA.ink } : { background: accent, color: 'white' }
  // In Play mode Save lands where the generated form does: the row's page, else its list.
  const play = useContext(Play)
  const saveTo = play?.links[link.page]?.afterSave
  return (
    <div className="space-y-2">
      {heading}
      <div className="space-y-2 rounded border border-outline-variant p-2" data-preview-form>
        {screen.groups.map((g, gi) => (
          <fieldset key={gi} className="space-y-1">
            {g.title && <legend className="text-[9px] font-semibold text-on-surface">{g.title}</legend>}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              {g.fields.map(label => (
                <div key={label}>
                  <p className="text-[9px] text-secondary">{label}</p>
                  <div className="h-3 rounded border border-outline-variant bg-surface-container-lowest" />
                </div>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="flex justify-end gap-1 pt-1">
          <FakeButton outline>{screen.cancel}</FakeButton>
          <button
            type="button"
            onClick={() => (saveTo != null ? play?.go(saveTo) : play?.note('Save starts the form over — there is no record or list page to land on'))}
            disabled={!play}
            aria-label={screen.save}
            data-play-link={play ? saveTo ?? 'note' : undefined}
          >
            <FakeButton style={primary}>{screen.save}</FakeButton>
          </button>
        </div>
      </div>
    </div>
  )
}

/** A wizard: its steps can be walked through, ending on the review. */
function WizardScreen({ screen, link, heading, accent, menora, parts }: {
  screen: Extract<PreviewScreen, { type: 'wizard' }>
  link: LinkProps
  heading: ReactNode
  accent: string
  menora: boolean
  /** A field dragged in: each step takes it, and so does a new step after the last. */
  parts?: PartTarget
}) {
  const [active, setActive] = useState(0)
  const last = screen.steps.length - 1
  const step = Math.min(active, last)
  const reviewing = step === last
  const primary = menora ? { background: MENORA.yellow, color: MENORA.ink } : { background: accent, color: 'white' }
  // In Play mode Save lands where the generated wizard does: the new row's page, else its list.
  const play = useContext(Play)
  const saveTo = play?.links[link.page]?.afterSave
  // A field dropped on a step (or a new one) moves there, and the canvas shows that step.
  const into = parts ? { ...parts, drop: (at: number) => { parts.drop(at); setActive(at) } } : undefined
  const rename = useContext(Rename)
  return (
    <div className="space-y-2">
      {heading}
      <div className="flex items-start gap-1">
        <ol className="flex min-w-0 flex-1 flex-wrap gap-1" data-preview-steps>
          {screen.steps.map((s, i) => {
            // The review is not a step a field can go to, nor one to rename.
            const target = into && i < last ? into : undefined
            const owner = `${link.page}:steps.${i}.title`
            const renames = rename && i < last ? rename : undefined
            const label = i < last ? <RenameSlot page={link.page} control={`steps.${i}.title`} value={s}>{s}</RenameSlot> : s
            if (renames?.editing?.owner === owner) {
              return <li key={i} className="rounded-full border px-1.5 py-0.5 text-[9px] font-semibold">{i + 1} {label}</li>
            }
            return (
              <li key={i}>
                <button
                  type="button"
                  aria-current={i === step ? 'step' : undefined}
                  onClick={() => setActive(i)}
                  onDoubleClick={renames ? e => renameFrom(renames, owner, e.currentTarget) : undefined}
                  onKeyDown={renames ? e => { if (e.key === 'F2') { e.preventDefault(); renameFrom(renames, owner, e.currentTarget) } } : undefined}
                  title={renames ? 'Double-click to rename' : undefined}
                  data-rename-owner={renames ? owner : undefined}
                  {...(target ? partDropProps(target, () => i) : {})}
                  className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${target?.at === i ? 'border-primary bg-primary/10 ring-2 ring-primary/40' : ''}`}
                  style={i === step ? { borderColor: accent, color: accent } : undefined}
                  data-preview-step-drop={target ? i : undefined}
                >
                  {i + 1} {label}
                </button>
              </li>
            )
          })}
          {into && last < MAX_STEPS && (
            <li><PartEndSlot target={into} at={last} label="New step" className="rounded-full py-0.5" /></li>
          )}
        </ol>
        <Editable {...link} control="steps" label="Edit the steps" className="shrink-0 px-1 text-secondary">
          <span className="material-symbols-outlined" style={{ fontSize: '12px' }} aria-hidden="true">edit</span>
        </Editable>
      </div>
      <div className="space-y-1 rounded border border-outline-variant p-2" data-preview-step={reviewing ? 'review' : step}>
        {reviewing ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            {screen.review.map((r, i) => (
              <div key={i} className="min-w-0">
                <dt className="truncate text-[9px] text-secondary">{r.label}</dt>
                <dd className="truncate text-[10px] text-on-surface">{r.value}</dd>
              </div>
            ))}
          </dl>
        ) : (screen.stepFields[step] ?? []).map(label => (
          <div key={label}>
            <p className="text-[9px] text-secondary">{label}</p>
            <div className="h-3 rounded border border-outline-variant bg-surface-container-lowest" />
          </div>
        ))}
        <div className="flex justify-between pt-1">
          <button type="button" onClick={() => setActive(Math.max(0, step - 1))} disabled={step === 0} className="disabled:opacity-40" aria-label="Previous step">
            <FakeButton outline>{screen.back}</FakeButton>
          </button>
          <button
            type="button"
            onClick={() => (reviewing ? (saveTo != null ? play?.go(saveTo) : play?.note('Save starts a fresh wizard — there is no record or list page to land on')) : setActive(Math.min(last, step + 1)))}
            disabled={reviewing && !play}
            aria-label={reviewing ? screen.save : 'Next step'}
            data-play-link={reviewing && play ? saveTo ?? 'note' : undefined}
          >
            <FakeButton style={primary}>{reviewing ? screen.save : screen.next}</FakeButton>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/** The ring on the part whose editor control is hovered (a literal, so Tailwind keeps it). */
const HIGHLIGHT = 'outline outline-2 outline-primary ring-4 ring-primary/15'
/** The ring on a part with a problem. */
const PROBLEM = 'outline outline-2 outline-dashed outline-error/80'

interface LinkProps {
  page: number
  onEdit: (target: EditTarget) => void
  /** The editor part under the pointer, if any. */
  highlight: EditTarget | null | undefined
}

/** A part of the mock that jumps to its control in the editor, and is ringed while that control
 *  is hovered or focused there. The part is drawn as it is (tables, lists…) with a transparent
 *  button laid over it — a button may not hold block content, and a screen reader then hears the
 *  label, not the sample data. */
function Editable({ page, control, onEdit, highlight, label, className, children }: LinkProps & { control: string; label: string; className?: string; children: ReactNode }) {
  const target = { page, control }
  const lit = highlights(highlight, target)
  const problem = problemOf(useContext(Problems), page, control)
  const rename = useContext(Rename)
  const owner = useId()
  const ref = useRef<HTMLDivElement>(null)
  // Play mode: the part is the app's own, its links are live; nothing opens an editor.
  if (useContext(Play)) return <div className={`relative rounded ${className ?? ''}`}>{children}</div>
  // A title inside is being renamed: the part is drawn live, with its input, and nothing over it.
  if (rename?.editing?.owner === owner) return <div className={`relative rounded ${HIGHLIGHT} ${className ?? ''}`}>{children}</div>
  return (
    <div
      ref={ref}
      className={`relative rounded ${lit ? HIGHLIGHT : problem ? PROBLEM : ''} ${className ?? ''}`}
      data-preview-highlight={lit ? '' : undefined}
      data-preview-problem={problem ? '' : undefined}
    >
      <div aria-hidden="true">{children}</div>
      {problem && (
        <span className="pointer-events-none absolute -end-1 -top-1 z-[1] h-2 w-2 rounded-full bg-error ring-2 ring-surface-container-lowest" aria-hidden="true" />
      )}
      <button
        type="button"
        onClick={() => onEdit(target)}
        onDoubleClick={rename ? e => { if (ref.current) renameFrom(rename, owner, ref.current, e.clientX, e.clientY) } : undefined}
        onKeyDown={rename ? e => {
          if (e.key !== 'F2' || !ref.current) return
          if (renameFrom(rename, owner, ref.current)) e.preventDefault()
        } : undefined}
        data-rename-owner={owner}
        title={problem ? `${label} — ${problem}` : label}
        aria-label={problem ? `${label} (problem: ${problem})` : label}
        className="absolute inset-0 h-full w-full cursor-pointer rounded outline-offset-2 hover:outline hover:outline-1 hover:outline-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      />
    </div>
  )
}

/** Literal classes, so Tailwind's scanner keeps them. */
const SPAN = ['col-span-1', 'col-span-2', 'col-span-3', 'col-span-4']

const MAX_SPAN = SPAN.length
/** The widgets whose whole card drills into the rows behind it. */
const DRILLS = new Set<PreviewWidget['kind']>(['kpi', 'progress', 'bar', 'donut', 'stacked', 'pivot', 'line', 'top'])
/** The widgets that read rows, and so have an empty, loading and failed state of their own (a list
 *  widget's table draws its own). */
const STATEFUL = new Set<PreviewWidget['kind']>(['kpi', 'progress', 'top', 'bar', 'donut', 'stacked', 'pivot', 'activity', 'line', 'recent'])

/** A data widget outside the Data state: an empty count reads 0, a progress bar 0 of its target. */
function WidgetState({ widget, states }: { widget: PreviewWidget; states: PreviewStateStrings }) {
  const state = useContext(DataState)
  if (state === 'empty' && widget.kind === 'kpi') return <p className="text-[15px] font-bold tabular-nums text-on-surface" data-preview-state="empty">0</p>
  if (state === 'empty' && widget.kind === 'progress') {
    return (
      <div data-preview-state="empty">
        <p className="text-[13px] font-bold tabular-nums text-on-surface">0 <span className="text-[9px] font-normal text-secondary">/ {widget.target}</span></p>
        <div className="mt-0.5 h-1 rounded-full bg-surface-container" />
      </div>
    )
  }
  return <StateNote states={states} empty={widget.kind === 'activity' ? states.noActivity : states.noRecordsYet} />
}

const TOOL = 'rounded px-1 text-[10px] font-semibold leading-4 text-secondary hover:bg-primary/10 hover:text-primary disabled:opacity-30'

function Widget({ widget, accent, viewAll, preview, menora, dnd, list, gridRef, onResize, onResizing, onDuplicate, onKindMenu, newDrop, last, narrow, ...link }: LinkProps & {
  widget: PreviewWidget
  accent: string
  viewAll: string
  preview: LayoutPreviewModel
  menora: boolean
  /** Drag-to-reorder over the dashboard's widgets, when the editor takes reorders. */
  dnd?: DragReorder
  list: string
  gridRef: RefObject<HTMLDivElement | null>
  /** Sets the widget's width (1–4 columns), when the editor takes resizes. */
  onResize?: (span: number) => void
  /** Told when an edge drag starts and ends, so the grid can show its columns. */
  onResizing?: (on: boolean) => void
  onDuplicate?: () => void
  onKindMenu?: (anchor: HTMLElement) => void
  /** A library widget being dragged over the dashboard: where it would land, and the drop. */
  newDrop?: { at: number | null; hover: (at: number | null) => void; drop: (at: number) => void }
  last?: boolean
  narrow?: boolean
}) {
  // While the end edge is dragged the card follows the pointer; the width is committed on release.
  const [liveSpan, setLiveSpan] = useState<number | null>(null)
  const state = useContext(DataState)
  const play = useContext(Play)
  const goes = play?.links[link.page]?.widgets[widget.index]
  // A chart, number or ranked list drills into its rows; lists, notes and link tiles link part by part.
  const card = DRILLS.has(widget.kind) ? playLink(play, goes?.open, `Open the rows behind ${widget.title}`) : { props: {}, cls: '' }
  const span = liveSpan ?? widget.span
  const indicator = newDrop
    ? (newDrop.at === widget.index ? 'before' : last && newDrop.at === widget.index + 1 ? 'after' : null)
    : dnd?.indicatorFor(list, widget.index) ?? null
  // Before or after this widget, by which half of it the pointer is over (the grid flows along the line).
  const dropIndex = (e: DragEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const firstHalf = e.clientX < rect.left + rect.width / 2
    return firstHalf !== Boolean(preview.rtl) ? widget.index : widget.index + 1
  }
  const newDropProps = newDrop ? {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      const at = dropIndex(e)
      if (at !== newDrop.at) newDrop.hover(at)
    },
    onDrop: (e: DragEvent<HTMLElement>) => { e.preventDefault(); newDrop.drop(dropIndex(e)) },
  } : undefined
  const dragging = dnd?.isDragging(list, widget.index) ?? false
  // The grid flows along the line, so a reorder lands before or after by the pointer's side
  // (on a phone the single column flows down).
  const axis = narrow ? 'y' : 'x'

  const spanAt = (clientX: number): number | null => {
    const grid = gridRef.current?.getBoundingClientRect()
    if (!grid || grid.width === 0) return null
    const x = preview.rtl ? grid.right - clientX : clientX - grid.left
    return Math.min(MAX_SPAN, Math.max(1, Math.ceil(x / (grid.width / MAX_SPAN))))
  }
  const startResize = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setLiveSpan(widget.span)
    onResizing?.(true)
  }
  const moveResize = (e: ReactPointerEvent<HTMLElement>) => {
    if (liveSpan == null) return
    const next = spanAt(e.clientX)
    if (next != null && next !== liveSpan) setLiveSpan(next)
  }
  const endResize = () => {
    if (liveSpan != null && liveSpan !== widget.span) onResize?.(liveSpan)
    setLiveSpan(null)
    onResizing?.(false)
  }
  return (
    <div
      {...(newDropProps ?? (dnd ? dnd.rowProps(list, widget.index, axis) : {}))}
      className={`group relative ${narrow ? 'col-span-1' : SPAN[span - 1] ?? 'col-span-1'} min-w-0 ${dragging ? 'opacity-40' : ''} ${newDrop ? `rounded border-2 border-transparent ${dropIndicatorClass(indicator, 'x')}` : dropIndicatorClass(indicator, axis)}`}
      data-preview-widget-slot={widget.index}
    >
    <Editable {...link} control={`widget.${widget.index}`} label={`Edit widget ${widget.index + 1}`} className="block h-full w-full min-w-0 text-start">
      <div
        {...card.props}
        className={`h-full rounded border p-1.5 ${widget.kind === 'broken' ? 'border-error/50 bg-error/5' : 'border-outline-variant bg-surface-container-lowest'} ${card.cls}`}
        data-preview-widget={widget.index}
      >
        <p className="truncate text-[9px] font-semibold text-secondary">
          <RenameSlot page={link.page} control={`widget.${widget.index}.title`} value={widget.title}>{widget.title}</RenameSlot>
        </p>
        {widget.filters.length > 0 && (
          <p className="truncate text-[8px] text-secondary" data-preview-widget-filter>{widget.filters.join(' · ')}</p>
        )}
        {state !== 'data' && STATEFUL.has(widget.kind) ? <WidgetState widget={widget} states={preview.strings.states} /> : (<>
        {widget.kind === 'kpi' && <p className="text-[15px] font-bold tabular-nums text-on-surface">{widget.value}</p>}
        {widget.kind === 'kpi' && widget.delta && (
          <p className={`text-[8px] font-semibold ${widget.delta.startsWith('▲') ? 'text-emerald-600' : 'text-error'}`} data-preview-delta>{widget.delta}</p>
        )}
        {widget.kind === 'kpi' && widget.trend && <Sparkline values={widget.trend} accent={accent} />}
        {widget.kind === 'progress' && (
          <>
            <p className="text-[13px] font-bold tabular-nums text-on-surface">
              {widget.value} <span className="text-[9px] font-normal text-secondary">/ {widget.target}</span>
            </p>
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-surface-container" data-preview-progress>
              <div className="h-full rounded-full" style={{ width: `${Math.min(widget.percent, 100)}%`, background: accent }} />
            </div>
          </>
        )}
        {widget.kind === 'top' && (
          <ol className="mt-0.5 space-y-0.5">
            {widget.rows.slice(0, 4).map((r, i) => (
              <li key={i} className="flex justify-between gap-1 text-[10px] text-on-surface">
                <span className="truncate"><span className="text-secondary">{i + 1}.</span> {r.label}</span>
                <span className="tabular-nums">{r.value}</span>
              </li>
            ))}
          </ol>
        )}
        {widget.kind === 'bar' && <Bars bars={widget.bars.slice(0, 4)} accent={accent} />}
        {widget.kind === 'donut' && <Donut bars={widget.bars} accent={accent} />}
        {widget.kind === 'stacked' && (
          <div className="mt-0.5 space-y-0.5" data-preview-stacked>
            {widget.rows.slice(0, 4).map(row => {
              const max = Math.max(1, ...widget.rows.map(r => r.parts.reduce((a, b) => a + b, 0)))
              return (
                <div key={row.label} className="flex items-center gap-1">
                  <span className="w-12 shrink-0 truncate text-[9px] text-secondary">{row.label}</span>
                  <span className="flex h-1.5 flex-1 overflow-hidden rounded-full">
                    {row.parts.map((v, i) => (
                      <span key={i} style={{ width: `${(v / max) * 100}%`, background: accent, opacity: 1 - (i % 4) * 0.22 }} />
                    ))}
                  </span>
                </div>
              )
            })}
            <p className="truncate text-[8px] text-secondary">{widget.series.join(' · ')}</p>
          </div>
        )}
        {widget.kind === 'pivot' && (
          <table className="mt-0.5 w-full text-[8px]" data-preview-pivot>
            <thead>
              <tr className="text-secondary">
                <th />
                {widget.columns.map(c => <th key={c} className="truncate px-0.5 text-end font-normal">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {widget.rows.map(row => (
                <tr key={row.label} className="border-t border-outline-variant/60">
                  <th className="truncate pe-1 text-start font-normal text-secondary">{row.label}</th>
                  {row.cells.map((v, i) => <td key={i} className="px-0.5 text-end tabular-nums text-on-surface">{Math.round(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {widget.kind === 'activity' && (
          <ul className="mt-0.5 space-y-0.5" data-preview-activity>
            {widget.rows.map((row, i) => (
              <li key={i} className="flex items-center justify-between gap-1 text-[9px]">
                <span className="min-w-0 truncate"><span style={{ color: accent }}>{row.label}</span><span className="text-secondary"> · {row.what}</span></span>
                <span className="shrink-0 text-[8px] text-secondary">{row.ago}</span>
              </li>
            ))}
            {widget.rows.length === 0 && <li className="text-[9px] text-secondary">No audited entity</li>}
          </ul>
        )}
        {widget.kind === 'text' && (
          <div className="mt-0.5 space-y-0.5" data-preview-text>
            {widget.paragraphs.slice(0, 3).map((p, i) => <p key={i} className="line-clamp-2 text-[9px] text-on-surface">{p}</p>)}
            {widget.paragraphs.length === 0 && <p className="text-[9px] text-secondary">Empty note</p>}
          </div>
        )}
        {widget.kind === 'links' && (
          <div className="mt-0.5 grid grid-cols-3 gap-1" data-preview-links>
            {widget.tiles.slice(0, 6).map((tile, i) => {
              const go = playLink(play, goes?.tiles[i], `Open ${tile.label}`)
              return menora ? (
                <span key={i} {...go.props} className={`flex min-w-0 flex-col items-center gap-0.5 px-1 py-1 text-[8px] text-on-surface ${go.cls}`} data-preview-action-disc>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: MENORA.yellow, color: MENORA.ink }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{tile.icon}</span>
                  </span>
                  <span className="w-full truncate text-center">{tile.label}</span>
                </span>
              ) : (
                <span key={i} {...go.props} className={`flex min-w-0 flex-col items-center gap-0.5 rounded border border-outline-variant px-1 py-1 text-[8px] text-on-surface ${go.cls}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '12px', color: accent }}>{tile.icon}</span>
                  <span className="w-full truncate text-center">{tile.label}</span>
                </span>
              )
            })}
            {widget.tiles.length === 0 && <span className="col-span-3 text-[9px] text-secondary">No pages picked</span>}
          </div>
        )}
        {widget.kind === 'list' && (
          <div className="mt-0.5" data-preview-list>
            <MiniTable table={widget.table} preview={preview} accent={accent} menora={menora} compact rowTo={goes?.rows} rowNote="Rows open in a quick-look drawer" />
          </div>
        )}
        {widget.kind === 'line' && <LineChart points={widget.points} accent={accent} />}
        {widget.kind === 'recent' && (
          <ul className="mt-0.5 space-y-0.5">
            <li className="truncate text-[8px] text-secondary" data-preview-newest>{widget.by}</li>
            {widget.rows.slice(0, 4).map((r, i) => {
              const go = playLink(play, goes?.rows, `Open ${r}`, 'Rows open in a quick-look drawer')
              return <li key={i} {...go.props} className={`truncate text-[10px] text-on-surface ${go.cls}`}>{r}</li>
            })}
            <li {...playLink(play, goes?.open, viewAll).props} className={`w-fit text-[9px] font-semibold ${playLink(play, goes?.open, viewAll).cls}`} style={{ color: accent }}>{viewAll}</li>
          </ul>
        )}
        </>)}
        {widget.kind === 'broken' && <p className="text-[10px] text-error">{widget.message}</p>}
      </div>
    </Editable>
    {liveSpan != null && (
      <span className="pointer-events-none absolute start-1 top-1 rounded bg-primary px-1 text-[9px] font-semibold text-on-primary" data-preview-span-badge>
        {span} / {MAX_SPAN}
      </span>
    )}
    {(dnd || onResize || onDuplicate || onKindMenu) && (
      <span
        className="absolute end-1 top-1 flex items-center gap-0.5 rounded bg-surface-container-lowest/90 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
        data-preview-widget-tools
      >
        {dnd && (
          <span
            {...dnd.handleProps(list, widget.index)}
            role="button"
            tabIndex={-1}
            aria-label={`Drag widget ${widget.index + 1}`}
            title="Drag to reorder"
            className="cursor-grab text-secondary"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>drag_indicator</span>
          </span>
        )}
        {onResize && (
          <>
            <button type="button" onClick={() => onResize(widget.span - 1)} disabled={widget.span <= 1} aria-label={`Narrower: widget ${widget.index + 1}`} title="Narrower" className={TOOL}>−</button>
            <button type="button" onClick={() => onResize(widget.span + 1)} disabled={widget.span >= MAX_SPAN} aria-label={`Wider: widget ${widget.index + 1}`} title="Wider" className={TOOL}>+</button>
          </>
        )}
        {onDuplicate && (
          <button type="button" onClick={onDuplicate} aria-label={`Duplicate widget ${widget.index + 1}`} title="Duplicate (Ctrl+D)" className={TOOL} data-preview-widget-duplicate>
            <span className="material-symbols-outlined align-middle" style={{ fontSize: '11px' }}>content_copy</span>
          </button>
        )}
        {onKindMenu && (
          <button
            type="button"
            onClick={e => onKindMenu(e.currentTarget)}
            aria-haspopup="menu"
            aria-label={`Change the kind of widget ${widget.index + 1}`}
            title="Change the kind"
            className={TOOL}
            data-preview-widget-kind
          >
            <span className="material-symbols-outlined align-middle" style={{ fontSize: '11px' }}>swap_horiz</span>
          </button>
        )}
      </span>
    )}
    {onResize && (
      <span
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        className="absolute inset-y-1 end-0 w-1.5 cursor-ew-resize rounded opacity-0 hover:bg-primary/40 group-hover:opacity-100"
        title="Drag to resize"
        aria-hidden="true"
        data-preview-widget-resize
      />
    )}
    </div>
  )
}

/** A small ring of shares, shaded from the accent. */
/** A report chart as its kind draws it: a ring, a (filled) line, bars — or nothing over its table. */
function ReportChartShape({ kind, line, bars, accent }: { kind?: string; line: boolean; bars: PreviewBar[]; accent: string }) {
  if (kind === 'table') return null
  if (kind === 'donut') return <Donut bars={bars} accent={accent} />
  return line ? <LineChart points={bars} accent={accent} /> : <Bars bars={bars} accent={accent} />
}

function Donut({ bars, accent }: { bars: PreviewBar[]; accent: string }) {
  const total = bars.reduce((a, b) => a + b.value, 0) || 1
  const c = 2 * Math.PI * 14
  let offset = 0
  return (
    <div className="mt-0.5 flex items-center gap-1.5" data-preview-donut>
      <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx={18} cy={18} r={14} fill="none" strokeWidth={6} className="stroke-surface-container" />
        {bars.map((b, i) => {
          const length = (b.value / total) * c
          const arc = (
            <circle key={b.label} cx={18} cy={18} r={14} fill="none" strokeWidth={6} stroke={accent}
              strokeOpacity={1 - (i % 5) * 0.18} strokeDasharray={`${length} ${c - length}`} strokeDashoffset={-offset} />
          )
          offset += length
          return arc
        })}
      </svg>
      <ul className="min-w-0 space-y-0.5">
        {bars.slice(0, 3).map(b => <li key={b.label} className="truncate text-[9px] text-secondary">{b.label}</li>)}
      </ul>
    </div>
  )
}

function Bars({ bars, accent }: { bars: PreviewBar[]; accent: string }) {
  const words = useContext(Words)
  const max = Math.max(1, ...bars.map(b => b.value))
  return (
    <div className="mt-0.5 space-y-0.5">
      {bars.map(b => (
        <div key={b.label} className="flex items-center gap-1">
          <span className="w-12 shrink-0 truncate text-[9px] text-secondary">{b.label}</span>
          <span className="h-1.5 rounded-full" style={{ width: `${Math.max(4, (b.value / max) * 100)}%`, background: accent, opacity: 0.85 }} />
        </div>
      ))}
      {bars.length === 0 && <p className="text-[9px] text-secondary">{words?.noRecordsYet ?? 'No records yet.'}</p>}
    </div>
  )
}

/** A kpi's trend: a bare line under the number, like the generated tile's. */
function Sparkline({ values, accent }: { values: number[]; accent: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const points = values.map((v, i) => `${((i / (values.length - 1)) * 100).toFixed(1)},${(18 - ((v - min) / span) * 16).toFixed(1)}`).join(' ')
  return (
    <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="mt-0.5 h-4 w-full" aria-hidden="true" style={{ direction: 'ltr' }} data-preview-sparkline>
      <polyline points={points} fill="none" stroke={accent} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function LineChart({ points, accent }: { points: PreviewBar[]; accent: string }) {
  const words = useContext(Words)
  if (points.length < 2) return <p className="text-[9px] text-secondary">{words?.noRecordsYet ?? 'No records yet.'}</p>
  const max = Math.max(...points.map(p => p.value))
  const min = Math.min(...points.map(p => p.value))
  const span = max - min || 1
  const xy = points.map((p, i) => [(i / (points.length - 1)) * 100, 36 - ((p.value - min) / span) * 30] as const)
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <div className="mt-0.5">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-10 w-full" aria-hidden="true" style={{ direction: 'ltr' }}>
        <path d={`${d} L100,40 L0,40 Z`} fill={accent} opacity={0.12} />
        <path d={d} fill="none" stroke={accent} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[8px] text-secondary" dir="ltr">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  )
}

function FilterRow({ filters, chips, label }: { filters: string[]; chips: string[]; label: string }) {
  if (filters.length === 0 && chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      {filters.length > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded border border-outline-variant px-1 py-0.5 text-[9px] text-secondary">
          <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>filter_alt</span>
          {label}
        </span>
      )}
      {chips.map(c => (
        <span key={c} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary" data-preview-chip>{c}</span>
      ))}
    </div>
  )
}

function FakeButton({ children, outline, style }: { children: ReactNode; outline?: boolean; style?: React.CSSProperties }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${outline ? 'border border-outline-variant text-secondary' : ''}`}
      style={style}
    >
      {children}
    </span>
  )
}

/** A list outside the Data state, as the generated list draws it: skeleton rows while loading,
 *  the server's error with Try again above an empty list, and the empty state with its New
 *  action (outlined in the Menora set — the New pill is the view's one yellow). */
function ListState({ table, states, primary, menora, compact }: {
  table: PreviewTable
  states: PreviewStateStrings
  primary: React.CSSProperties
  menora: boolean
  compact?: boolean
}) {
  const state = useContext(DataState)
  if (state === 'loading') return <StateNote states={states} empty={null} lines={compact ? 2 : 3} />
  if (state === 'error') {
    return (
      <p className="rounded border border-error/40 bg-error/5 px-1.5 py-1 text-[9px] text-error" data-preview-state="error">
        {states.errorServer} <span className="font-semibold underline underline-offset-2">{states.retry}</span>
      </p>
    )
  }
  return (
    <div className="rounded border border-dashed border-outline-variant px-2 py-2 text-center" data-preview-state="empty">
      <p className="text-[10px] font-semibold text-on-surface">{states.noRecordsTitle}</p>
      {!compact && <p className="text-[9px] text-secondary">{states.noRecordsHint}</p>}
      {table.newLabel && (
        <span className="mt-1 inline-flex">
          {menora ? <FakeButton outline>{table.newLabel}</FakeButton> : <FakeButton style={primary}>{table.newLabel}</FakeButton>}
        </span>
      )}
    </div>
  )
}

function MiniTable({ table, preview, accent, menora, compact, link, rowTo, rowNote, newTo }: {
  table: PreviewTable
  preview: LayoutPreviewModel
  accent: string
  menora: boolean
  compact?: boolean
  /** Play mode: the page a row opens (its record page), else why it opens none. */
  rowTo?: number | null
  rowNote?: string
  /** Play mode: the page New opens (the entity's wizard); else New opens the form drawer. */
  newTo?: number | null
  /** A list page's own table: the column headings, the sort and the side pane jump to their own
   *  controls, the rows to the entity. Without it the table is drawn as one inert block. */
  link?: LinkProps
}) {
  const primary = menora ? { background: MENORA.yellow, color: MENORA.ink } : { background: accent, color: 'white' }
  const part = (control: string, label: string, children: ReactNode, className = 'block w-full') =>
    link ? <Editable {...link} control={control} label={label} className={className}>{children}</Editable> : children
  const play = useContext(Play)
  const rowLink = (row: string[]) => playLink(play, rowTo, `Open ${row[0] ?? 'the row'}`, rowNote)
  const create = playLink(play, newTo, table.newLabel ?? 'New', 'New opens the form in a drawer')
  const state = useContext(DataState)
  const sidePane = state === 'data' ? table.sidePane : null
  return (
    <div className="space-y-1 text-start">
      <div className="flex items-center gap-1">
        {compact && <span className="truncate text-[10px] font-semibold text-on-surface">{table.title}</span>}
        {table.showSearch && (
          <span className="min-w-0 flex-1 truncate rounded border border-outline-variant px-1.5 py-0.5 text-[9px] text-secondary">
            {preview.strings.search}
          </span>
        )}
        {!table.showSearch && <span className="flex-1" />}
        {table.hasExport && <FakeButton outline>{preview.strings.export}</FakeButton>}
        {table.newLabel && <span {...create.props} className={`inline-flex rounded-full ${create.cls}`}><FakeButton style={primary}>{table.newLabel}</FakeButton></span>}
      </div>
      {link ? (
        <div className="flex flex-wrap items-center gap-1">
          <FilterRow filters={table.filters} chips={table.presetChips} label={preview.strings.filters} />
          {part('sort', 'Edit the sort', (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary" data-preview-chip data-preview-sort>
              {table.sort ?? '⇅'}
            </span>
          ), 'inline-flex')}
        </div>
      ) : (
        <FilterRow filters={table.filters} chips={[...table.presetChips, ...(table.sort ? [table.sort] : [])]} label={preview.strings.filters} />
      )}
      <div className={sidePane ? 'grid grid-cols-[minmax(0,1fr)_6rem] gap-1' : ''}>
      <div className="min-w-0 space-y-0.5">
      {link && table.view !== 'cards' && table.view !== 'kanban' && table.view !== 'calendar' && part('columns', 'Edit the columns', (
        <div
          className={`grid gap-x-1 text-start text-[9px] font-semibold text-secondary ${menora ? 'rounded-t px-0.5 py-0.5' : ''}`}
          style={{ gridTemplateColumns: `repeat(${Math.max(1, table.columns.length)}, minmax(0, 1fr))`, ...(menora ? { background: MENORA_HEAD } : {}) }}
          data-preview-columns
        >
          {table.columns.map((c, j) => <span key={c} className={`truncate ${menora && table.kinds[j] === 'number' ? 'text-end' : ''}`}>{c}</span>)}
        </div>
      ))}
      {part('entity', 'Edit the listed entity', (
      <>
      {state !== 'data' ? (
        <ListState table={table} states={preview.strings.states} primary={primary} menora={menora} compact={compact} />
      ) : table.view === 'cards' ? (
        <div className="grid grid-cols-3 gap-1" data-preview-view="cards">
          {table.rows.map((row, i) => (
            <div key={i} {...rowLink(row).props} className={`rounded border border-outline-variant/60 px-1.5 py-1 text-[9px] ${rowLink(row).cls}`}>
              <p className="truncate font-semibold text-on-surface">{row[0]}</p>
              {row.slice(1, 3).map((cell, j) => (
                <p key={j} className="truncate text-secondary"><span className="text-secondary/70">{table.columns[j + 1]}:</span> {cell}</p>
              ))}
            </div>
          ))}
        </div>
      ) : table.view === 'kanban' ? (
        <div className="grid gap-1 text-[9px]" style={{ gridTemplateColumns: `repeat(${Math.max(1, table.lanes.length)}, minmax(0, 1fr))` }} data-preview-view="kanban">
          {table.lanes.map((lane, li) => (
            <div key={lane} className="rounded bg-surface-container px-1 py-1">
              <p className="mb-1 truncate font-semibold text-secondary">{lane}</p>
              {table.rows.filter((_, i) => (table.rowLanes.length ? table.rowLanes[i] === li : i % table.lanes.length === li)).map((row, i) => (
                <div key={i} {...rowLink(row).props} className={`mb-1 truncate rounded border border-outline-variant/60 bg-surface-container-lowest px-1 py-0.5 text-on-surface ${rowLink(row).cls}`}>{row[0]}</div>
              ))}
            </div>
          ))}
        </div>
      ) : table.view === 'calendar' ? (
        <div className="grid grid-cols-7 gap-px rounded border border-outline-variant/60 bg-outline-variant/40 text-[8px]" data-preview-view="calendar">
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="min-h-[1.6rem] bg-surface-container-lowest p-0.5">
              <span className="text-secondary/70">{i + 1}</span>
              {i % 5 === 2 && <div className="mt-0.5 truncate rounded-sm px-0.5 text-[7px] font-semibold" style={primary}>{table.rows[(i / 5) | 0]?.[0]}</div>}
            </div>
          ))}
        </div>
      ) : (
        <table className="w-full table-fixed text-[9px]">
          {!link && (
            <thead>
              <tr className="text-secondary" style={menora ? { background: MENORA_HEAD } : undefined}>
                {table.columns.map((c, j) => <th key={c} className={`truncate pb-0.5 font-semibold ${menora && table.kinds[j] === 'number' ? 'text-end' : 'text-start'}`}>{c}</th>)}
              </tr>
            </thead>
          )}
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} {...rowLink(row).props} className={`border-t border-outline-variant/60 ${table.sidePane && i === 0 ? 'bg-primary/5' : ''} ${rowLink(row).cls}`}>
                {row.map((cell, j) => (
                  <td key={j} className={`truncate py-0.5 text-on-surface ${menora && table.kinds[j] === 'number' ? 'text-end tabular-nums' : ''}`}>
                    {menora && table.kinds[j] === 'enum' && cell !== '—'
                      ? <span className="rounded-full px-1.5 py-px font-semibold" style={MENORA_CHIP} data-preview-chip-cell>{cell}</span>
                      : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </>
      ))}
      </div>
      {sidePane && part('detail', 'Edit where rows open', (
        <aside className="rounded border border-outline-variant px-1.5 py-1 text-start text-[8px]" data-preview-side-pane>
          {sidePane.map(item => (
            <p key={item.label} className="truncate"><span className="text-secondary">{item.label}:</span> <span className="text-on-surface">{item.value}</span></p>
          ))}
        </aside>
      ))}
      </div>
      {!compact && part('pageSize', 'Edit rows per page and where rows open', (
        <p className="truncate text-end text-[8px] text-secondary" data-preview-footer>{table.footer}</p>
      ))}
    </div>
  )
}
