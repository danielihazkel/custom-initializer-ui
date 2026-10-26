import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import type { FullstackPageDef } from '../../../types'
import { inputClass } from '../controls'
import { MAX_PAGES, PAGE_TYPE_META, canDuplicate, inNav, pageLabel, type PageLayoutValidation } from '../pageLayout'
import { dropIndicatorClass } from '../useDragReorder'
import type { PagesModel } from '../pages/usePagesModel'
import { DesignerMenu, type MenuItem } from './DesignerMenu'

/** The pages to find a page among: its label, route, entity, type or group. */
export function pageMatches(page: FullstackPageDef, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [pageLabel(page), page.id, page.title, page.entity, page.parent, page.child, page.group, PAGE_TYPE_META[page.type]?.label]
    .some(v => v?.toLowerCase().includes(q))
}

/** The page ids a Ctrl/⌘- or Shift-click on `index` leaves picked: Ctrl toggles that page (the
 *  open page joins the first pick), Shift picks the run from the open page to it. */
export function pickedAfterClick(pages: FullstackPageDef[], picked: string[], selected: number, index: number, mode: 'toggle' | 'range'): string[] {
  const id = pages[index]?.id
  if (id == null) return picked
  if (mode === 'range') {
    const [from, to] = selected <= index ? [selected, index] : [index, selected]
    const run = pages.slice(from, to + 1).map(p => p.id)
    return [...picked.filter(k => !run.includes(k)), ...run]
  }
  const base = picked.length === 0 && pages[selected] && selected !== index ? [pages[selected].id] : picked
  return base.includes(id) ? base.filter(k => k !== id) : [...base, id]
}

/**
 * The layout's pages as chips, grouped the way the generated navigation groups them, then the
 * pages that are not in it. A chip selects its page; dragged, it moves the page (into the group
 * it is dropped among). A page type dragged from the library drops here as a new page.
 * Ctrl/⌘-click and Shift-click pick several pages for a bulk action; a right-click (or Shift+F10)
 * opens a chip's menu; Delete removes the focused chip's page and Alt+←/→ moves it.
 */
export function PageStrip({ pages, model, validation, selected, onSelect, onAddPage, findRequest, newPageDrop, picked = [], onPick, onChipDrag }: {
  pages: FullstackPageDef[]
  model: PagesModel
  validation: PageLayoutValidation
  selected: number
  onSelect: (index: number) => void
  onAddPage: () => void
  /** Bumped to focus the page search. */
  findRequest?: number
  /** While a page is dragged from the library: where it would land, and how to drop it there. */
  newPageDrop?: { onDrop: (at: number) => void } | null
  /** A chip is being dragged (its index), or the drag ended — a tabs page on the canvas takes it. */
  onChipDrag?: (index: number | null) => void
  /** Page ids picked for a bulk action, and how a Ctrl/Shift-click changes them. Absent: no picking. */
  picked?: string[]
  onPick?: (ids: string[]) => void
}) {
  const { dnd, keys, preview } = model
  const startIndex = preview.nav[0]?.index
  // The chip whose menu is open, and the chip element to give the focus back to.
  const [menu, setMenu] = useState<{ index: number; anchor: HTMLElement } | null>(null)
  const menuPage = menu ? pages[menu.index] : undefined

  function chipClick(e: ReactMouseEvent<HTMLButtonElement>, index: number) {
    if (onPick && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      e.preventDefault()
      onPick(pickedAfterClick(pages, picked, selected, index, e.shiftKey ? 'range' : 'toggle'))
      return
    }
    if (picked.length > 0) onPick?.([])
    onSelect(index)
  }
  function chipKey(e: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.ctrlKey || e.metaKey) return
    if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') {
      e.preventDefault()
      setMenu({ index, anchor: e.currentTarget })
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.altKey && !e.shiftKey) {
      e.preventDefault()
      model.requestRemove(index)
    } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault()
      model.move(index, e.key === 'ArrowRight' ? 1 : -1)
    }
  }
  function menuItems(index: number): MenuItem[] {
    const page = pages[index]
    if (!page) return []
    const isStart = index === startIndex
    const items: MenuItem[] = [{ key: 'open', label: 'Open', icon: 'edit', onSelect: () => onSelect(index) }]
    if (inNav(page) && !isStart) items.push({ key: 'start', label: 'Make it the start page', icon: 'home', onSelect: () => model.makeStart(index, startIndex ?? 0) })
    if (page.type !== 'record') {
      items.push({
        key: 'hidden',
        label: page.hidden ? 'Show in the navigation' : 'Hide from the navigation',
        icon: page.hidden ? 'visibility' : 'visibility_off',
        onSelect: () => model.toggleHidden(index),
      })
    }
    if (canDuplicate(page)) {
      items.push({ key: 'duplicate', label: 'Duplicate', icon: 'content_copy', disabled: model.atPageCap && `A layout can have at most ${MAX_PAGES} pages`, onSelect: () => model.duplicate(index) })
    }
    items.push(
      { key: 'earlier', label: 'Move earlier', icon: 'arrow_back', disabled: index === 0, onSelect: () => model.move(index, -1) },
      { key: 'later', label: 'Move later', icon: 'arrow_forward', disabled: index === pages.length - 1, onSelect: () => model.move(index, 1) },
    )
    if (onPick) {
      const on = picked.includes(page.id)
      items.push({ key: 'pick', label: on ? 'Unpick' : 'Pick for a bulk action', icon: on ? 'check_box' : 'check_box_outline_blank', onSelect: () => onPick(pickedAfterClick(pages, picked, selected, index, 'toggle')) })
    }
    items.push({ key: 'delete', label: 'Delete page', icon: 'delete', tone: 'danger', onSelect: () => model.requestRemove(index) })
    return items
  }
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!findRequest) return
    requestAnimationFrame(() => { searchRef.current?.focus(); searchRef.current?.select() })
  }, [findRequest])
  // A library page hovering a chip: before or after it, like a reorder.
  const [newAt, setNewAt] = useState<number | null>(null)

  const chip = (index: number) => {
    const page = pages[index]
    if (!page || !pageMatches(page, query)) return null
    const meta = PAGE_TYPE_META[page.type] ?? { icon: 'web_asset', label: page.type }
    const on = index === selected
    const isPicked = picked.includes(page.id)
    const errors = Object.keys(validation.byPage[index] ?? {}).length
    const warnings = validation.warningsByPage[index] ?? 0
    const indicator = newPageDrop ? (newAt === index ? 'before' : newAt === index + 1 && index === pages.length - 1 ? 'after' : null) : dnd.indicatorFor('pages', index)
    const reorder = dnd.rowProps('pages', index, 'x')
    const handle = dnd.handleProps('pages', index)
    return (
      <li
        key={keys[index]}
        onDragOver={e => {
          if (newPageDrop) {
            e.preventDefault()
            const rect = e.currentTarget.getBoundingClientRect()
            setNewAt(e.clientX < rect.left + rect.width / 2 ? index : index + 1)
            return
          }
          reorder.onDragOver(e)
        }}
        onDragLeave={reorder.onDragLeave}
        onDrop={e => {
          if (newPageDrop) {
            e.preventDefault()
            newPageDrop.onDrop(newAt ?? index + 1)
            setNewAt(null)
            return
          }
          reorder.onDrop(e)
        }}
        className={`relative rounded-lg border-2 border-transparent ${dropIndicatorClass(indicator, 'x')} ${dnd.isDragging('pages', index) ? 'opacity-40' : ''}`}
        data-strip-page={page.id}
        data-picked={isPicked ? '' : undefined}
      >
        <button
          type="button"
          {...handle}
          onDragStart={e => { handle.onDragStart(e); onChipDrag?.(index) }}
          onDragEnd={() => { handle.onDragEnd(); onChipDrag?.(null) }}
          onClick={e => chipClick(e, index)}
          onKeyDown={e => chipKey(e, index)}
          onContextMenu={e => { e.preventDefault(); setMenu({ index, anchor: e.currentTarget }) }}
          aria-pressed={on}
          aria-haspopup="menu"
          title={`${pageLabel(page)} — ${meta.label} · #/${page.id || '…'}. Drag to move it; right-click for more${onPick ? '; Ctrl-click to pick several' : ''}.`}
          className={`flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
            on ? 'border-primary bg-primary/10 font-semibold text-on-surface' : 'border-outline-variant bg-surface-container text-on-surface hover:border-primary/50'
          } ${inNav(page) ? '' : 'border-dashed'} ${isPicked ? 'ring-2 ring-primary/60' : ''}`}
        >
          {isPicked
            ? <span className="material-symbols-outlined text-primary" style={{ fontSize: '15px' }} role="img" aria-label="Picked">check_box</span>
            : <span className="material-symbols-outlined text-secondary" style={{ fontSize: '15px' }} aria-hidden="true">{meta.icon}</span>}
          <span className="max-w-[12rem] truncate">{pageLabel(page)}</span>
          {index === startIndex && (
            <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '14px' }} role="img" aria-label="Start page" title="The app opens on this page">home</span>
          )}
          {errors > 0 && <span className="h-2 w-2 rounded-full bg-error" role="img" aria-label={`${errors} problem${errors === 1 ? '' : 's'}`} />}
          {errors === 0 && warnings > 0 && <span className="h-2 w-2 rounded-full bg-amber-400" role="img" aria-label={`${warnings} tip${warnings === 1 ? '' : 's'}`} />}
        </button>
        {menu?.index === index && menuPage && (
          <DesignerMenu
            label={`${pageLabel(menuPage)} actions`}
            heading={pageLabel(menuPage)}
            items={menuItems(index)}
            returnFocus={menu.anchor}
            onClose={() => setMenu(null)}
            className="start-0 top-full mt-1"
          />
        )}
      </li>
    )
  }

  const offNav = pages.map((p, i) => (inNav(p) ? -1 : i)).filter(i => i >= 0)
  return (
    <div
      className={`flex flex-wrap items-end gap-x-5 gap-y-2 border-b border-outline-variant bg-surface-container-lowest px-4 py-2.5 ${newPageDrop ? 'outline-2 -outline-offset-4 outline-dashed outline-primary' : ''}`}
      onDragOver={e => { if (newPageDrop) e.preventDefault() }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setNewAt(null) }}
      onDrop={e => {
        if (!newPageDrop || e.defaultPrevented) return
        e.preventDefault()
        newPageDrop.onDrop(newAt ?? pages.length)
        setNewAt(null)
      }}
      aria-label="Pages"
      role="group"
      data-page-strip
    >
      {model.navGroupSections.map((section, si) => (
        <div key={section.group ?? `loose-${si}`} className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">{section.group ?? (si === 0 ? 'Navigation' : 'Ungrouped')}</p>
          <ul className="flex flex-wrap gap-1">{section.items.map(chip)}</ul>
        </div>
      ))}
      {offNav.length > 0 && (
        <div className="min-w-0 space-y-1" data-strip-off-nav>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary" title="Opened from a row, a tab or a link — never from the menu">Off the navigation</p>
          <ul className="flex flex-wrap gap-1">{offNav.map(chip)}</ul>
        </div>
      )}
      <button
        type="button"
        onClick={onAddPage}
        disabled={model.atPageCap || model.named.length === 0}
        className="flex min-h-9 items-center gap-1 rounded-lg border border-dashed border-outline px-2.5 text-xs text-secondary hover:border-primary/50 hover:text-primary disabled:opacity-40"
        title={model.named.length === 0 ? 'Name an entity first' : model.atPageCap ? 'The layout has the most pages it can have' : 'Add a page — or drag one from the library'}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">add</span>
        Page
      </button>
      <label className="relative ms-auto w-48 min-w-0">
        <span className="material-symbols-outlined pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-secondary" style={{ fontSize: '15px' }} aria-hidden="true">search</span>
        <input
          ref={searchRef}
          type="search"
          aria-label="Find a page"
          placeholder="Find a page"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape' && query) { e.preventDefault(); e.stopPropagation(); setQuery('') }
            else if (e.key === 'Enter') {
              const first = pages.findIndex(p => pageMatches(p, query))
              if (first >= 0) { e.preventDefault(); onSelect(first) }
            }
          }}
          className={`${inputClass()} py-1 ps-7 text-xs`}
        />
      </label>
    </div>
  )
}
