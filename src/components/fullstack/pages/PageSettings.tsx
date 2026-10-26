import type { FullstackEntityDef, FullstackPageDef, FullstackPageType } from '../../../types'
import { inputClass } from '../controls'
import type { DragReorder } from '../useDragReorder'
import { PAGE_TYPE_META, MAX_DESCRIPTION, MAX_TITLE, inNav, pageLabel } from '../pageLayout'
import type { Lossy, Removed, Update } from './formTypes'
import { SMALL_BUTTON } from './constants'
import { Field } from './fields'
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

/**
 * Every page's own settings: its type, title, route, description and (in the navigation) group
 * and icon. Shared by the page list's rows and the layout designer's inspector.
 */
export function PageBasicsFields({ page, index, pageKey, pages, errors, isStart, update, changeType, switchBlocked, retitle, unlockId, saveAsTemplate }: {
  page: FullstackPageDef
  index: number
  /** The row key — keeps the type select's id unique per page. */
  pageKey: string
  pages: FullstackPageDef[]
  errors: Record<string, string>
  isStart: boolean
  update: Update
  changeType: (index: number, type: FullstackPageType) => void
  switchBlocked: (page: FullstackPageDef, type: FullstackPageType) => { short: string; reason: string } | undefined
  retitle: (index: number, title: string) => void
  unlockId: (index: number) => void
  saveAsTemplate: (page: FullstackPageDef) => void
}) {
  return (
    <>
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
        <label className="text-[11px] font-semibold uppercase tracking-wider text-secondary" htmlFor={`page-type-${pageKey}`}>Page type</label>
        <select
          id={`page-type-${pageKey}`}
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
      <div className="grid grid-cols-1 @sm:grid-cols-3 gap-2">
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
    </>
  )
}

/** The page type's own form — what a dashboard, list, report or other type is made of. */
export function PageTypeForm({ page, index, pages, named, errors, update, lossy, removed, dnd, projectOpts, pushUndo, onChange, expandRequest, widgetsOnCanvas }: {
  page: FullstackPageDef
  index: number
  pages: FullstackPageDef[]
  named: FullstackEntityDef[]
  errors: Record<string, string>
  update: Update
  lossy: Lossy
  removed: Removed
  dnd: DragReorder
  projectOpts: string[]
  pushUndo: (label: string) => void
  onChange: (next: FullstackPageDef[]) => void
  expandRequest?: { widget: number; n: number } | null
  /** The layout designer edits a dashboard's widgets on its canvas: the form keeps the page's own settings. */
  widgetsOnCanvas?: boolean
}) {
  switch (page.type) {
    case 'entity-list':
      return <EntityListForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} dnd={dnd} projectOpts={projectOpts} pages={pages} pushUndo={pushUndo} onChange={onChange} />
    case 'dashboard':
      return (
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
          expandRequest={expandRequest}
          widgetsOnCanvas={widgetsOnCanvas}
        />
      )
    case 'tabs':
      return <TabsForm page={page} index={index} pages={pages} errors={errors} update={update} dnd={dnd} removed={removed} />
    case 'master-detail':
      return <MasterDetailForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} projectOpts={projectOpts} />
    case 'record':
      return <RecordForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} removed={removed} dnd={dnd} projectOpts={projectOpts} />
    case 'report':
      return <ReportForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} removed={removed} dnd={dnd} />
    case 'wizard':
      return <WizardForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} removed={removed} dnd={dnd} />
    case 'calendar':
      return <CalendarForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} />
    case 'board':
      return <BoardForm page={page} index={index} entities={named} errors={errors} update={update} lossy={lossy} />
    case 'content':
      return <ContentForm page={page} index={index} pages={pages} errors={errors} update={update} />
    case 'import':
      return <ImportForm page={page} index={index} entities={named} errors={errors} update={update} />
    case 'search':
      return <SearchForm page={page} index={index} entities={named} errors={errors} update={update} />
    default:
      return null
  }
}
