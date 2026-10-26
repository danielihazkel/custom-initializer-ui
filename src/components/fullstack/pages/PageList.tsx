import type { FullstackEntityDef, FullstackPageDef, FullstackPageType } from '../../../types'
import { inputClass } from '../controls'
import type { LayoutPreview as LayoutPreviewModel } from '../layoutPreviewModel'
import type { EditTarget } from '../LayoutPreview'
import { moveItem } from '../reorder'
import { useDragReorder } from '../useDragReorder'
import {
  MAX_PAGES, PAGE_TYPE_META, describePage, canDuplicate, MAX_DESCRIPTION, MAX_TITLE, inNav, pageLabel,
  type PageLayoutValidation,
} from '../pageLayout'
import type { Lossy, Removed, Update } from './formTypes'
import { CHIP, ICON_BUTTON, SMALL_BUTTON } from './constants'
import { Field, MoveButtons, RolesField } from './fields'
import { NavFields } from './NavFields'
import { EntityListForm } from './EntityListForm'
import { DashboardForm } from './DashboardForm'
import { ReportForm } from './ReportForm'
import { TabsForm } from './TabsForm'
import { MasterDetailForm } from './MasterDetailForm'
import { RecordForm } from './RecordForm'
import { WizardForm } from './WizardForm'
import { CalendarForm } from './CalendarForm'
import { BoardForm } from './BoardForm'
import { ContentForm } from './ContentForm'
import { ImportForm } from './ImportForm'
import { SearchForm } from './SearchForm'

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
                aria-label={`Pick “${pageLabel(page)}” for a bulk action`}
                title="Pick for a bulk action (hide, group, roles, duplicate, delete)"
                className="h-3.5 w-3.5 accent-primary"
                data-page-pick
              />
              <span
                {...dnd.handleProps('pages', index)}
                className="cursor-grab select-none text-secondary/70 hover:text-secondary"
                title="Drag to reorder"
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
                  <span className={`${CHIP} bg-amber-400/15 text-amber-700 dark:text-amber-300`} title="The generated app opens on this page" data-start-page>
                    Start page
                  </span>
                )}
                {(page.roles?.length ?? 0) > 0 && (
                  <span className={`${CHIP} bg-surface-container text-secondary`} title="Only users with these roles see this page" data-page-roles>
                    <span className="material-symbols-outlined align-[-2px]" style={{ fontSize: '11px' }} aria-hidden="true">lock</span> {page.roles!.join(' / ')}
                  </span>
                )}
                {page.hidden && page.type !== 'record' && (
                  page.type === 'wizard'
                    ? <span className={`${CHIP} bg-surface-container text-secondary`} title="Hidden from the navigation — opened from a Page links widget or a list’s New button">Link only</span>
                    : <span className={`${CHIP} bg-surface-container text-secondary`} title="Hidden from the navigation — opens inside a tabs page">Tab only</span>
                )}
                {page.type === 'record' && (
                  <span className={`${CHIP} bg-surface-container text-secondary`} title="Record pages open from a row, so they are never in the navigation">
                    From a row
                  </span>
                )}
                {errorCount > 0 && (
                  <span className={`${CHIP} bg-error/10 text-error`} data-page-errors>
                    {errorCount} problem{errorCount === 1 ? '' : 's'}
                  </span>
                )}
                {warningCount > 0 && (
                  <span className={`${CHIP} bg-amber-400/15 text-amber-700 dark:text-amber-300`} title="The layout warnings above say what to check" data-page-warnings>
                    {warningCount} warning{warningCount === 1 ? '' : 's'}
                  </span>
                )}
                <span className="truncate text-[11px] text-secondary">{describePage(page, pages)}</span>
              </button>
              {inNav(page) && !isStart && (
                <button
                  type="button"
                  onClick={() => {
                    pushUndo(`Made “${pageLabel(page)}” the start page`)
                    onChange(moveItem(pages, index, preview.nav[0]?.index ?? 0))
                  }}
                  className={ICON_BUTTON}
                  title="Make this the start page (the app opens here)"
                  aria-label={`Make ${pageLabel(page)} the start page`}
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
                  title={page.hidden ? 'Show in the navigation' : page.type === 'wizard' ? 'Hide from the navigation (link only)' : 'Hide from the navigation (tab only)'}
                  aria-label={page.hidden ? `Show ${pageLabel(page)} in the navigation` : `Hide ${pageLabel(page)} from the navigation`}
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
                  title={atPageCap ? `A layout can have at most ${MAX_PAGES} pages` : 'Duplicate this page'}
                  aria-label={`Duplicate ${pageLabel(page)}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => requestRemove(index)}
                className={`${ICON_BUTTON} hover:text-error hover:bg-error/5`}
                title="Remove this page"
                aria-label={`Remove ${pageLabel(page)}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
              </button>
            </div>

            {open && (
              <div className="mt-2 space-y-3 border-t border-outline-variant pt-2">
                <div className="flex flex-wrap items-center gap-2" data-control="type">
                  <button
                    type="button"
                    onClick={() => saveAsTemplate(page)}
                    className={`${SMALL_BUTTON} order-last ms-auto`}
                    title="Keep this page's settings to add it again later (this browser)"
                    data-save-template
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">bookmark_add</span>
                    Save as template
                  </button>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-secondary" htmlFor={`page-type-${key}`}>Page type</label>
                  <select
                    id={`page-type-${key}`}
                    aria-label="Page type"
                    value={page.type}
                    onChange={e => changeType(index, e.target.value as FullstackPageType)}
                    className={`${inputClass()} max-w-[12rem] py-1 text-xs`}
                    data-page-type
                  >
                    {(Object.keys(PAGE_TYPE_META) as FullstackPageType[]).map(t => {
                      const blocked = switchBlocked(page, t)
                      return <option key={t} value={t} disabled={blocked != null} title={blocked?.reason}>{PAGE_TYPE_META[t].label}{blocked ? ` — ${blocked.short}` : ''}</option>
                    })}
                  </select>
                  <span className="text-[10px] text-secondary">Changing the type keeps the title, place and entity; settings the new type cannot use are dropped (undoable)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Field label="Title" error={errors.title} control="title" hint={isStart ? 'The start page — the app opens here, for everyone' : undefined}>
                    <input
                      type="text"
                      aria-label="Page title"
                      aria-invalid={Boolean(errors.title)}
                      value={page.title ?? ''}
                      maxLength={MAX_TITLE}
                      onChange={e => retitle(index, e.target.value)}
                      placeholder={pageLabel(page)}
                      className={inputClass(errors.title)}
                    />
                  </Field>
                  <details className="space-y-1" data-control="id" data-page-id-details open={errors.id ? true : undefined}>
                    <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-secondary" title="The page's route — its address in the app (#/id) and its screen file name. Open to edit the id.">
                      Route <span className="font-mono normal-case tracking-normal text-on-surface">#/{page.id || '…'}</span>
                      <span className="ms-1 font-normal normal-case tracking-normal">· edit</span>
                    </summary>
                    <input
                      type="text"
                      aria-label="Page id"
                      aria-invalid={Boolean(errors.id)}
                      value={page.id}
                      onChange={e => update(index, { id: e.target.value, idLocked: true })}
                      className={`${inputClass(errors.id)} font-mono`}
                    />
                    {page.idLocked && page.type !== 'dashboard' && (
                      <button
                        type="button"
                        onClick={() => unlockId(index)}
                        className="mt-1 text-[11px] font-semibold text-primary hover:underline"
                        data-unlock-id
                      >
                        Follow the title again
                      </button>
                    )}
                    {errors.id
                      ? <p className="text-[11px] text-error">{errors.id}</p>
                      : <p className="text-[10px] text-secondary">{`${page.idLocked || page.type === 'dashboard' ? 'The URL and screen file' : 'Follows the title until you edit it'} · lower-case letters, digits and dashes`}</p>}
                  </details>
                  <Field label="Description" error={errors.description} control="description">
                    <input
                      type="text"
                      aria-label="Page description"
                      aria-invalid={Boolean(errors.description)}
                      value={page.description ?? ''}
                      maxLength={MAX_DESCRIPTION}
                      onChange={e => update(index, { description: e.target.value || undefined })}
                      placeholder="Optional line under the heading"
                      className={inputClass(errors.description)}
                    />
                  </Field>
                </div>
                {inNav(page) && (
                  <NavFields page={page} index={index} pages={pages} errors={errors} update={update} />
                )}
                <RolesField page={page} index={index} errors={errors} update={update} ldapAuth={ldapAuth} onAddDep={onAddDep} isStart={isStart} />

                {page.type === 'entity-list' && (
                  <EntityListForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} dnd={dnd} projectOpts={projectOpts} pages={pages} pushUndo={pushUndo} onChange={onChange} />
                )}
                {page.type === 'dashboard' && (
                  <DashboardForm
                    page={page}
                    index={index}
                    pages={pages}
                    projectOpts={projectOpts}
                    entities={named}
                    errors={errors}
                    update={update}
                    lossy={lossy}
                    removed={removed}
                    dnd={dnd}
                    expandRequest={expandRequest?.page === index ? expandRequest : null}
                  />
                )}
                {page.type === 'tabs' && (
                  <TabsForm page={page} index={index} pages={pages} errors={errors} update={update} dnd={dnd} removed={removed} />
                )}
                {page.type === 'master-detail' && (
                  <MasterDetailForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} projectOpts={projectOpts} />
                )}
                {page.type === 'record' && (
                  <RecordForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} removed={removed} dnd={dnd} projectOpts={projectOpts} />
                )}
                {page.type === 'report' && (
                  <ReportForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} removed={removed} dnd={dnd} />
                )}
                {page.type === 'wizard' && (
                  <WizardForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} removed={removed} dnd={dnd} />
                )}
                {page.type === 'calendar' && (
                  <CalendarForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} />
                )}
                {page.type === 'board' && (
                  <BoardForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} />
                )}
                {page.type === 'content' && (
                  <ContentForm page={page} index={index} pages={pages} errors={errors} update={update} />
                )}
                {page.type === 'import' && (
                  <ImportForm page={page} index={index} entities={named} errors={errors} update={update} />
                )}
                {page.type === 'search' && (
                  <SearchForm page={page} index={index} entities={named} errors={errors} update={update} />
                )}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
