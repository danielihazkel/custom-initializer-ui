import { useState } from 'react'
import type { FullstackNav, FullstackPageDef } from '../../../types'
import { LayoutPreview } from '../LayoutPreview'
import { PAGE_TYPE_META, inNav, pageLabel } from '../pageLayout'
import { dropIndicatorClass } from '../useDragReorder'
import { GroupChip, MoveButtons } from '../pages/fields'
import type { PagesModel } from '../pages/usePagesModel'
import { PageFlowMap } from './PageFlowMap'

/**
 * The layout as the generated navigation sees it: one column per nav section, its pages in order
 * (drag one into another section to move it there), the pages off the navigation, and the shell's
 * navigation style beside a preview of it.
 */
export function SitemapView({ pages, model, nav, onNavChange, onOpenPage }: {
  pages: FullstackPageDef[]
  model: PagesModel
  nav?: FullstackNav
  onNavChange?: (nav: FullstackNav | undefined) => void
  /** Back to the design view, on this page. */
  onOpenPage: (index: number) => void
}) {
  const { dnd, keys, preview, settings, navGroupSections } = model
  const startIndex = preview.nav[0]?.index
  // The menu as sections, or the map of where each page leads.
  const [show, setShow] = useState<'menu' | 'flow'>('menu')
  const card = (index: number) => {
    const page = pages[index]
    const meta = PAGE_TYPE_META[page.type]
    const indicator = dnd.indicatorFor('pages', index)
    return (
      <li
        key={keys[index]}
        {...dnd.rowProps('pages', index)}
        className={`flex items-center gap-2 rounded-lg border bg-surface-container px-2 py-1.5 ${inNav(page) ? 'border-outline-variant' : 'border-dashed border-outline'} ${
          dnd.isDragging('pages', index) ? 'opacity-40' : ''} ${dropIndicatorClass(indicator)}`}
        data-sitemap-page={page.id}
      >
        <span {...dnd.handleProps('pages', index)} className="cursor-grab text-secondary/70" title="Drag to move it — into another section to join it" aria-hidden="true">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>drag_indicator</span>
        </span>
        <MoveButtons label={pageLabel(page)} canUp={index > 0} canDown={index < pages.length - 1} onMove={delta => model.move(index, delta)} />
        <button type="button" onClick={() => onOpenPage(index)} className="min-w-0 flex-1 text-start" title="Open it in the design view">
          <span className="block truncate text-xs font-semibold text-on-surface">{pageLabel(page)}</span>
          <span className="block truncate text-[10px] text-secondary">{meta?.label ?? page.type} · <span className="font-mono">#/{page.id || '…'}</span></span>
        </button>
        {index === startIndex && (
          <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '15px' }} role="img" aria-label="Start page" title="The app opens on this page">home</span>
        )}
      </li>
    )
  }
  const offNav = pages.map((p, i) => (inNav(p) ? -1 : i)).filter(i => i >= 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden" data-designer-sitemap>
      <main className="min-w-0 flex-1 space-y-4 overflow-y-auto p-5" aria-label="Sitemap">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-on-surface">{show === 'menu' ? 'Navigation' : 'Page flow'}</h2>
            <p className="text-[11px] text-secondary">
              {show === 'menu'
                ? 'The generated menu, section by section. Drag a page into another section to move it there; rename a section in place, or move it past its neighbour. A page joins a new section from its Basics in the design view.'
                : 'Where each page leads in the generated app: columns are clicks from the menu. Point at a page to light its links; click it to edit it.'}
            </p>
          </div>
          <div role="radiogroup" aria-label="Sitemap view" className="flex gap-0.5 rounded-lg border border-outline-variant bg-surface-container p-0.5">
            {([['menu', 'Menu'], ['flow', 'Page flow']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={show === value}
                onClick={() => setShow(value)}
                className={`rounded-md px-3 py-1 text-xs ${show === value ? 'bg-surface-container-high font-semibold text-on-surface' : 'text-secondary hover:text-on-surface'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {show === 'flow' ? (
          <PageFlowMap pages={pages} entities={model.named} startIndex={startIndex} onOpenPage={onOpenPage} />
        ) : (
        <>
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4" data-nav-groups>
          {navGroupSections.map((section, si) => (
            <section key={section.group ?? `loose-${si}`} className="space-y-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3" aria-label={section.group ?? 'Ungrouped pages'}>
              <div className="flex items-center gap-1">
                {section.group ? (
                  <GroupChip
                    group={section.group}
                    count={section.items.length}
                    canUp={si > 0}
                    canDown={si < navGroupSections.length - 1}
                    onRename={to => model.renameGroup(section.group!, to)}
                    onMove={delta => model.moveGroup(si, delta)}
                  />
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant px-2 py-0.5 text-[11px] text-secondary" data-nav-group="">
                    Ungrouped <span>{section.items.length}</span>
                    <MoveButtons label={`the ungrouped pages${si > 0 ? ` (section ${si + 1})` : ''}`} canUp={si > 0} canDown={si < navGroupSections.length - 1} onMove={delta => model.moveGroup(si, delta)} />
                  </span>
                )}
              </div>
              <ul className="space-y-1.5">{section.items.map(card)}</ul>
            </section>
          ))}
        </div>
        {offNav.length > 0 && (
          <section className="space-y-2 rounded-xl border border-dashed border-outline p-3" aria-label="Off the navigation" data-sitemap-off-nav>
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-xs font-semibold text-on-surface">Off the navigation</h3>
              <span className="text-[11px] text-secondary">Reached from a row, a tab or a link — never from the menu</span>
            </div>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">{offNav.map(card)}</ul>
          </section>
        )}
        </>
        )}
      </main>
      <aside className="space-y-4 border-outline-variant bg-surface-container-lowest p-5 lg:w-[22rem] lg:shrink-0 lg:overflow-y-auto lg:border-s" aria-label="Navigation style">
        {onNavChange && settings.navOptions !== false ? (
          <div className="space-y-3" data-nav-options>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Menu style</p>
            <div role="radiogroup" aria-label="Navigation style" className="grid grid-cols-2 gap-2">
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
                    className={`space-y-1.5 rounded-lg border-2 p-2 text-start text-xs ${on ? 'border-primary font-semibold text-on-surface' : 'border-outline-variant text-secondary hover:border-primary/40'}`}
                  >
                    <span aria-hidden="true" className={`flex h-10 gap-1 rounded bg-surface-container p-1 ${value === 'topbar' ? 'flex-col' : ''}`}>
                      <span className={`rounded-sm bg-primary/40 ${value === 'topbar' ? 'h-2' : 'w-3'}`} />
                      <span className="flex-1 rounded-sm bg-surface-container-high" />
                    </span>
                    {label}
                  </button>
                )
              })}
            </div>
            <label className="flex items-start gap-2 text-xs text-on-surface">
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                checked={Boolean(nav?.collapsibleGroups)}
                aria-label="Collapsible groups"
                onChange={e => onNavChange(e.target.checked ? { ...nav, collapsibleGroups: true } : (nav?.style && nav.style !== 'sidebar' ? { style: nav.style } : undefined))}
              />
              <span>Groups fold open and closed<span className="block text-[11px] text-secondary">Nav sections with a name</span></span>
            </label>
          </div>
        ) : (
          <p className="text-[11px] text-secondary">This look always lays out its own menu.</p>
        )}
        {pages.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Preview</p>
            <LayoutPreview
              preview={preview}
              selected={startIndex ?? 0}
              onSelect={onOpenPage}
              onEdit={t => onOpenPage(t.page)}
              skin={settings.skin}
              palette={settings.palette}
              navStyle={nav?.style}
              collapsibleGroups={nav?.collapsibleGroups}
            />
          </div>
        )}
      </aside>
    </div>
  )
}
