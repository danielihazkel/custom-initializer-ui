import type { FullstackPageDef } from '../../../types'
import { inputClass } from '../controls'
import { moveItem } from '../reorder'
import { dropIndicatorClass, useDragReorder } from '../useDragReorder'
import { MAX_TABS, MAX_TITLE, pageLabel } from '../pageLayout'
import type { FormProps } from './formTypes'
import { ICON_BUTTON, SMALL_BUTTON } from './constants'
import { DragGrip, MoveButtons } from './fields'

export function TabsForm({ page, index, pages, errors, update, dnd, removed }: Omit<FormProps, 'entities' | 'lossy'> & { pages: FullstackPageDef[]; dnd: ReturnType<typeof useDragReorder> }) {
  const tabs = page.tabs ?? []
  const targets = pages.filter(p => p.id !== page.id && p.type !== 'tabs' && p.type !== 'record')
  const nextTarget = targets.find(t => !tabs.some(x => x.page === t.id))
  const setTabs = (next: { title?: string; page: string }[]) => update(index, { tabs: next })

  return (
    <div className="space-y-1" data-control="tabs">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Tabs</p>
      {errors.tabs && <p className="text-[11px] text-error">{errors.tabs}</p>}
      {tabs.map((tab, ti) => {
        const error = errors[`tab.${ti}`]
        return (
          <div
            key={`${ti}:${tab.page}`}
            {...dnd.rowProps(`tabs:${index}`, ti)}
            className={`flex items-center gap-2 rounded ${dnd.isDragging(`tabs:${index}`, ti) ? 'opacity-40' : ''} ${dropIndicatorClass(dnd.indicatorFor(`tabs:${index}`, ti))}`}
            data-tab={ti}
            data-control={`tab.${ti}`}
          >
            <DragGrip dnd={dnd} list={`tabs:${index}`} index={ti} />
            <MoveButtons
              label={`tab ${ti + 1}`}
              canUp={ti > 0}
              canDown={ti < tabs.length - 1}
              onMove={delta => setTabs(moveItem(tabs, ti, ti + delta))}
            />
            <select
              aria-label={`Tab ${ti + 1} page`}
              aria-invalid={Boolean(error)}
              value={tab.page}
              onChange={e => setTabs(tabs.map((t, i) => (i === ti ? { ...t, page: e.target.value } : t)))}
              className={`${inputClass(error)} max-w-[14rem] py-1 text-xs`}
            >
              <option value="">— pick a page —</option>
              {targets.map(t => <option key={t.id} value={t.id}>{pageLabel(t)} ({t.id})</option>)}
              {tab.page && !targets.some(t => t.id === tab.page) && <option value={tab.page}>{tab.page}</option>}
            </select>
            <input
              type="text"
              aria-label={`Tab ${ti + 1} title`}
              value={tab.title ?? ''}
              maxLength={MAX_TITLE}
              placeholder="Tab label (optional)"
              onChange={e => setTabs(tabs.map((t, i) => (i === ti ? { ...t, title: e.target.value || undefined } : t)))}
              className={`${inputClass()} max-w-[12rem] py-1 text-xs`}
            />
            <button
              type="button"
              onClick={() => {
                const target = pages.find(p => p.id === tab.page)
                removed?.(`Removed the “${tab.title || (target ? pageLabel(target) : tab.page)}” tab from “${pageLabel(page)}”`,
                  target?.hidden ? 'its page stays in the layout, hidden' : undefined)
                setTabs(tabs.filter((_, i) => i !== ti))
              }}
              className={ICON_BUTTON}
              aria-label={`Remove tab ${ti + 1}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
            {error && <span className="text-[11px] text-error">{error}</span>}
          </div>
        )
      })}
      {tabs.length < MAX_TABS && (
        <button
          type="button"
          onClick={() => nextTarget && setTabs([...tabs, { page: nextTarget.id }])}
          disabled={!nextTarget}
          className={SMALL_BUTTON}
          title={nextTarget ? undefined : 'Every page that can be a tab is already one — add a list, dashboard, report or master-detail page first'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          Add tab
        </button>
      )}
      {targets.some(t => !t.hidden) && (
        <p className="text-[11px] text-secondary">
          Tip: hide the embedded pages (eye button) so they appear only here, not also in the navigation.
        </p>
      )}
    </div>
  )
}
