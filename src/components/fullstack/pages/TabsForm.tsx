import type { FullstackPageDef } from '../../../types'
import { inputClass } from '../controls'
import { moveItem } from '../reorder'
import { dropIndicatorClass, useDragReorder } from '../useDragReorder'
import { MAX_TABS, MAX_TITLE, pageLabel } from '../pageLayout'
import type { FormProps } from './formTypes'
import { ICON_BUTTON, SMALL_BUTTON } from './constants'
import { DragGrip, MoveButtons } from './fields'
import { t } from '../../../i18n'

export function TabsForm({ page, index, pages, errors, update, dnd, removed }: Omit<FormProps, 'entities' | 'lossy'> & { pages: FullstackPageDef[]; dnd: ReturnType<typeof useDragReorder> }) {
  const tabs = page.tabs ?? []
  const targets = pages.filter(p => p.id !== page.id && p.type !== 'tabs' && p.type !== 'record')
  const nextTarget = targets.find(target => !tabs.some(x => x.page === target.id))
  const setTabs = (next: { title?: string; page: string }[]) => update(index, { tabs: next })

  return (
    <div className="space-y-1" data-control="tabs">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">{t('Tabs')}</p>
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
              label={t('tab {n}', { n: ti + 1 })}
              canUp={ti > 0}
              canDown={ti < tabs.length - 1}
              onMove={delta => setTabs(moveItem(tabs, ti, ti + delta))}
            />
            <select
              aria-label={t('Tab {n} page', { n: ti + 1 })}
              aria-invalid={Boolean(error)}
              value={tab.page}
              onChange={e => setTabs(tabs.map((x, i) => (i === ti ? { ...x, page: e.target.value } : x)))}
              className={`${inputClass(error)} max-w-[14rem] py-1 text-xs`}
            >
              <option value="">{t('— pick a page —')}</option>
              {targets.map(target => <option key={target.id} value={target.id}>{pageLabel(target)} ({target.id})</option>)}
              {tab.page && !targets.some(target => target.id === tab.page) && <option value={tab.page}>{tab.page}</option>}
            </select>
            <input
              type="text"
              aria-label={t('Tab {n} title', { n: ti + 1 })}
              value={tab.title ?? ''}
              maxLength={MAX_TITLE}
              placeholder={t('Tab label (optional)')}
              onChange={e => setTabs(tabs.map((x, i) => (i === ti ? { ...x, title: e.target.value || undefined } : x)))}
              className={`${inputClass()} max-w-[12rem] py-1 text-xs`}
            />
            <button
              type="button"
              onClick={() => {
                const target = pages.find(p => p.id === tab.page)
                removed?.(t('Removed the “{tab}” tab from “{page}”', { tab: tab.title || (target ? pageLabel(target) : tab.page), page: pageLabel(page) }),
                  target?.hidden ? t('its page stays in the layout, hidden') : undefined)
                setTabs(tabs.filter((_, i) => i !== ti))
              }}
              className={ICON_BUTTON}
              aria-label={t('Remove tab {n}', { n: ti + 1 })}
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
          title={nextTarget ? undefined : t('Every page that can be a tab is already one — add a list, dashboard, report or master-detail page first')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          {t('Add tab')}
        </button>
      )}
      {targets.some(target => !target.hidden) && (
        <p className="text-[11px] text-secondary">
          {t('Tip: hide the embedded pages (eye button) so they appear only here, not also in the navigation.')}
        </p>
      )}
    </div>
  )
}
