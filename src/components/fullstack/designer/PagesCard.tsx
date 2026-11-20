import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../../ConfirmDialog'
import { LAYOUT_TEMPLATES, buildLayoutTemplate } from '../layoutTemplates'
import { PAGE_TYPE_META, describePage, inNav, navSections, pageLabel, seedLayout } from '../pageLayout'
import type { PagesHostProps } from '../pages/hostProps'
import { scrollToElement } from '../scroll'
import { ICON_BUTTON, SMALL_BUTTON } from '../pages/constants'
import { TemplateGallery } from '../pages/TemplateGallery'
import type { DesignerTarget } from './LayoutDesigner'
import type { FrontendAppearance } from './FrontendSettings'
import { t, tn, useLang } from '../../../i18n'

export interface PagesSectionProps extends PagesHostProps {
  /** The generated app's look — edited in the designer's Appearance view. */
  appearance?: FrontendAppearance
  /** Bumped (a new `n`) to open the designer on `target` — the Setup panel's "Edit in designer". */
  designerRequest?: { n: number; target: DesignerTarget } | null
}

/** Nav page names the summary lists before it says "and N more". */
const SUMMARY_NAMES = 5

/** One line for the card: what the generated app's navigation will hold. */
export function summarizeLayout(pages: PagesHostProps['pages']): string {
  if (pages.length === 0) return t('Classic layout — a dashboard plus one list page per entity.')
  const labels = pages.filter(inNav).map(pageLabel)
  const more = labels.length - SUMMARY_NAMES
  const offNav = pages.length - labels.length
  const parts = [
    labels.length > 0
      ? (more > 0 ? t('{names} and {n} more', { names: labels.slice(0, SUMMARY_NAMES).join(', '), n: more }) : labels.join(', '))
      : t('Nothing in the navigation'),
    offNav > 0 ? t('{n} off the navigation', { n: offNav }) : '',
  ]
  return parts.filter(Boolean).join(' · ')
}

/**
 * A page layout summed up in a card — its navigation as a small sitemap, its problems, the ways to
 * start one — that opens the full-screen layout designer. The designer itself is the host's to
 * draw (`designer`), so this module does not import it: the Fullstack tab mounts it directly
 * (`PagesSection`), the Admin examples form as a chunk fetched when it is first opened.
 */
export function PagesCard(props: PagesSectionProps & {
  /** The designer, open on `target`; `onClose` closes it. */
  designer: (target: DesignerTarget, onClose: () => void) => ReactNode
  /** The host's designer has an Appearance view although the card was handed no `appearance`
   *  (the Admin form builds it only once the designer is open). */
  offersAppearance?: boolean
}) {
  const { pages, entities, validation, pushUndo, onChange, onClear, previewSettings, revealRequest, addRequest, previewRequest, findRequest, serverIssue, onOpenGuide, appearance, designerRequest, designer, offersAppearance } = props
  const lang = useLang()
  const [open, setOpen] = useState<DesignerTarget | null>(null)
  const [confirmClassic, setConfirmClassic] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const named = entities.filter(e => e.name.trim())
  // Only the empty card shows the template gallery — build the templates only then.
  const empty = pages.length === 0
  const layoutTemplates = useMemo(
    () => (empty ? LAYOUT_TEMPLATES.map(template => ({ template, result: buildLayoutTemplate(template, entities) })) : []),
    // `lang`: the templates' titles are in it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entities, empty, lang],
  )

  // The caller's "jump to the first error": the designer opens on the first page with a problem.
  useEffect(() => {
    if (!revealRequest) return
    const first = validation.issues.find(i => i.page != null)
    if (first) setOpen({ page: first.page!, control: first.field })
    else scrollToElement(sectionRef.current, 'center')
    // Once per request, against the problems of that moment — not again on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealRequest])
  // The command palette's Add page, Find page and layout preview all open the designer.
  useEffect(() => { if (addRequest) setOpen({ panel: 'add' }) }, [addRequest])
  useEffect(() => { if (findRequest) setOpen({ panel: 'find' }) }, [findRequest])
  useEffect(() => { if (previewRequest) setOpen({}) }, [previewRequest])
  // Keyed on the request's counter: a request object rebuilt with the same `n` is not a new one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (designerRequest) setOpen(designerRequest.target) }, [designerRequest?.n])

  const issues = validation.issues.length + (serverIssue ? 1 : 0)
  const tips = validation.warnings.length
  const sections = navSections(pages)
  const offNav = pages.map((p, i) => ({ p, i })).filter(({ p }) => !inNav(p))
  const startIndex = sections[0]?.items[0]

  function startFromEntities() {
    pushUndo(t('Started a page layout from the entities'))
    onChange(seedLayout(entities, { title: previewSettings?.dashboardTitle, description: previewSettings?.dashboardOverview }))
    setOpen({})
  }
  function startFromTemplate(label: string, built: typeof pages) {
    pushUndo(t('Started a page layout from the “{name}” template', { name: label }))
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
          title={t('{page} — {description}. Opens it in the designer.', { page: pageLabel(page), description: describePage(page, pages) })}
          data-page-id={page.id}
        >
          <span className="material-symbols-outlined text-secondary" style={{ fontSize: '15px' }} aria-hidden="true">{meta?.icon ?? 'web_asset'}</span>
          <span className="max-w-[12rem] truncate">{pageLabel(page)}</span>
          {index === startIndex && <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '14px' }} role="img" aria-label={t('Start page')}>home</span>}
          {problems > 0 && <span className="h-2 w-2 rounded-full bg-error" role="img" aria-label={tn(problems, '{n} problem', '{n} problems')} />}
        </button>
      </li>
    )
  }

  return (
    <section
      ref={sectionRef}
      id="fs-pages"
      className="@container space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
      aria-label={t('Frontend page layout')}
      data-page-layout
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-outlined mt-0.5 text-primary" style={{ fontSize: '20px' }} aria-hidden="true">web</span>
          <div>
            <h2 className="text-sm font-bold text-on-surface">
              {t('Frontend pages')}
              {pages.length > 0 && <span className="ms-1.5 text-[11px] font-normal text-secondary">{pages.length}</span>}
              {onOpenGuide && (
                <button type="button" onClick={() => onOpenGuide('fs-pages')} className={`${ICON_BUTTON} ms-1 align-middle`} aria-label={t('Open the guide on frontend pages')} title={t('How page layouts work — opens the guide')} data-pages-help>
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
            {issues > 0 ? tn(issues, '{n} problem stops Generate', '{n} problems stop Generate') : tn(tips, '{n} tip', '{n} tips')}
          </button>
        )}
      </div>

      {serverIssue && pages[serverIssue.page] && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-error/40 bg-error/5 px-3 py-2 text-[11px] text-error" role="alert" data-pages-server-issue>
          {t('The server rejected “{page}”: {message}', { page: pageLabel(pages[serverIssue.page]), message: serverIssue.message })}
          <button type="button" onClick={() => setOpen({ page: serverIssue.page, panel: 'issues' })} className="font-semibold underline">{t('Open in designer')}</button>
        </p>
      )}

      {named.length === 0 && (
        <p className="text-[11px] text-secondary" data-pages-need-entity>
          {t('Pages are built from your entities — name at least one entity in the Entities section above, then design the pages.')}
        </p>
      )}

      {pages.length > 0 ? (
        <div className="flex flex-wrap gap-x-6 gap-y-3" aria-label={t('Pages')} role="group" data-pages-sitemap>
          {sections.map((section, si) => (
            <div key={section.group ?? `loose-${si}`} className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">{section.group ?? (si === 0 ? t('Navigation') : t('Ungrouped'))}</p>
              <ul className="flex flex-wrap gap-1">{section.items.map(pageButton)}</ul>
            </div>
          ))}
          {offNav.length > 0 && (
            <div className="space-y-1" data-pages-off-nav>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">{t('Off the navigation')}</p>
              <ul className="flex flex-wrap gap-1">{offNav.map(({ i }) => pageButton(i))}</ul>
            </div>
          )}
        </div>
      ) : named.length > 0 && (
        <div className="space-y-2 rounded-lg border border-dashed border-outline-variant px-3 py-3">
          <p className="text-[11px] text-secondary">
            <span className="font-semibold text-on-surface">{t('Classic layout')}</span> — {t('without pages the app gets a dashboard plus one list page per entity. Start a layout to design your own.')}
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
          {pages.length > 0 ? t('Open designer') : t('Design pages')}
        </button>
        {(appearance || offersAppearance) && (
          <button type="button" onClick={() => setOpen({ panel: 'appearance' })} className={SMALL_BUTTON} title={t('Template set, colours, language and direction — beside a live preview')} data-open-appearance>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">palette</span>
            {t('Appearance')}
          </button>
        )}
        {pages.length === 0 ? (
          <button type="button" onClick={startFromEntities} disabled={named.length === 0} className={SMALL_BUTTON} data-seed-layout>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">auto_awesome</span>
            {t('Start from my entities')}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setOpen({ panel: 'templates' })} className={SMALL_BUTTON} data-open-templates>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">auto_awesome_mosaic</span>
              {t('Templates')}
            </button>
            <button type="button" onClick={() => setConfirmClassic(true)} className={`${SMALL_BUTTON} ms-auto`} title={t('Generate the default dashboard plus one list page per entity instead')}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">restart_alt</span>
              {t('Use classic layout')}
            </button>
          </>
        )}
      </div>

      {open && designer(open, () => setOpen(null))}
      {confirmClassic && (
        <ConfirmDialog
          title={t('Use the classic layout?')}
          message={tn(pages.length,
            'This drops the {n} page of your layout; the app gets a dashboard plus one list page per entity. Undo brings the layout back.',
            'This drops the {n} pages of your layout; the app gets a dashboard plus one list page per entity. Undo brings the layout back.')}
          confirmLabel={t('Use classic layout')}
          tone="danger"
          onConfirm={() => { setConfirmClassic(false); onClear() }}
          onCancel={() => setConfirmClassic(false)}
        />
      )}
    </section>
  )
}
