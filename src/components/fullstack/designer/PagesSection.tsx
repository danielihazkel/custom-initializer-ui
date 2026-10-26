import { useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmDialog } from '../../ConfirmDialog'
import { LAYOUT_TEMPLATES, buildLayoutTemplate } from '../layoutTemplates'
import { PAGE_TYPE_META, describePage, inNav, navSections, pageLabel, seedLayout } from '../pageLayout'
import { summarizeLayout, type PagesEditorProps } from '../PagesEditor'
import { scrollToElement } from '../scroll'
import { ICON_BUTTON, SMALL_BUTTON } from '../pages/constants'
import { TemplateGallery } from '../pages/TemplateGallery'
import { LayoutDesigner, type DesignerTarget } from './LayoutDesigner'
import type { FrontendAppearance } from './FrontendSettings'

export interface PagesSectionProps extends PagesEditorProps {
  /** The generated app's look — edited in the designer's Appearance view. */
  appearance?: FrontendAppearance
  /** Bumped (a new `n`) to open the designer on `target` — the Setup panel's "Edit in designer". */
  designerRequest?: { n: number; target: DesignerTarget } | null
}

/**
 * The Fullstack tab's page layout: a card summing the layout up — its navigation as a small
 * sitemap, its problems, the ways to start one — that opens the full-screen layout designer.
 * Takes the inline editor's props, so the tab hands either the same state.
 */
export function PagesSection(props: PagesSectionProps) {
  const { pages, entities, validation, pushUndo, onChange, onClear, previewSettings, revealRequest, addRequest, previewRequest, findRequest, serverIssue, onOpenGuide, appearance, designerRequest } = props
  const [open, setOpen] = useState<DesignerTarget | null>(null)
  const [confirmClassic, setConfirmClassic] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const named = entities.filter(e => e.name.trim())
  const layoutTemplates = useMemo(() => LAYOUT_TEMPLATES.map(t => ({ template: t, result: buildLayoutTemplate(t, entities) })), [entities])

  // The caller's "jump to the first error": the designer opens on the first page with a problem.
  useEffect(() => {
    if (!revealRequest) return
    const first = validation.issues.find(i => i.page != null)
    if (first) setOpen({ page: first.page!, control: first.field })
    else scrollToElement(sectionRef.current, 'center')
  }, [revealRequest])
  // The command palette's Add page, Find page and layout preview all open the designer.
  useEffect(() => { if (addRequest) setOpen({ panel: 'add' }) }, [addRequest])
  useEffect(() => { if (findRequest) setOpen({ panel: 'find' }) }, [findRequest])
  useEffect(() => { if (previewRequest) setOpen({}) }, [previewRequest])
  useEffect(() => { if (designerRequest) setOpen(designerRequest.target) }, [designerRequest?.n])

  const issues = validation.issues.length + (serverIssue ? 1 : 0)
  const tips = validation.warnings.length
  const sections = navSections(pages)
  const offNav = pages.map((p, i) => ({ p, i })).filter(({ p }) => !inNav(p))
  const startIndex = sections[0]?.items[0]

  function startFromEntities() {
    pushUndo('Started a page layout from the entities')
    onChange(seedLayout(entities, { title: previewSettings?.dashboardTitle, description: previewSettings?.dashboardOverview }))
    setOpen({})
  }
  function startFromTemplate(label: string, built: typeof pages) {
    pushUndo(`Started a page layout from the “${label}” template`)
    onChange(built)
    setOpen({})
  }

  const pageButton = (index: number) => {
    const page = pages[index]
    const meta = PAGE_TYPE_META[page.type]
    const problems = Object.keys(validation.byPage[index] ?? {}).length
    return (
      <li key={`${index}:${page.id}`}>
        <button
          type="button"
          onClick={() => setOpen({ page: index })}
          className={`flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs text-on-surface transition-colors hover:border-primary/50 hover:bg-primary/5 ${inNav(page) ? 'border-outline-variant' : 'border-dashed border-outline-variant text-secondary'}`}
          title={`${pageLabel(page)} — ${describePage(page, pages)}. Opens it in the designer.`}
          data-page-id={page.id}
        >
          <span className="material-symbols-outlined text-secondary" style={{ fontSize: '15px' }} aria-hidden="true">{meta?.icon ?? 'web_asset'}</span>
          <span className="max-w-[12rem] truncate">{pageLabel(page)}</span>
          {index === startIndex && <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '14px' }} role="img" aria-label="Start page">home</span>}
          {problems > 0 && <span className="h-2 w-2 rounded-full bg-error" role="img" aria-label={`${problems} problem${problems === 1 ? '' : 's'}`} />}
        </button>
      </li>
    )
  }

  return (
    <section
      ref={sectionRef}
      id="fs-pages"
      className="@container space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
      aria-label="Frontend page layout"
      data-page-layout
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-outlined mt-0.5 text-primary" style={{ fontSize: '20px' }} aria-hidden="true">web</span>
          <div>
            <h2 className="text-sm font-bold text-on-surface">
              Frontend pages
              {pages.length > 0 && <span className="ms-1.5 text-[11px] font-normal text-secondary">{pages.length}</span>}
              {onOpenGuide && (
                <button type="button" onClick={() => onOpenGuide('fs-pages')} className={`${ICON_BUTTON} ms-1 align-middle`} aria-label="Open the guide on frontend pages" title="How page layouts work — opens the guide" data-pages-help>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>help</span>
                </button>
              )}
            </h2>
            <p className="text-[11px] text-secondary" data-pages-summary>{summarizeLayout(pages)}</p>
          </div>
        </div>
        {(issues > 0 || tips > 0) && (
          <button
            type="button"
            onClick={() => setOpen({ panel: 'issues' })}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold ${issues > 0 ? 'bg-error/10 text-error' : 'bg-amber-400/15 text-amber-600'}`}
            data-pages-issues
            data-pages-problems={issues > 0 ? issues : undefined}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">{issues > 0 ? 'error' : 'lightbulb'}</span>
            {issues > 0 ? `${issues} problem${issues === 1 ? '' : 's'} stop Generate` : `${tips} tip${tips === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      {serverIssue && pages[serverIssue.page] && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-error/40 bg-error/5 px-3 py-2 text-[11px] text-error" role="alert" data-pages-server-issue>
          The server rejected “{pageLabel(pages[serverIssue.page])}”: {serverIssue.message}
          <button type="button" onClick={() => setOpen({ page: serverIssue.page, panel: 'issues' })} className="font-semibold underline">Open in designer</button>
        </p>
      )}

      {named.length === 0 && (
        <p className="text-[11px] text-secondary" data-pages-need-entity>
          Pages are built from your entities — name at least one entity in the Entities section above, then design the pages.
        </p>
      )}

      {pages.length > 0 ? (
        <div className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Pages" role="group" data-pages-sitemap>
          {sections.map((section, si) => (
            <div key={section.group ?? `loose-${si}`} className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">{section.group ?? (si === 0 ? 'Navigation' : 'Ungrouped')}</p>
              <ul className="flex flex-wrap gap-1">{section.items.map(pageButton)}</ul>
            </div>
          ))}
          {offNav.length > 0 && (
            <div className="space-y-1" data-pages-off-nav>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Off the navigation</p>
              <ul className="flex flex-wrap gap-1">{offNav.map(({ i }) => pageButton(i))}</ul>
            </div>
          )}
        </div>
      ) : named.length > 0 && (
        <div className="space-y-2 rounded-lg border border-dashed border-outline-variant px-3 py-3">
          <p className="text-[11px] text-secondary">
            <span className="font-semibold text-on-surface">Classic layout</span> — without pages the app gets a dashboard plus one list page per entity. Start a layout to design your own.
          </p>
          <TemplateGallery templates={layoutTemplates} onPick={startFromTemplate} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant pt-3">
        <button
          type="button"
          onClick={() => setOpen({})}
          disabled={named.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-on-primary disabled:opacity-40"
          data-open-designer
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">open_in_full</span>
          {pages.length > 0 ? 'Open designer' : 'Design pages'}
        </button>
        {appearance && (
          <button type="button" onClick={() => setOpen({ panel: 'appearance' })} className={SMALL_BUTTON} title="Template set, colours, language and direction — beside a live preview" data-open-appearance>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">palette</span>
            Appearance
          </button>
        )}
        {pages.length === 0 ? (
          <button type="button" onClick={startFromEntities} disabled={named.length === 0} className={SMALL_BUTTON} data-seed-layout>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">auto_awesome</span>
            Start from my entities
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setOpen({ panel: 'templates' })} className={SMALL_BUTTON} data-open-templates>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">auto_awesome_mosaic</span>
              Templates
            </button>
            <button type="button" onClick={() => setConfirmClassic(true)} className={`${SMALL_BUTTON} ms-auto`} title="Generate the default dashboard plus one list page per entity instead">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">restart_alt</span>
              Use classic layout
            </button>
          </>
        )}
      </div>

      {open && <LayoutDesigner {...props} target={open} onClose={() => setOpen(null)} />}
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
  )
}
