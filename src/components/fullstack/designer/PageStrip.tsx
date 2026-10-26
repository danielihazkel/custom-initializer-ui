import { useEffect, useRef, useState } from 'react'
import type { FullstackPageDef } from '../../../types'
import { inputClass } from '../controls'
import { PAGE_TYPE_META, inNav, pageLabel, type PageLayoutValidation } from '../pageLayout'
import { dropIndicatorClass } from '../useDragReorder'
import type { PagesModel } from '../pages/usePagesModel'

/** The pages to find a page among: its label, route, entity, type or group. */
export function pageMatches(page: FullstackPageDef, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [pageLabel(page), page.id, page.title, page.entity, page.parent, page.child, page.group, PAGE_TYPE_META[page.type]?.label]
    .some(v => v?.toLowerCase().includes(q))
}

/**
 * The layout's pages as chips, grouped the way the generated navigation groups them, then the
 * pages that are not in it. A chip selects its page; dragged, it moves the page (into the group
 * it is dropped among). A page type dragged from the library drops here as a new page.
 */
export function PageStrip({ pages, model, validation, selected, onSelect, onAddPage, findRequest, newPageDrop }: {
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
}) {
  const { dnd, keys, preview } = model
  const startIndex = preview.nav[0]?.index
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
    const errors = Object.keys(validation.byPage[index] ?? {}).length
    const warnings = validation.warningsByPage[index] ?? 0
    const indicator = newPageDrop ? (newAt === index ? 'before' : newAt === index + 1 && index === pages.length - 1 ? 'after' : null) : dnd.indicatorFor('pages', index)
    const reorder = dnd.rowProps('pages', index, 'x')
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
        className={`rounded-lg border-2 border-transparent ${dropIndicatorClass(indicator, 'x')} ${dnd.isDragging('pages', index) ? 'opacity-40' : ''}`}
        data-strip-page={page.id}
      >
        <button
          type="button"
          {...dnd.handleProps('pages', index)}
          onClick={() => onSelect(index)}
          aria-pressed={on}
          title={`${pageLabel(page)} — ${meta.label} · #/${page.id || '…'}. Drag to move it.`}
          className={`flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
            on ? 'border-primary bg-primary/10 font-semibold text-on-surface' : 'border-outline-variant bg-surface-container text-on-surface hover:border-primary/50'
          } ${inNav(page) ? '' : 'border-dashed'}`}
        >
          <span className="material-symbols-outlined text-secondary" style={{ fontSize: '15px' }} aria-hidden="true">{meta.icon}</span>
          <span className="max-w-[12rem] truncate">{pageLabel(page)}</span>
          {index === startIndex && (
            <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '14px' }} role="img" aria-label="Start page" title="The app opens on this page">home</span>
          )}
          {errors > 0 && <span className="h-2 w-2 rounded-full bg-error" role="img" aria-label={`${errors} problem${errors === 1 ? '' : 's'}`} />}
          {errors === 0 && warnings > 0 && <span className="h-2 w-2 rounded-full bg-amber-400" role="img" aria-label={`${warnings} tip${warnings === 1 ? '' : 's'}`} />}
        </button>
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
