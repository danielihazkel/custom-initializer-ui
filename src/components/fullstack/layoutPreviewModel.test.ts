import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { buildLayoutPreview } from './layoutPreviewModel'

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Order',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'], enumLabels: { OPEN: 'Waiting' } },
      { name: 'total', type: 'BIG_DECIMAL' },
      { name: 'placedOn', type: 'LOCAL_DATE' },
    ],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
  },
]

const pages: FullstackPageDef[] = [
  {
    id: 'desk', type: 'dashboard', widgets: [
      { kind: 'kpi', entity: 'Order' },
      { kind: 'kpi', entity: 'Order', agg: 'sum', field: 'total' },
      { kind: 'bar', entity: 'Order' },
      { kind: 'line', entity: 'Order', bucket: 'year' },
      { kind: 'recent', entity: 'Customer', limit: 3 },
    ],
  },
  { id: 'open', type: 'entity-list', entity: 'Order', presetFilter: { status: 'OPEN' }, hidden: true },
  { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'open' }, { page: 'gone', title: 'Lost' }] },
  { id: 'customers', type: 'master-detail', parent: 'Customer', child: 'Order' },
  { id: 'customer', type: 'record', entity: 'Customer', hidden: true },
  { id: 'revenue', type: 'report', entity: 'Order', chart: { agg: 'sum', field: 'total' } },
]

const ctx = { locale: 'en' as const, projectOpts: ['csvExport'] }

describe('buildLayoutPreview', () => {
  it('lists the visible pages in order and marks the first as the start page', () => {
    const preview = buildLayoutPreview(pages, entities, ctx)
    expect(preview.nav.map(n => [n.index, n.label, n.start])).toEqual([
      [0, 'Dashboard', true],
      [2, 'Queue', false],
      [3, 'Customers', false],
      [5, 'Orders report', false],
    ])
    expect(preview.screens).toHaveLength(pages.length)
  })

  it('titles dashboard widgets the way the generated screen does', () => {
    const screen = buildLayoutPreview(pages, entities, ctx).screens[0]
    if (screen.type !== 'dashboard') throw new Error(screen.type)
    expect(screen.widgets.map(w => w.title)).toEqual([
      'Orders', 'Total Total', 'Orders by Status', 'Orders over time', 'Recent Customers',
    ])
    const bar = screen.widgets[2]
    // Enum labels are what the chart shows; bars are sorted largest first.
    expect(bar.kind === 'bar' && bar.bars.map(b => b.label).sort()).toEqual(['Paid', 'Waiting'])
    expect(bar.kind === 'bar' && bar.bars[0].value >= bar.bars[1].value).toBe(true)
    const line = screen.widgets[3]
    expect(line.kind === 'line' && line.points.map(p => p.label)[0]).toBe('2021')
    const recent = screen.widgets[4]
    expect(recent.kind === 'recent' && recent.rows).toHaveLength(3)
  })

  it('is stable between renders (sample data is seeded)', () => {
    expect(buildLayoutPreview(pages, entities, ctx)).toEqual(buildLayoutPreview(pages, entities, ctx))
  })

  it('draws list, tabs, master-detail, record and report screens', () => {
    const [, list, tabs, md, record, report] = buildLayoutPreview(pages, entities, ctx).screens
    expect(list.type === 'entity-list' && list.table.presetChips).toEqual(['Status: Waiting'])
    expect(list.type === 'entity-list' && list.table.newLabel).toBe('New Order')
    expect(tabs.type === 'tabs' && tabs.tabs).toEqual([{ label: 'Orders', target: 1 }, { label: 'Lost', target: null }])
    // The child list of a master-detail page hides the relation it is scoped by.
    expect(md.type === 'master-detail' && md.child.columns).not.toContain('Customer')
    expect(record.type === 'record' && record.tabs).toEqual(['Customer details', 'Orders'])
    expect(record.type === 'record' && record.back).toBe('Back')
    expect(report.type === 'report' && [report.chartTitle, report.exportLabel, report.chart.line])
      .toEqual(['Total Total by Status', 'Export CSV', false])
  })

  it('speaks Hebrew and flags pages whose entity is gone', () => {
    const preview = buildLayoutPreview([...pages, { id: 'ghost', type: 'entity-list', entity: 'Ghost' }], entities, { locale: 'he', projectOpts: [] })
    expect(preview.rtl).toBe(true)
    expect(preview.screens[0].title).toBe('לוח בקרה')
    expect(preview.screens[6]).toMatchObject({ type: 'broken', message: 'No entity “Ghost”' })
  })
})
