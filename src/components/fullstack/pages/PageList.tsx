import type { FullstackEntityDef, FullstackPageDef, FullstackPageType } from '../../../types'
import type { LayoutPreview as LayoutPreviewModel } from '../layoutPreviewModel'
import type { EditTarget } from '../LayoutPreview'
import { moveItem } from '../reorder'
import { useDragReorder } from '../useDragReorder'
import {
  MAX_PAGES, PAGE_TYPE_META, describePage, canDuplicate, inNav, pageLabel,
  type PageLayoutValidation,
} from '../pageLayout'
import type { Lossy, Removed, Update } from './formTypes'
import { CHIP, ICON_BUTTON } from './constants'
import { MoveButtons, RolesField } from './fields'
import { PageBasicsFields, PageTypeForm } from './PageSettings'
import { t, tn } from '../../../i18n'

interface PageListProps {
  pages: FullstackPageDef[]
  keys: string[]
  /** Page ids picked for a bulk action, and how a row's checkbox toggles one. */
  picked: string[]
  onTogglePick: (id: string) => void
  validation: PageLayoutValidation
  openKey: string | null
  dnd: ReturnType<typeof useDragReorder>
  preview: LayoutPreviewModel
  previewIndex: number
  showPreview: boolean
  matchesQuery: (page: FullstackPageDef) => boolean
  setHoverTo: (next: EditTarget | null) => void
  targetOf: (node: EventTarget | null) => EditTarget | null
  hoverFocused: () => void
  move: (index: number, delta: number) => void
  openPage: (index: number | null) => void
  pushUndo: (label: string) => void
  onChange: (next: FullstackPageDef[]) => void
  update: Update
  atPageCap: boolean
  duplicate: (index: number) => void
  requestRemove: (index: number) => void
  saveAsTemplate: (page: FullstackPageDef) => void
  changeType: (index: number, type: FullstackPageType) => void
  switchBlocked: (page: FullstackPageDef, type: FullstackPageType) => { short: string; reason: string } | undefined
  retitle: (index: number, title: string) => void
  unlockId: (index: number) => void
  ldapAuth?: boolean
  onAddDep?: (dep: string) => void
  named: FullstackEntityDef[]
  lossy: Lossy
  removed: Removed
  projectOpts: string[]
  expandRequest: { page: number; widget: number; n: number } | null
}

/** The layout's pages, in nav order: one row each, opening to its title, route, nav and per-type form. */
export function PageList({ pages, keys, picked, onTogglePick, validation, openKey, dnd, preview, previewIndex, showPreview, matchesQuery, setHoverTo, targetOf, hoverFocused, move, openPage, pushUndo, onChange, update, atPageCap, duplicate, requestRemove, saveAsTemplate, changeType, switchBlocked, retitle, unlockId, ldapAuth, onAddDep, named, lossy, removed, projectOpts, expandRequest }: PageListProps) {
  return (
    <ol
      className="min-w-0 space-y-2"
      onMouseOver={e => setHoverTo(targetOf(e.target))}
      onMouseLeave={hoverFocused}
      onFocus={e => setHoverTo(targetOf(e.target))}
      onBlur={hoverFocused}
    >
      {pages.map((page, index) => {
        const key = keys[index]
        const meta = PAGE_TYPE_META[page.type] ?? { icon: 'web_asset', label: page.type, blurb: '' }
        const errors = validation.byPage[index] ?? {}
        const errorCount = Object.keys(errors).length
        const warningCount = validation.warningsByPage[index] ?? 0
        const open = openKey === key
        const indicator = dnd.indicatorFor('pages', index)
        const isStart = preview.nav[0]?.index === index
        if (!matchesQuery(page)) return null
        return (
          <li
            key={key}
            {...dnd.rowProps('pages', index)}
            data-page-id={page.id}
            data-page-key={key}
            className={`rounded-lg border px-2.5 py-2 ${errorCount ? 'border-error/50' : previewIndex === index && showPreview ? 'border-primary/50' : 'border-outline-variant'} ${
              dnd.isDragging('pages', index) ? 'opacity-40' : ''
            } ${indicator === 'before' ? 'border-t-2 border-t-primary' : ''} ${indicator === 'after' ? 'border-b-2 border-b-primary' : ''}`}
          >
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={picked.includes(page.id)}
                onChange={() => onTogglePick(page.id)}
                aria-label={t('Pick “{page}” for a bulk action', { page: pageLabel(page) })}
                title={t('Pick for a bulk action (hide, group, roles, duplicate, delete)')}
                className="h-3.5 w-3.5 accent-primary"
                data-page-pick
              />
              <span
                {...dnd.handleProps('pages', index)}
                className="cursor-grab select-none text-secondary/70 hover:text-secondary"
                title={t('Drag to reorder')}
                aria-hidden="true"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>drag_indicator</span>
              </span>
              <MoveButtons
                label={pageLabel(page)}
                canUp={index > 0}
                canDown={index < pages.length - 1}
                onMove={delta => move(index, delta)}
              />
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: '18px' }} aria-hidden="true">{meta.icon}</span>
              <button
                type="button"
                onClick={() => openPage(open ? null : index)}
                aria-expanded={open}
                data-page-toggle
                className="flex min-w-0 flex-1 items-center gap-1.5 text-start"
              >
                <span className="truncate text-xs font-semibold text-on-surface">{pageLabel(page)}</span>
                <span className={`${CHIP} bg-primary/10 text-primary`}>{meta.label}</span>
                {isStart && (
                  <span className={`${CHIP} bg-amber-400/15 text-amber-700 dark:text-amber-300`} title={t('The generated app opens on this page')} data-start-page>
                    {t('Start page')}
                  </span>
                )}
                {(page.roles?.length ?? 0) > 0 && (
                  <span className={`${CHIP} bg-surface-container text-secondary`} title={t('Only users with these roles see this page')} data-page-roles>
                    <span className="material-symbols-outlined align-[-2px]" style={{ fontSize: '11px' }} aria-hidden="true">lock</span> {page.roles!.join(' / ')}
                  </span>
                )}
                {page.hidden && page.type !== 'record' && (
                  page.type === 'wizard' || page.type === 'form'
                    ? <span className={`${CHIP} bg-surface-container text-secondary`} title={t('Hidden from the navigation — opened from a Page links widget or a list’s New button')}>{t('Link only')}</span>
                    : <span className={`${CHIP} bg-surface-container text-secondary`} title={t('Hidden from the navigation — opens inside a tabs page')}>{t('Tab only')}</span>
                )}
                {page.type === 'record' && (
                  <span className={`${CHIP} bg-surface-container text-secondary`} title={t('Record pages open from a row, so they are never in the navigation')}>
                    {t('From a row')}
                  </span>
                )}
                {errorCount > 0 && (
                  <span className={`${CHIP} bg-error/10 text-error`} data-page-errors>
                    {tn(errorCount, '{n} problem', '{n} problems')}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className={`${CHIP} bg-amber-400/15 text-amber-700 dark:text-amber-300`} title={t('The layout warnings above say what to check')} data-page-warnings>
                    {tn(warningCount, '{n} warning', '{n} warnings')}
                  </span>
                )}
                <span className="truncate text-[11px] text-secondary">{describePage(page, pages)}</span>
              </button>
              {inNav(page) && !isStart && (
                <button
                  type="button"
                  onClick={() => {
                    pushUndo(t('Made “{page}” the start page', { page: pageLabel(page) }))
                    onChange(moveItem(pages, index, preview.nav[0]?.index ?? 0))
                  }}
                  className={ICON_BUTTON}
                  title={t('Make this the start page (the app opens here)')}
                  aria-label={t('Make {page} the start page', { page: pageLabel(page) })}
                  data-make-start
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>home</span>
                </button>
              )}
              {page.type !== 'record' && (
                <button
                  type="button"
                  onClick={() => update(index, page.hidden ? { hidden: false } : { hidden: true, group: undefined, icon: undefined })}
                  className={ICON_BUTTON}
                  aria-pressed={Boolean(page.hidden)}
                  title={page.hidden ? t('Show in the navigation') : page.type === 'wizard' || page.type === 'form' ? t('Hide from the navigation (link only)') : t('Hide from the navigation (tab only)')}
                  aria-label={page.hidden ? t('Show {page} in the navigation', { page: pageLabel(page) }) : t('Hide {page} from the navigation', { page: pageLabel(page) })}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {page.hidden ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              )}
              {canDuplicate(page) && (
                <button
                  type="button"
                  onClick={() => duplicate(index)}
                  disabled={atPageCap}
                  className={ICON_BUTTON}
                  title={atPageCap ? t('A layout can have at most {max} pages', { max: MAX_PAGES }) : t('Duplicate this page')}
                  aria-label={t('Duplicate {page}', { page: pageLabel(page) })}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => requestRemove(index)}
                className={`${ICON_BUTTON} hover:text-error hover:bg-error/5`}
                title={t('Remove this page')}
                aria-label={t('Remove {page}', { page: pageLabel(page) })}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
              </button>
            </div>

            {open && (
              <div className="@container mt-2 space-y-3 border-t border-outline-variant pt-2">
                <PageBasicsFields
                  page={page}
                  index={index}
                  pageKey={key}
                  pages={pages}
                  errors={errors}
                  isStart={isStart}
                  update={update}
                  changeType={changeType}
                  switchBlocked={switchBlocked}
                  retitle={retitle}
                  unlockId={unlockId}
                  saveAsTemplate={saveAsTemplate}
                />
                <RolesField page={page} index={index} errors={errors} update={update} ldapAuth={ldapAuth} onAddDep={onAddDep} isStart={isStart} />
                <PageTypeForm
                  page={page}
                  index={index}
                  pages={pages}
                  named={named}
                  errors={errors}
                  update={update}
                  lossy={lossy}
                  removed={removed}
                  dnd={dnd}
                  projectOpts={projectOpts}
                  pushUndo={pushUndo}
                  onChange={onChange}
                  expandRequest={expandRequest?.page === index ? expandRequest : null}
                />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
