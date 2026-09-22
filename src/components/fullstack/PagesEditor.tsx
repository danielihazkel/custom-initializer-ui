import { useState, type ReactNode } from 'react'
import type { FullstackEntityDef, FullstackPageDef, FullstackPageType, FullstackWidgetDef } from '../../types'
import { inputClass } from './controls'
import { moveItem } from './reorder'
import { useDragReorder } from './useDragReorder'
import {
  MAX_TABS,
  MAX_RECENT_LIMIT,
  PAGE_TYPE_META,
  describePage,
  groupableFields,
  pageLabel,
  relationsTo,
  seedLayout,
  slugify,
  uniquePageId,
  type PageLayoutValidation,
} from './pageLayout'

interface Props {
  pages: FullstackPageDef[]
  entities: FullstackEntityDef[]
  /** From validatePages — inline messages per control plus the problem list. */
  validation: PageLayoutValidation
  onChange: (next: FullstackPageDef[]) => void
  /** Records a labelled undo entry before a change that would be annoying to retype. */
  pushUndo: (label: string) => void
  /** Drops the layout, back to the classic shell. */
  onClear: () => void
}

const CHIP = 'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide'
const ICON_BUTTON = 'shrink-0 rounded-lg p-1.5 text-secondary hover:text-primary hover:bg-primary/5 transition-colors'
const SMALL_BUTTON = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant text-secondary hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors'

/**
 * The generated frontend's page layout: what screens the app has, in nav order. Without a layout
 * the generator falls back to the classic shell (a dashboard plus one list page per entity), which
 * "Start from my entities" materializes as an editable starting point.
 */
export function PagesEditor({ pages, entities, validation, onChange, pushUndo, onClear }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  // Ids follow the title until the user edits one by hand.
  const [customIds, setCustomIds] = useState<Set<string>>(new Set())

  const named = entities.filter(e => e.name.trim())
  const dnd = useDragReorder((list, from, to) => {
    if (list === 'pages') return onChange(moveItem(pages, from, to))
    const index = Number(list.slice('widgets:'.length))
    const page = pages[index]
    if (page) update(index, { widgets: moveItem(page.widgets ?? [], from, to) })
  })

  function update(index: number, patch: Partial<FullstackPageDef>) {
    onChange(pages.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  function retitle(index: number, title: string) {
    const page = pages[index]
    const keepsId = customIds.has(page.id) || page.type === 'dashboard'
    const patch: Partial<FullstackPageDef> = { title }
    if (!keepsId) {
      const slug = slugify(title)
      if (slug) patch.id = uniquePageId(slug, pages.filter((_, i) => i !== index).map(p => p.id))
    }
    update(index, patch)
  }

  function addPage(type: FullstackPageType) {
    setAddOpen(false)
    const taken = pages.map(p => p.id)
    const page = blankPage(type, named, taken)
    onChange([...pages, page])
    setOpenIndex(pages.length)
  }

  function removePage(index: number) {
    pushUndo(`Removed the “${pageLabel(pages[index])}” page`)
    onChange(pages.filter((_, i) => i !== index))
    setOpenIndex(null)
  }

  function startFromEntities() {
    pushUndo('Started a page layout from the entities')
    onChange(seedLayout(entities))
  }

  const problems = validation.problems

  return (
    <section
      id="fs-pages"
      className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 space-y-3"
      aria-label="Frontend page layout"
      data-page-layout
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-outlined text-primary mt-0.5" style={{ fontSize: '20px' }}>web</span>
          <div>
            <h2 className="text-sm font-bold text-on-surface">Frontend pages</h2>
            <p className="text-[11px] text-secondary">
              The generated app opens on the first page; hidden pages appear only inside a tabs page, and a record
              page opens from a row of its entity.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pages.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className={SMALL_BUTTON}
              title="Generate the default dashboard plus one list page per entity instead"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>restart_alt</span>
              Use classic layout
            </button>
          )}
          <button
            type="button"
            onClick={() => setAddOpen(o => !o)}
            aria-expanded={addOpen}
            disabled={named.length === 0}
            className={`${SMALL_BUTTON} disabled:opacity-40`}
            title={named.length === 0 ? 'Name an entity first' : 'Add a page to the layout'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
            Add page
          </button>
        </div>
      </div>

      {addOpen && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" data-page-gallery>
          {(Object.keys(PAGE_TYPE_META) as FullstackPageType[]).map(type => {
            const meta = PAGE_TYPE_META[type]
            return (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => addPage(type)}
                  className="w-full h-full text-start rounded-lg border border-outline-variant px-3 py-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }}>{meta.icon}</span>
                    {meta.label}
                  </span>
                  <span className="block mt-0.5 text-[11px] text-secondary">{meta.blurb}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {problems.length > 0 && (
        <ul className="rounded-lg border border-error/40 bg-error/5 px-3 py-2 space-y-1" role="alert" data-page-layout-problems>
          {problems.map(p => (
            <li key={p} className="flex items-start gap-1.5 text-[11px] text-error">
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>error</span>
              {p}
            </li>
          ))}
        </ul>
      )}

      {pages.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-outline-variant px-3 py-3">
          <p className="text-[11px] text-secondary">
            <span className="font-semibold text-on-surface">Classic layout</span> — a dashboard plus one list page per entity.
          </p>
          <button
            type="button"
            onClick={startFromEntities}
            disabled={named.length === 0}
            className={`${SMALL_BUTTON} disabled:opacity-40`}
            data-seed-layout
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>auto_awesome</span>
            Start from my entities
          </button>
        </div>
      ) : (
        <ol className="space-y-2">
          {pages.map((page, index) => {
            const meta = PAGE_TYPE_META[page.type] ?? { icon: 'web_asset', label: page.type, blurb: '' }
            const errors = validation.byPage[index] ?? {}
            const errorCount = Object.keys(errors).length
            const open = openIndex === index
            const indicator = dnd.indicatorFor('pages', index)
            return (
              <li
                key={index}
                {...dnd.rowProps('pages', index)}
                data-page-id={page.id}
                className={`rounded-lg border px-2.5 py-2 ${errorCount ? 'border-error/50' : 'border-outline-variant'} ${
                  dnd.isDragging('pages', index) ? 'opacity-40' : ''
                } ${indicator === 'before' ? 'border-t-2 border-t-primary' : ''} ${indicator === 'after' ? 'border-b-2 border-b-primary' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    {...dnd.handleProps('pages', index)}
                    className="cursor-grab select-none text-secondary/70 hover:text-secondary"
                    title="Drag to reorder"
                    aria-label={`Reorder ${pageLabel(page)}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>drag_indicator</span>
                  </span>
                  <span className="material-symbols-outlined text-secondary" style={{ fontSize: '18px' }}>{meta.icon}</span>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(open ? null : index)}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-start"
                  >
                    <span className="truncate text-xs font-semibold text-on-surface">{pageLabel(page)}</span>
                    <span className={`${CHIP} bg-primary/10 text-primary`}>{meta.label}</span>
                    {page.hidden && page.type !== 'record' && (
                      <span className={`${CHIP} bg-surface-container text-secondary`}>Tab only</span>
                    )}
                    {errorCount > 0 && (
                      <span className={`${CHIP} bg-error/10 text-error`} data-page-errors>
                        {errorCount} problem{errorCount === 1 ? '' : 's'}
                      </span>
                    )}
                    <span className="truncate text-[11px] text-secondary">{describePage(page, pages)}</span>
                  </button>
                  {page.type !== 'record' && (
                    <button
                      type="button"
                      onClick={() => update(index, { hidden: !page.hidden })}
                      className={ICON_BUTTON}
                      aria-pressed={Boolean(page.hidden)}
                      title={page.hidden ? 'Show in the navigation' : 'Hide from the navigation (tab only)'}
                      aria-label={page.hidden ? `Show ${pageLabel(page)} in the navigation` : `Hide ${pageLabel(page)} from the navigation`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {page.hidden ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removePage(index)}
                    className={`${ICON_BUTTON} hover:text-error hover:bg-error/5`}
                    title="Remove this page"
                    aria-label={`Remove ${pageLabel(page)}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                  </button>
                </div>

                {open && (
                  <div className="mt-2 space-y-3 border-t border-outline-variant pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Field label="Title" error={errors.title}>
                        <input
                          type="text"
                          aria-label="Page title"
                          value={page.title ?? ''}
                          onChange={e => retitle(index, e.target.value)}
                          placeholder={pageLabel(page)}
                          className={inputClass(errors.title)}
                        />
                      </Field>
                      <Field label="Id" error={errors.id} hint="The screen file name and the nav id">
                        <input
                          type="text"
                          aria-label="Page id"
                          value={page.id}
                          onChange={e => {
                            setCustomIds(prev => new Set(prev).add(e.target.value))
                            update(index, { id: e.target.value })
                          }}
                          className={`${inputClass(errors.id)} font-mono`}
                        />
                      </Field>
                      <Field label="Description" error={errors.description}>
                        <input
                          type="text"
                          aria-label="Page description"
                          value={page.description ?? ''}
                          onChange={e => update(index, { description: e.target.value || undefined })}
                          placeholder="Optional line under the heading"
                          className={inputClass(errors.description)}
                        />
                      </Field>
                    </div>

                    {page.type === 'entity-list' && (
                      <EntityListForm page={page} index={index} entities={named} errors={errors} update={update} />
                    )}
                    {page.type === 'dashboard' && (
                      <DashboardForm page={page} index={index} entities={named} errors={errors} update={update} dnd={dnd} />
                    )}
                    {page.type === 'tabs' && (
                      <TabsForm page={page} index={index} pages={pages} errors={errors} update={update} />
                    )}
                    {page.type === 'master-detail' && (
                      <MasterDetailForm page={page} index={index} entities={named} errors={errors} update={update} />
                    )}
                    {page.type === 'record' && (
                      <RecordForm page={page} index={index} entities={named} errors={errors} update={update} />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

// ── Per-type forms ─────────────────────────────────────────────────────────

type Update = (index: number, patch: Partial<FullstackPageDef>) => void
interface FormProps {
  page: FullstackPageDef
  index: number
  entities: FullstackEntityDef[]
  errors: Record<string, string>
  update: Update
}

function EntityListForm({ page, index, entities, errors, update }: FormProps) {
  const entity = entities.find(e => e.name === page.entity)
  const filterable = groupableFields(entity)
  const filters = Object.entries(page.presetFilter ?? {})
  const unused = filterable.filter(f => !(f.name in (page.presetFilter ?? {})))

  function setFilter(field: string, value: string | null, rename?: string) {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(page.presetFilter ?? {})) {
      if (k !== field) next[k] = v
      else if (value !== null) next[rename ?? k] = value
    }
    if (!(field in (page.presetFilter ?? {})) && value !== null) next[field] = value
    update(index, { presetFilter: Object.keys(next).length ? next : undefined })
  }

  return (
    <div className="space-y-2">
      <Field label="Entity" error={errors.entity}>
        <EntitySelect
          label="List entity"
          value={page.entity ?? ''}
          options={entities.map(e => e.name)}
          error={errors.entity}
          onChange={name => update(index, { entity: name, presetFilter: undefined })}
        />
      </Field>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Opens filtered on</p>
        {filters.length === 0 && <p className="text-[11px] text-secondary">Every row (no preset filter).</p>}
        {filters.map(([field, value]) => {
          const f = filterable.find(x => x.name === field)
          const error = errors[`presetFilter.${field}`]
          return (
            <div key={field} className="flex items-center gap-2" data-preset-filter={field}>
              <select
                aria-label="Filter field"
                value={field}
                onChange={e => setFilter(field, value, e.target.value)}
                className={`${inputClass(error)} max-w-[12rem] py-1 text-xs`}
              >
                <option value={field}>{field}</option>
                {unused.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
              </select>
              <select
                aria-label={`Filter value for ${field}`}
                value={value}
                onChange={e => setFilter(field, e.target.value)}
                className={`${inputClass(error)} max-w-[12rem] py-1 text-xs`}
              >
                {!valuesOf(f).includes(value) && <option value={value}>{value}</option>}
                {valuesOf(f).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setFilter(field, null)}
                className={ICON_BUTTON}
                aria-label={`Remove the ${field} filter`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
              </button>
              {error && <span className="text-[11px] text-error">{error}</span>}
            </div>
          )
        })}
        {unused.length > 0 && (
          <button
            type="button"
            onClick={() => setFilter(unused[0].name, valuesOf(unused[0])[0] ?? '')}
            className={SMALL_BUTTON}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>filter_alt</span>
            Add filter
          </button>
        )}
      </div>
    </div>
  )
}

function DashboardForm({ page, index, entities, errors, update, dnd }: FormProps & { dnd: ReturnType<typeof useDragReorder> }) {
  const widgets = page.widgets ?? []
  const list = `widgets:${index}`

  function setWidget(wi: number, patch: Partial<FullstackWidgetDef>) {
    update(index, { widgets: widgets.map((w, i) => (i === wi ? { ...w, ...patch } : w)) })
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Widgets</p>
      {errors.widgets && <p className="text-[11px] text-error">{errors.widgets}</p>}
      {widgets.map((widget, wi) => {
        const entity = entities.find(e => e.name === widget.entity)
        const error = errors[`widget.${wi}`]
        return (
          <div
            key={wi}
            {...dnd.rowProps(list, wi)}
            data-widget={wi}
            className={`flex flex-wrap items-center gap-2 rounded border px-2 py-1.5 ${error ? 'border-error/50' : 'border-outline-variant'}`}
          >
            <span
              {...dnd.handleProps(list, wi)}
              className="cursor-grab text-secondary/70"
              aria-label={`Reorder widget ${wi + 1}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>drag_indicator</span>
            </span>
            <select
              aria-label="Widget kind"
              value={widget.kind}
              onChange={e => setWidget(wi, { kind: e.target.value as FullstackWidgetDef['kind'], groupBy: undefined, limit: undefined })}
              className={`${inputClass()} max-w-[9rem] py-1 text-xs`}
            >
              <option value="kpi">Count tile</option>
              <option value="bar">Breakdown chart</option>
              <option value="recent">Recent rows</option>
            </select>
            <EntitySelect
              label="Widget entity"
              value={widget.entity}
              options={entities.map(e => e.name)}
              error={error}
              className="max-w-[10rem]"
              onChange={name => setWidget(wi, { entity: name, groupBy: undefined })}
            />
            {widget.kind === 'bar' && (
              <select
                aria-label="Group by"
                value={widget.groupBy ?? ''}
                onChange={e => setWidget(wi, { groupBy: e.target.value || undefined })}
                className={`${inputClass(error)} max-w-[10rem] py-1 text-xs`}
              >
                <option value="">First enum or boolean</option>
                {groupableFields(entity).map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                {widget.groupBy && !groupableFields(entity).some(f => f.name === widget.groupBy) && (
                  <option value={widget.groupBy}>{widget.groupBy}</option>
                )}
              </select>
            )}
            {widget.kind === 'recent' && (
              <input
                type="number"
                min={1}
                max={MAX_RECENT_LIMIT}
                aria-label="How many rows"
                value={widget.limit ?? ''}
                placeholder="5"
                onChange={e => setWidget(wi, { limit: e.target.value === '' ? undefined : Number(e.target.value) })}
                className={`${inputClass(error)} max-w-[5rem] py-1 text-xs`}
              />
            )}
            <input
              type="text"
              aria-label="Widget title"
              value={widget.title ?? ''}
              placeholder="Title (optional)"
              onChange={e => setWidget(wi, { title: e.target.value || undefined })}
              className={`${inputClass()} min-w-[8rem] flex-1 py-1 text-xs`}
            />
            <button
              type="button"
              onClick={() => update(index, { widgets: widgets.filter((_, i) => i !== wi) })}
              className={ICON_BUTTON}
              aria-label={`Remove widget ${wi + 1}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
            {error && <p className="w-full text-[11px] text-error">{error}</p>}
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => update(index, { widgets: [...widgets, { kind: 'kpi', entity: entities[0]?.name ?? '' }] })}
        className={SMALL_BUTTON}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
        Add widget
      </button>
    </div>
  )
}

function TabsForm({ page, index, pages, errors, update }: Omit<FormProps, 'entities'> & { pages: FullstackPageDef[] }) {
  const tabs = page.tabs ?? []
  const targets = pages.filter(p => p.id !== page.id && p.type !== 'tabs' && p.type !== 'record')

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Tabs</p>
      {errors.tabs && <p className="text-[11px] text-error">{errors.tabs}</p>}
      {tabs.map((tab, ti) => {
        const error = errors[`tab.${ti}`]
        return (
          <div key={ti} className="flex items-center gap-2" data-tab={ti}>
            <select
              aria-label={`Tab ${ti + 1} page`}
              value={tab.page}
              onChange={e => update(index, { tabs: tabs.map((t, i) => (i === ti ? { ...t, page: e.target.value } : t)) })}
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
              placeholder="Tab label (optional)"
              onChange={e => update(index, {
                tabs: tabs.map((t, i) => (i === ti ? { ...t, title: e.target.value || undefined } : t)),
              })}
              className={`${inputClass()} max-w-[12rem] py-1 text-xs`}
            />
            <button
              type="button"
              onClick={() => update(index, { tabs: tabs.filter((_, i) => i !== ti) })}
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
          onClick={() => update(index, { tabs: [...tabs, { page: targets.find(t => !tabs.some(x => x.page === t.id))?.id ?? '' }] })}
          className={SMALL_BUTTON}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          Add tab
        </button>
      )}
    </div>
  )
}

function MasterDetailForm({ page, index, entities, errors, update }: FormProps) {
  const parent = entities.find(e => e.name === page.parent)
  const child = entities.find(e => e.name === page.child)
  const children = entities.filter(e => relationsTo(e, page.parent).length > 0)
  const vias = relationsTo(child, page.parent)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <Field label="Parent (left list)" error={errors.parent}>
        <EntitySelect
          label="Parent entity"
          value={page.parent ?? ''}
          options={entities.map(e => e.name)}
          error={errors.parent}
          onChange={name => update(index, { parent: name, child: undefined, via: undefined })}
        />
      </Field>
      <Field
        label="Child (right list)"
        error={errors.child}
        hint={parent ? `Entities with a relation to ${parent.name}` : undefined}
      >
        <EntitySelect
          label="Child entity"
          value={page.child ?? ''}
          options={children.map(e => e.name)}
          error={errors.child}
          empty={children.length === 0 ? 'No entity points at this parent' : undefined}
          onChange={name => update(index, { child: name, via: undefined })}
        />
      </Field>
      {vias.length > 1 && (
        <Field label="Linked through" error={errors.via}>
          <select
            aria-label="Relation to link through"
            value={page.via ?? ''}
            onChange={e => update(index, { via: e.target.value || undefined })}
            className={`${inputClass(errors.via)} py-1 text-xs`}
          >
            <option value="">— pick a relation —</option>
            {vias.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>
      )}
    </div>
  )
}

function RecordForm({ page, index, entities, errors, update }: FormProps) {
  const entity = entities.find(e => e.name === page.entity)
  const related = entities.filter(e => relationsTo(e, page.entity).length > 0)
  // Omitted childTabs means "every related list" — the same default the generator applies.
  const selected = page.childTabs
  const isOn = (name: string) => (selected == null ? true : selected.includes(name))

  function toggle(name: string) {
    const current = selected ?? related.map(e => e.name)
    update(index, {
      childTabs: current.includes(name) ? current.filter(n => n !== name) : [...current, name],
    })
  }

  return (
    <div className="space-y-2">
      <Field label="Entity" error={errors.entity} hint="Rows of this entity open on this page">
        <EntitySelect
          label="Record entity"
          value={page.entity ?? ''}
          options={entities.map(e => e.name)}
          error={errors.entity}
          onChange={name => update(index, { entity: name, childTabs: undefined })}
        />
      </Field>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Related lists as tabs</p>
        {related.length === 0 ? (
          <p className="text-[11px] text-secondary">
            Nothing points at {entity?.name ?? 'this entity'} — the page shows its details only.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {related.map(e => (
              <label key={e.name} className="inline-flex items-center gap-1.5 text-[11px] text-on-surface">
                <input
                  type="checkbox"
                  checked={isOn(e.name)}
                  onChange={() => toggle(e.name)}
                  className="accent-primary"
                />
                {e.name}
              </label>
            ))}
          </div>
        )}
        {errors.childTabs && <p className="text-[11px] text-error">{errors.childTabs}</p>}
      </div>
    </div>
  )
}

// ── Small shared pieces ────────────────────────────────────────────────────

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-secondary" title={hint}>{label}</span>
      {children}
      {error && <p className="text-[11px] text-error">{error}</p>}
    </div>
  )
}

/** Entity picker that keeps an unknown (renamed away) value visible instead of dropping it. */
function EntitySelect({ label, value, options, error, empty, className, onChange }: {
  label: string
  value: string
  options: string[]
  error?: string
  empty?: string
  className?: string
  onChange: (name: string) => void
}) {
  return (
    <select
      aria-label={label}
      aria-invalid={Boolean(error)}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`${inputClass(error)} py-1 text-xs ${className ?? ''}`}
    >
      <option value="">{empty ?? '— pick an entity —'}</option>
      {options.map(n => <option key={n} value={n}>{n}</option>)}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
    </select>
  )
}

const valuesOf = (field: { type: string; enumValues?: string[] } | undefined): string[] =>
  field?.type === 'BOOLEAN' ? ['true', 'false'] : (field?.enumValues ?? [])

/** A new page of `type`, filled in with the first entities that fit so it is valid on sight. */
function blankPage(type: FullstackPageType, entities: FullstackEntityDef[], taken: string[]): FullstackPageDef {
  const first = entities[0]?.name ?? ''
  const id = (base: string) => uniquePageId(slugify(base) || 'page', taken)
  switch (type) {
    case 'dashboard':
      return { id: id('dashboard'), type, widgets: entities.slice(0, 4).map(e => ({ kind: 'kpi', entity: e.name })) }
    case 'entity-list':
      return { id: id(first), type, entity: first }
    case 'tabs':
      return { id: id('tabs'), type, title: 'Tabs', tabs: [] }
    case 'master-detail': {
      const pair = entities
        .flatMap(child => (child.relations ?? [])
          .filter(r => r.type === 'MANY_TO_ONE')
          .map(r => ({ parent: r.targetEntity, child: child.name })))
        .find(p => entities.some(e => e.name === p.parent))
      return { id: id(pair?.parent ?? first), type, parent: pair?.parent ?? first, child: pair?.child }
    }
    case 'record':
      return { id: id(first), type, entity: first, hidden: true }
  }
}
