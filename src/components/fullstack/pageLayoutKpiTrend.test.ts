import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef, FullstackWidgetDef } from '../../types'
import { buildLayoutPreview } from './layoutPreviewModel'
import { retargetWidget, trendDateField, validatePages } from './pageLayout'

const entities: FullstackEntityDef[] = [
  {
    name: 'Sale',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'region', type: 'ENUM', enumValues: ['NORTH', 'SOUTH'] },
      { name: 'amount', type: 'BIG_DECIMAL' },
      { name: 'soldOn', type: 'LOCAL_DATE' },
      { name: 'shippedOn', type: 'LOCAL_DATE', filterable: false },
    ],
  },
  { name: 'Region', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
]
const [sale, region] = entities

const dashboard = (widget: FullstackWidgetDef, extra: Partial<FullstackPageDef> = {}): FullstackPageDef[] => [
  { id: 'desk', type: 'dashboard', widgets: [widget], ...extra },
  { id: 'sales', type: 'entity-list', entity: 'Sale' },
  { id: 'regions', type: 'entity-list', entity: 'Region' },
]
/** Every message the editor would show: inline (per control) and as sentences. */
const errorsOf = (pages: FullstackPageDef[]) => {
  const v = validatePages(pages, entities)
  return [...Object.values(v.byPage).flatMap(controls => Object.values(controls)), ...v.problems]
}

describe('kpi trend', () => {
  it('plots over the picker’s date, else the named date, else the first date — as the backend does', () => {
    const w: FullstackWidgetDef = { kind: 'kpi', entity: 'Sale', trend: 'month' }
    expect(trendDateField(w, sale, false)).toBe('soldOn')
    expect(trendDateField({ ...w, dateField: 'shippedOn' }, sale, false)).toBe('shippedOn')
    expect(trendDateField({ ...w, dateField: 'soldOn' }, sale, true)).toBe('soldOn')
    expect(trendDateField(w, region, false)).toBeUndefined()
  })

  it('is valid on a tile, and needs a date to plot over', () => {
    expect(errorsOf(dashboard({ kind: 'kpi', entity: 'Sale', trend: 'month' }))).toEqual([])
    // Without a picker the trend may name a date the picker could not filter by.
    expect(errorsOf(dashboard({ kind: 'kpi', entity: 'Sale', trend: 'day', dateField: 'shippedOn' }))).toEqual([])
    expect(errorsOf(dashboard({ kind: 'kpi', entity: 'Sale', trend: 'day', dateField: 'amount' })).join()).toContain('Sale has no date field “amount”')
    expect(errorsOf(dashboard({ kind: 'kpi', entity: 'Region', trend: 'month' })).join()).toContain('Region has no date field to plot over time')
    expect(errorsOf(dashboard({ kind: 'bar', entity: 'Sale', groupBy: 'region', trend: 'month' })).join()).toContain('only a number tile draws a trend')
    // With a picker, a dateField still has to be one the picker can limit.
    expect(errorsOf(dashboard({ kind: 'kpi', entity: 'Sale', trend: 'day', dateField: 'shippedOn' }, { dateRange: '30d' })).join())
      .toContain('Sale has no filterable date field “shippedOn”')
    // A dateField without a trend or a picker still means nothing.
    expect(errorsOf(dashboard({ kind: 'kpi', entity: 'Sale', dateField: 'soldOn' })).join()).toContain('needs the dashboard’s period picker')
  })

  it('is dropped, and named, when the widget stops being a tile or its entity has no date', () => {
    const w: FullstackWidgetDef = { kind: 'kpi', entity: 'Sale', trend: 'month', dateField: 'shippedOn' }
    const bar = retargetWidget(w, { kind: 'bar' }, sale)
    expect(bar.widget.trend).toBeUndefined()
    expect(bar.dropped).toContain('trend line')
    expect(bar.dropped).toContain('period date')
    const kept = retargetWidget(w, { entity: 'Sale' }, sale)
    expect(kept.widget).toMatchObject({ trend: 'month', dateField: 'shippedOn' })
    expect(kept.dropped).toEqual([])
    const moved = retargetWidget(w, { entity: 'Region' }, region)
    expect(moved.widget.trend).toBeUndefined()
    expect(moved.dropped).toContain('trend line')
  })

  it('draws a line under the number in the preview', () => {
    const preview = buildLayoutPreview(dashboard({ kind: 'kpi', entity: 'Sale', agg: 'sum', field: 'amount', trend: 'month' }), entities, { locale: 'en', projectOpts: [] })
    const screen = preview.screens[0]
    const tile = screen.type === 'dashboard' ? screen.widgets[0] : null
    expect(tile?.kind).toBe('kpi')
    if (tile?.kind !== 'kpi') return
    expect(tile.trend).toHaveLength(6)
    const plain = buildLayoutPreview(dashboard({ kind: 'kpi', entity: 'Sale' }), entities, { locale: 'en', projectOpts: [] }).screens[0]
    expect(plain.type === 'dashboard' && plain.widgets[0].kind === 'kpi' ? plain.widgets[0].trend : 'x').toBeNull()
  })
})
