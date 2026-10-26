import { useEffect, useState } from 'react'
import type { FullstackDateRange, FullstackPageDef, FullstackWidgetDef } from '../../../types'
import { inputClass } from '../controls'
import { moveItem } from '../reorder'
import { useStableKeys } from '../rowKeys'
import { useDragReorder } from '../useDragReorder'
import {
  DATE_RANGES, REFRESH_CHOICES, reloads, MAX_WIDGETS, newWidget, pageLabel, retargetWidget, stripDateRange,
  widgetKindDisabledReason,
} from '../pageLayout'
import type { FormProps } from './formTypes'
import { COLLAPSE_WIDGETS_FROM, SMALL_BUTTON, WIDGET_KINDS } from './constants'
import { EntitySelect, Field, MiniField } from './fields'
import { WidgetCard } from './WidgetCard'

export function DashboardForm({ page, index, pages, projectOpts, entities, errors, update, dnd, lossy, removed, expandRequest }: FormProps & {
  pages: FullstackPageDef[]
  /** The project-wide scaffold opts — a list widget's audit columns exist only with `audit` on. */
  projectOpts: string[]
  dnd: ReturnType<typeof useDragReorder>
  /** A problem click about widget `widget` of this page: open that card (a new `n` per click). */
  expandRequest?: { widget: number; n: number } | null
}) {
  const widgets = page.widgets ?? []
  const list = `widgets:${index}`
  const keys = useStableKeys(widgets, w => `${w.kind}:${w.entity}:${w.groupBy ?? ''}:${w.title ?? ''}`)
  const atCap = widgets.length >= MAX_WIDGETS
  // "Add widget" opens a gallery: pick the entity, then a kind — each kind says why it would
  // not fit that entity, so the widget is valid on sight.
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryEntity, setGalleryEntity] = useState('')
  const galleryPick = entities.find(e => e.name === galleryEntity)
  function openGallery() {
    // Start from the last widget's entity — the likeliest next one — else the first entity.
    const last = [...widgets].reverse().find(w => w.entity && entities.some(e => e.name === w.entity))?.entity
    setGalleryEntity(last ?? entities[0]?.name ?? '')
    setGalleryOpen(o => !o)
  }
  function addWidget(kind: FullstackWidgetDef['kind']) {
    setGalleryOpen(false)
    update(index, { widgets: [...widgets, newWidget(kind, galleryEntity, pages.filter(p => p !== page))] })
  }
  // Cards start collapsed on a busy dashboard so the list scans as one line per widget; a new or
  // re-kinded widget opens, and so does the card a problem points at. Keyed by row key, so a
  // reorder keeps each card's state.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(widgets.length >= COLLAPSE_WIDGETS_FROM ? keys : []))
  const setOpen = (key: string | undefined, open: boolean) => {
    if (!key) return
    setCollapsed(prev => {
      const next = new Set(prev)
      if (open) next.delete(key)
      else next.add(key)
      return next
    })
  }
  useEffect(() => {
    if (expandRequest) setOpen(keys[expandRequest.widget], true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new click is a new `n`
  }, [expandRequest?.n])

  function setWidgets(next: FullstackWidgetDef[]) {
    update(index, { widgets: next })
  }
  function setWidget(wi: number, patch: Partial<FullstackWidgetDef>) {
    setWidgets(widgets.map((w, i) => (i === wi ? { ...w, ...patch } : w)))
  }
  /** A new kind or entity keeps what still fits; anything dropped is named, with an undo. */
  function retarget(wi: number, patch: { kind?: FullstackWidgetDef['kind']; entity?: string }) {
    const before = widgets[wi]
    if ((patch.kind ?? before.kind) === before.kind && (patch.entity ?? before.entity) === before.entity) return
    const { widget, dropped } = retargetWidget(before, patch, entities.find(e => e.name === (patch.entity ?? before.entity)))
    lossy(`Changed widget ${wi + 1} of “${pageLabel(page)}”`, dropped)
    setWidgets(widgets.map((w, i) => (i === wi ? widget : w)))
    // A card whose kind just changed shows different controls — open it.
    if (patch.kind) setOpen(keys[wi], true)
  }

  return (
    <div className="space-y-2">
      <Field
        label="Period picker"
        error={errors.dateRange}
        control="dateRange"
        hint={page.dateRange ? 'The dashboard opens on this period; widgets with a date follow the picker' : 'Off — every widget covers all rows'}
      >
        <select
          aria-label="Period picker"
          aria-invalid={Boolean(errors.dateRange)}
          value={page.dateRange ?? ''}
          onChange={e => {
            if (e.target.value) {
              update(index, { dateRange: e.target.value as FullstackDateRange })
              return
            }
            // A widget's date field and comparison only mean something under a picker.
            const { patch, dropped } = stripDateRange(page)
            lossy(`Switched the period picker off on “${pageLabel(page)}”`, dropped)
            update(index, patch)
          }}
          className={`${inputClass(errors.dateRange)} max-w-[14rem]`}
        >
          <option value="">Off</option>
          {DATE_RANGES.map(r => <option key={r.value} value={r.value}>Opens on: {r.label}</option>)}
        </select>
      </Field>
      <Field
        label="Auto-refresh"
        error={errors.refreshSeconds}
        control="refreshSeconds"
        hint={(page.widgets ?? []).some(reloads)
          ? page.refreshSeconds ? 'The widgets reload on this timer while the page is open; Refresh reloads them any time' : 'Off — the generated Refresh button reloads the widgets'
          : 'Add a widget that shows data first'}
      >
        <select
          aria-label="Auto-refresh"
          aria-invalid={Boolean(errors.refreshSeconds)}
          value={page.refreshSeconds ?? ''}
          disabled={!(page.widgets ?? []).some(reloads) && page.refreshSeconds == null}
          onChange={e => update(index, { refreshSeconds: e.target.value ? Number(e.target.value) : undefined })}
          className={`${inputClass(errors.refreshSeconds)} max-w-[14rem]`}
        >
          <option value="">Off</option>
          {REFRESH_CHOICES.map(r => <option key={r.value} value={r.value}>Reload {r.label}</option>)}
        </select>
      </Field>
      <div className="space-y-2" data-control="widgets">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
            Widgets <span className="font-normal normal-case tracking-normal">· laid out left to right on a four-column grid</span>
          </p>
          {widgets.length > 1 && (
            <span className="inline-flex items-center gap-2 text-[11px]">
              <button type="button" onClick={() => setCollapsed(new Set())} className="font-semibold text-primary hover:underline" disabled={collapsed.size === 0}>
                Expand all
              </button>
              <button type="button" onClick={() => setCollapsed(new Set(keys))} className="font-semibold text-primary hover:underline" disabled={collapsed.size === widgets.length}>
                Collapse all
              </button>
            </span>
          )}
        </div>
        {errors.widgets && <p className="text-[11px] text-error">{errors.widgets}</p>}
        {widgets.map((widget, wi) => (
          <WidgetCard
            key={keys[wi]}
            widget={widget}
            wi={wi}
            count={widgets.length}
            pages={pages.filter(p => p !== page)}
            projectOpts={projectOpts}
            entities={entities}
            dateRange={page.dateRange}
            errors={errors}
            atCap={atCap}
            dnd={dnd}
            list={list}
            expanded={!collapsed.has(keys[wi])}
            onToggle={() => setOpen(keys[wi], collapsed.has(keys[wi]))}
            onChange={patch => setWidget(wi, patch)}
            onRetarget={patch => retarget(wi, patch)}
            onMove={delta => setWidgets(moveItem(widgets, wi, wi + delta))}
            onDuplicate={() => {
              const next = [...widgets]
              next.splice(wi + 1, 0, { ...widget })
              setWidgets(next)
            }}
            onRemove={() => {
              removed?.(`Removed widget ${wi + 1} (${WIDGET_KINDS.find(k => k.kind === widget.kind)?.label ?? widget.kind}) from “${pageLabel(page)}”`)
              setWidgets(widgets.filter((_, i) => i !== wi))
            }}
          />
        ))}
        <button
          type="button"
          onClick={openGallery}
          aria-expanded={galleryOpen}
          disabled={atCap}
          className={SMALL_BUTTON}
          title={atCap ? `A dashboard can have at most ${MAX_WIDGETS} widgets` : 'Pick a kind of widget and the entity it reads'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          Add widget
        </button>
        {galleryOpen && !atCap && (
          <div className="space-y-2 rounded-lg border border-outline-variant p-2" data-widget-gallery>
            <MiniField label="Entity the widget reads">
              <EntitySelect
                label="New widget entity"
                value={galleryEntity}
                options={entities.map(e => e.name)}
                className="max-w-[12rem]"
                onChange={setGalleryEntity}
              />
            </MiniField>
            <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
              {WIDGET_KINDS.map(k => {
                const reason = widgetKindDisabledReason(k.kind, galleryPick)
                return (
                  <li key={k.kind}>
                    <button
                      type="button"
                      onClick={() => addWidget(k.kind)}
                      disabled={Boolean(reason)}
                      aria-label={`Add ${k.label.toLowerCase()}`}
                      title={reason ?? k.hint}
                      className="h-full w-full rounded-lg border border-outline-variant px-2.5 py-2 text-start transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-outline-variant disabled:hover:bg-transparent"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }} aria-hidden="true">{k.icon}</span>
                        {k.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-secondary">{reason ?? k.hint}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
