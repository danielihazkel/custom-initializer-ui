import { useRef, useState, type Ref } from 'react'
import type { FullstackPageDef, FullstackStarterRequest, FullstackWidgetDef, TeamTemplate } from '../../../types'
import { MAX_PAGES, MAX_WIDGETS, PAGE_TYPE_META, canDuplicate, inNav, pageLabel } from '../pageLayout'
import { ICON_BUTTON, SMALL_BUTTON, WIDGET_KINDS } from '../pages/constants'
import { RolesField } from '../pages/fields'
import { PageBasicsFields, PageTypeForm } from '../pages/PageSettings'
import type { PagesModel } from '../pages/usePagesModel'
import { WidgetCard } from '../pages/WidgetCard'
import { widgetName, type WidgetClip } from '../widgetClipboard'
import { DesignerMenu } from './DesignerMenu'
import { PageCode } from './PageCode'

export type InspectorTab = 'basics' | 'layout' | 'access' | 'code'

/** Which inspector tab holds a page control (the keys the validator and the canvas use). */
export function tabOfControl(control: string | undefined): InspectorTab {
  if (!control) return 'basics'
  if (['type', 'title', 'id', 'description', 'group', 'icon'].includes(control)) return 'basics'
  if (control === 'roles') return 'access'
  return 'layout'
}

/**
 * The right-hand pane: the selected widget's settings, or else the selected page's — its basics
 * (type, title, route, place in the navigation), its type's own layout, who may open it and —
 * given the request to preview — the code it generates.
 */
export function DesignerInspector({ pages, model, index, widget, tab, onTab, onDeselectWidget, ldapAuth, onAddDep, rootRef, codeRequest, problems = 0, clip = null, onCopyWidgets, onPasteWidgets, onMoveWidget, onSharePage, onShareWidget, teamHas }: {
  pages: FullstackPageDef[]
  model: PagesModel
  index: number
  /** The selected widget of a dashboard, or null for the page itself. */
  widget: number | null
  tab: InspectorTab
  onTab: (tab: InspectorTab) => void
  onDeselectWidget: () => void
  ldapAuth?: boolean
  onAddDep?: (dep: string) => void
  rootRef?: Ref<HTMLElement>
  /** Builds the request for the model as it stands; present, the page gets a Code tab. */
  codeRequest?: () => FullstackStarterRequest
  /** The layout's problems — the Code tab waits for them to be fixed. */
  problems?: number
  /** Copied widgets, and the clipboard actions: copy the selected widget (or, on the page, all of
   *  them), paste onto this dashboard, move the selected widget to dashboard `to`. */
  clip?: WidgetClip | null
  onCopyWidgets?: () => void
  onPasteWidgets?: () => void
  onMoveWidget?: (to: number) => void
  /** Share the page, or the selected widget, with the team; `teamHas` says whether that replaces one. */
  onSharePage?: () => void
  onShareWidget?: (widget: FullstackWidgetDef) => void
  teamHas?: (kind: TeamTemplate['kind'], name: string) => boolean
}) {
  const [moveOpen, setMoveOpen] = useState(false)
  const moveRef = useRef<HTMLButtonElement>(null)
  const page = pages[index]
  const key = model.keys[index] ?? ''
  if (!page) {
    return (
      <aside ref={rootRef} className="border-outline-variant bg-surface-container-lowest p-4 text-[11px] text-secondary lg:w-[22rem] lg:shrink-0 lg:border-s" aria-label="Inspector">
        No page yet — add one from the library.
      </aside>
    )
  }
  const errors = model.validationErrors(index)
  const isStart = model.preview.nav[0]?.index === index
  const meta = PAGE_TYPE_META[page.type]
  const widgetDef = widget != null ? page.widgets?.[widget] : undefined

  if (widgetDef && widget != null) {
    const kind = WIDGET_KINDS.find(k => k.kind === widgetDef.kind)
    const widgets = page.widgets ?? []
    const otherDashboards = pages.map((p, i) => ({ p, i })).filter(({ p, i }) => p.type === 'dashboard' && i !== index)
    return (
      <aside ref={rootRef} className="@container flex min-h-0 flex-col border-outline-variant bg-surface-container-lowest lg:w-[22rem] lg:shrink-0 lg:border-s" aria-label="Inspector" data-page-key={key} data-inspector="widget">
        <div className="space-y-2 border-b border-outline-variant px-4 py-3">
          <nav aria-label="Selection" className="flex items-center gap-1 text-[11px] text-secondary">
            <button type="button" onClick={onDeselectWidget} className="font-semibold text-primary hover:underline" title="Back to the page's own settings">{pageLabel(page)}</button>
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }} aria-hidden="true">chevron_right</span>
            <span className="truncate text-on-surface">Widget {widget + 1}</span>
          </nav>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined" style={{ fontSize: '19px' }} aria-hidden="true">{kind?.icon ?? 'widgets'}</span>
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-on-surface">{widgetDef.title || kind?.label || widgetDef.kind}</h2>
              <p className="truncate text-[11px] text-secondary">{kind?.label}{widgetDef.entity ? ` · ${widgetDef.entity}` : ''}</p>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <WidgetCard
            bare
            widget={widgetDef}
            wi={widget}
            count={widgets.length}
            pages={pages.filter(p => p !== page)}
            projectOpts={model.projectOpts}
            entities={model.named}
            dateRange={page.dateRange}
            errors={errors}
            atCap={widgets.length >= MAX_WIDGETS}
            dnd={model.dnd}
            list={`widgets:${index}`}
            expanded
            onToggle={() => {}}
            onChange={patch => model.setWidget(index, widget, patch)}
            onRetarget={patch => model.retargetWidgetAt(index, widget, patch)}
            onMove={delta => model.reorderWidget(index, widget, widget + delta)}
            onDuplicate={() => model.duplicateWidget(index, widget)}
            onRemove={() => model.removeWidget(index, widget)}
          />
        </div>
        <div className="relative flex flex-wrap gap-2 border-t border-outline-variant px-4 pt-3" data-widget-clipboard>
          {onCopyWidgets && (
            <button type="button" onClick={onCopyWidgets} className={SMALL_BUTTON} title="Copy this widget — Ctrl+V pastes it on any dashboard (Ctrl+C)">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">file_copy</span>
              Copy
            </button>
          )}
          {onMoveWidget && (
            <button
              ref={moveRef}
              type="button"
              onClick={() => setMoveOpen(o => !o)}
              disabled={otherDashboards.length === 0}
              aria-haspopup="menu"
              aria-expanded={moveOpen}
              className={SMALL_BUTTON}
              title={otherDashboards.length === 0 ? 'There is no other dashboard to move it to' : 'Move this widget to another dashboard'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">drive_file_move</span>
              Move to…
            </button>
          )}
          <button type="button" onClick={() => model.saveWidgetAsTemplate(widgetDef)} className={SMALL_BUTTON} title="Keep this widget in the library (My widgets), in this browser, for any dashboard">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">bookmark_add</span>
            Save as widget
          </button>
          {onShareWidget && (
            <button
              type="button"
              onClick={() => onShareWidget(widgetDef)}
              className={SMALL_BUTTON}
              title={teamHas?.('widget', widgetName(widgetDef)) ? `Replace the team's “${widgetName(widgetDef)}” with this one` : 'Share this widget with the team: everyone who opens the generator finds it in the library'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">group_add</span>
              {teamHas?.('widget', widgetName(widgetDef)) ? 'Update for team' : 'Share with team'}
            </button>
          )}
          {moveOpen && onMoveWidget && (
            <DesignerMenu
              label="Move to dashboard"
              heading="Move to dashboard"
              className="bottom-full start-4 mb-1"
              returnFocus={moveRef.current}
              onClose={() => setMoveOpen(false)}
              items={otherDashboards.map(({ p, i }) => ({
                key: p.id || String(i),
                label: pageLabel(p),
                icon: 'dashboard',
                disabled: (p.widgets?.length ?? 0) >= MAX_WIDGETS ? `At most ${MAX_WIDGETS} widgets` : undefined,
                onSelect: () => { setMoveOpen(false); onMoveWidget(i) },
              }))}
            />
          )}
        </div>
        <div className="flex gap-2 px-4 py-3">
          <button type="button" onClick={() => model.duplicateWidget(index, widget)} disabled={widgets.length >= MAX_WIDGETS} className={`${SMALL_BUTTON} flex-1 justify-center`}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">content_copy</span>
            Duplicate
          </button>
          <button type="button" onClick={() => { model.removeWidget(index, widget); onDeselectWidget() }} className={`${SMALL_BUTTON} flex-1 justify-center hover:!border-error/50 hover:!text-error`}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">delete</span>
            Remove widget
          </button>
        </div>
      </aside>
    )
  }

  const tabErrors = (t: InspectorTab) => Object.keys(errors).filter(k => tabOfControl(k.split('.')[0]) === t).length
  const tabs: { key: InspectorTab; label: string }[] = [
    { key: 'basics', label: 'Basics' },
    { key: 'layout', label: 'Layout' },
    { key: 'access', label: 'Access' },
    ...(codeRequest ? [{ key: 'code' as const, label: 'Code' }] : []),
  ]
  const showCode = tab === 'code' && codeRequest != null
  return (
    <aside ref={rootRef} className={`@container flex min-h-0 flex-col border-outline-variant bg-surface-container-lowest lg:shrink-0 lg:border-s ${showCode ? 'lg:w-[34rem]' : 'lg:w-[22rem]'}`} aria-label="Inspector" data-page-key={key} data-inspector="page">
      <div className="space-y-1 border-b border-outline-variant px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Page</p>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '19px' }} aria-hidden="true">{meta?.icon ?? 'web_asset'}</span>
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-on-surface">{pageLabel(page)}</h2>
          {inNav(page) && !isStart && (
            <button type="button" onClick={() => model.makeStart(index, model.preview.nav[0]?.index ?? 0)} className={ICON_BUTTON} title="Make this the start page (the app opens here)" aria-label={`Make ${pageLabel(page)} the start page`} data-make-start>
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>home</span>
            </button>
          )}
          {onSharePage && (
            <button
              type="button"
              onClick={onSharePage}
              className={ICON_BUTTON}
              title={teamHas?.('page', pageLabel(page)) ? `Replace the team's “${pageLabel(page)}” template with this page` : 'Share this page with the team as a template'}
              aria-label={teamHas?.('page', pageLabel(page)) ? `Update the team template “${pageLabel(page)}”` : `Share ${pageLabel(page)} with the team`}
              data-share-page
            >
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>group_add</span>
            </button>
          )}
          {page.type !== 'record' && (
            <button
              type="button"
              onClick={() => model.toggleHidden(index)}
              className={ICON_BUTTON}
              aria-pressed={Boolean(page.hidden)}
              title={page.hidden ? 'Show in the navigation' : 'Hide from the navigation'}
              aria-label={page.hidden ? `Show ${pageLabel(page)} in the navigation` : `Hide ${pageLabel(page)} from the navigation`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>{page.hidden ? 'visibility_off' : 'visibility'}</span>
            </button>
          )}
        </div>
        <p className="text-[11px] text-secondary">
          {meta?.label ?? page.type} · <span className="font-mono">#/{page.id || '…'}</span>
          {isStart && <span className="ms-1 font-semibold text-amber-600">· Start page</span>}
        </p>
      </div>
      <div role="tablist" aria-label="Page settings" className="flex gap-1 border-b border-outline-variant px-3">
        {tabs.map(t => {
          const n = tabErrors(t.key)
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => onTab(t.key)}
              className={`inline-flex items-center gap-1 border-b-2 px-2 py-2 text-xs ${tab === t.key ? 'border-primary font-semibold text-on-surface' : 'border-transparent text-secondary hover:text-on-surface'}`}
            >
              {t.label}
              {n > 0 && <span className="rounded-full bg-error/15 px-1.5 text-[10px] font-semibold text-error" aria-label={`${n} problem${n === 1 ? '' : 's'}`}>{n}</span>}
            </button>
          )
        })}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" role="tabpanel" aria-label={`Page settings: ${tab}`}>
        {tab === 'basics' && (
          <PageBasicsFields
            page={page}
            index={index}
            pageKey={key}
            pages={pages}
            errors={errors}
            isStart={isStart}
            update={model.update}
            changeType={model.changeType}
            switchBlocked={model.switchBlocked}
            retitle={model.retitle}
            unlockId={model.unlockId}
            saveAsTemplate={model.saveAsTemplate}
          />
        )}
        {tab === 'layout' && (
          <>
            {page.type === 'dashboard' && (
              <div className="space-y-2 rounded-lg bg-surface-container px-3 py-2 text-[11px] text-secondary">
                <p>Widgets: drag them from the library onto the canvas. Click one there to edit it.</p>
                {(onPasteWidgets && clip) || (onCopyWidgets && (page.widgets?.length ?? 0) > 0) ? (
                  <div className="flex flex-wrap gap-2" data-widget-clipboard>
                    {onCopyWidgets && (page.widgets?.length ?? 0) > 0 && (
                      <button type="button" onClick={onCopyWidgets} className={SMALL_BUTTON} title="Copy every widget of this dashboard (Ctrl+C with no widget selected)">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">file_copy</span>
                        Copy all widgets
                      </button>
                    )}
                    {onPasteWidgets && clip && (
                      <button type="button" onClick={onPasteWidgets} className={SMALL_BUTTON} title={`Paste what was copied from “${clip.from}” (Ctrl+V)`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">content_paste</span>
                        Paste {clip.widgets.length === 1 ? 'widget' : `${clip.widgets.length} widgets`}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            )}
            <PageTypeForm
              page={page}
              index={index}
              pages={pages}
              named={model.named}
              errors={errors}
              update={model.update}
              lossy={model.lossy}
              removed={model.removed}
              dnd={model.dnd}
              projectOpts={model.projectOpts}
              pushUndo={model.pushUndo}
              onChange={model.onChange}
              widgetsOnCanvas
            />
          </>
        )}
        {tab === 'access' && (
          <RolesField page={page} index={index} errors={errors} update={model.update} ldapAuth={ldapAuth} onAddDep={onAddDep} isStart={isStart} />
        )}
        {showCode && <PageCode page={page} pages={pages} request={codeRequest()} problems={problems} />}
      </div>
      <div className="flex gap-2 border-t border-outline-variant px-4 py-3">
        {canDuplicate(page) && (
          <button type="button" onClick={() => model.duplicate(index)} disabled={model.atPageCap} className={`${SMALL_BUTTON} flex-1 justify-center`} title={model.atPageCap ? `A layout can have at most ${MAX_PAGES} pages` : 'Duplicate this page'}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">content_copy</span>
            Duplicate page
          </button>
        )}
        <button type="button" onClick={() => model.requestRemove(index)} className={`${SMALL_BUTTON} flex-1 justify-center hover:!border-error/50 hover:!text-error`} aria-label={`Remove ${pageLabel(page)}`}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">delete</span>
          Delete page
        </button>
      </div>
    </aside>
  )
}
