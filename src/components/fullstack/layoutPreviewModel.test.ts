import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { buildLayoutPreview, highlights, previewPartOf } from './layoutPreviewModel'

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
  it('draws a list page the way it opens: its columns, its view and its sort', () => {
    const orders: FullstackEntityDef[] = [entities[0], { ...entities[1], listViews: ['table', 'kanban'] }]
    const board: FullstackPageDef = {
      id: 'board', type: 'entity-list', entity: 'Order', columns: ['status', 'customer'], view: 'kanban', sort: { field: 'placedOn', dir: 'desc' },
    }
    const screen = buildLayoutPreview([board], orders, ctx).screens[0]
    if (screen.type !== 'entity-list') throw new Error(screen.type)
    expect(screen.table.columns).toEqual(['Status', 'Customer'])
    expect(screen.table.view).toBe('kanban')
    expect(screen.table.lanes).toEqual(['Waiting', 'Paid'])
    // Each card sits in the lane of its own status, not dealt round the lanes.
    expect(screen.table.rowLanes).toHaveLength(screen.table.rows.length)
    screen.table.rowLanes.forEach((lane, i) => expect(screen.table.rows[i][0]).toBe(screen.table.lanes[lane]))
    expect(screen.table.sort).toBe('Placed on ↓')
    // Without a presentation the table opens in the entity's first view, first columns, default order.
    const plain = buildLayoutPreview([{ id: 'o', type: 'entity-list', entity: 'Order' }], orders, ctx).screens[0]
    if (plain.type !== 'entity-list') throw new Error(plain.type)
    expect(plain.table.view).toBe('table')
    expect(plain.table.lanes).toEqual([])
    expect(plain.table.sort).toBeNull()
    expect(plain.table.columns).toEqual(['Id', 'Status', 'Total', 'Placed on', 'Customer'])
    // The audit columns exist for the picker only when the audit opt is on.
    const audited = buildLayoutPreview([{ id: 'o', type: 'entity-list', entity: 'Order', columns: ['status', 'createdAt'] }], orders, { ...ctx, projectOpts: ['audit'] }).screens[0]
    expect(audited.type === 'entity-list' && audited.table.columns).toEqual(['Status', 'Created'])
  })

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
    const preview = buildLayoutPreview([...pages, { id: 'ghost', type: 'entity-list', entity: 'Ghost' }], entities, { locale: 'he', projectOpts: ['rtl'] })
    expect(preview.rtl).toBe(true)
    // Direction follows the rtl opt, not the chrome language (the generated index.html does too).
    expect(buildLayoutPreview(pages, entities, { locale: 'he', projectOpts: [] }).rtl).toBe(false)
    expect(buildLayoutPreview(pages, entities, { locale: 'en', projectOpts: ['rtl'] }).rtl).toBe(true)
    expect(preview.screens[0].title).toBe('לוח בקרה')
    expect(preview.screens[6]).toMatchObject({ type: 'broken', message: 'No entity “Ghost”' })
  })

  it('groups the nav and draws each page with its icon', () => {
    const grouped: FullstackPageDef[] = pages.map(p =>
      p.id === 'queue' ? { ...p, group: 'Work', icon: 'Inbox' as const } : p.id === 'revenue' ? { ...p, group: 'Work' } : p)
    const preview = buildLayoutPreview(grouped, entities, ctx)
    expect(preview.sections.map(s => [s.group, s.items.map(n => n.index)])).toEqual([
      [undefined, [0]],
      ['Work', [2, 5]],
      [undefined, [3]],
    ])
    expect(preview.nav.map(n => n.index)).toEqual([0, 2, 5, 3])
    expect(preview.nav.map(n => n.icon)).toEqual(['dashboard', 'inbox', 'bar_chart', 'vertical_split'])
    expect(preview.nav[0].start).toBe(true)
  })

  it('lays widgets out by span and shows the period and a widget’s filter', () => {
    const dashboard: FullstackPageDef = {
      id: 'desk', type: 'dashboard', dateRange: 'ytd', widgets: [
        { kind: 'kpi', entity: 'Order', presetFilter: { status: 'OPEN' } },
        { kind: 'line', entity: 'Order', span: 4 },
        { kind: 'bar', entity: 'Order', span: 1 },
      ],
    }
    const screen = buildLayoutPreview([dashboard], entities, ctx).screens[0]
    if (screen.type !== 'dashboard') throw new Error(screen.type)
    expect(screen.period).toBe('This year')
    expect(screen.widgets.map(w => w.span)).toEqual([1, 4, 1])
    expect(screen.widgets[0].filters).toEqual(['Status: Waiting'])
  })

  it('draws top lists, progress tiles, compared tiles and a report’s extra charts', () => {
    const dashboard: FullstackPageDef = {
      id: 'desk', type: 'dashboard', dateRange: '30d', widgets: [
        { kind: 'top', entity: 'Order', groupBy: 'customer', limit: 2 },
        { kind: 'progress', entity: 'Order', target: '1000' },
        { kind: 'kpi', entity: 'Order', compare: true },
      ],
    }
    const report: FullstackPageDef = { id: 'r', type: 'report', entity: 'Order', charts: [{ groupBy: 'status' }, { groupBy: 'placedOn' }] }
    const [desk, rep] = buildLayoutPreview([dashboard, report], entities, ctx).screens
    if (desk.type !== 'dashboard' || rep.type !== 'report') throw new Error('types')
    const [top, progress, kpi] = desk.widgets
    expect(top.kind === 'top' && [top.title, top.rows.length]).toEqual(['Top Orders by Customer', 2])
    expect(progress.kind === 'progress' && progress.target).toBe('1,000')
    expect(kpi.kind === 'kpi' && kpi.delta).toMatch(/^[▲▼] \d+%$/)
    expect(rep.moreCharts).toHaveLength(1)
    expect(rep.moreCharts[0]).toMatchObject({ title: 'Orders over time', line: true })
  })

  it('draws a wizard’s steps and a record page’s header tiles', () => {
    const wizard: FullstackPageDef = { id: 'new-order', type: 'wizard', entity: 'Order', steps: [{ title: 'Who', fields: ['customer', 'status'] }] }
    const [w, , record] = buildLayoutPreview([wizard, ...pages.slice(0, 4), pages[4]], entities, ctx).screens.filter((_, i) => i === 0 || i === 1 || i === 5)
    if (w.type !== 'wizard' || record.type !== 'record') throw new Error('types')
    expect(w).toMatchObject({ title: 'New Order', steps: ['Who', 'Review'], fields: ['Customer', 'Status'] })
    // A record page counts each related tab by default.
    expect(record.stats.map(s => s.title)).toEqual(['Orders'])
  })

  it('walks a wizard’s every step to a review, and lists each related tab of a record', () => {
    const wizard: FullstackPageDef = { id: 'new-order', type: 'wizard', entity: 'Order', steps: [{ fields: ['status'] }, { title: 'Who', fields: ['customer', 'total'] }] }
    const record: FullstackPageDef = { id: 'customer', type: 'record', entity: 'Customer', hidden: true }
    const [w, r] = buildLayoutPreview([wizard, record], entities, ctx).screens
    if (w.type !== 'wizard' || r.type !== 'record') throw new Error('types')
    expect(w.steps).toEqual(['Step 1', 'Who', 'Review'])
    expect(w.stepFields).toEqual([['Status'], ['Customer', 'Total']])
    expect(w.review.map(x => x.label)).toEqual(['Status', 'Customer', 'Total'])
    expect(w.save).toBe('Save')
    expect(r.tabs).toEqual(['Customer details', 'Orders'])
    // The related list leaves out its link back to the record.
    expect(r.tabTables[0]?.columns).toEqual(['Id', 'Status', 'Total', 'Placed on'])
  })
})

describe('previewPartOf', () => {
  it('folds the finer editor control keys onto the parts the preview draws', () => {
    const table: [string | undefined, string | undefined][] = [
      ['widget.2', 'widget.2'],
      ['widget.2.presetFilter.status', 'widget.2'],
      ['headerStat.1', 'headerStats'],
      ['headerStats', 'headerStats'],
      ['step.3', 'steps'],
      ['steps', 'steps'],
      ['childTabs', 'childTabs'],
      ['tab.0', 'tab.0'],
      ['tabs', 'tabs'],
      ['chart', 'chart'],
      ['chart.bucket', 'chart'],
      ['chart2.groupBy', 'chart2'],
      ['title', 'title'],
      ['description', 'title'],
      ['via', 'child'],
      ['sort', 'sort'],
      ['columns', 'columns'],
      ['detail', 'detail'],
      ['view', 'entity'],
      ['presetFilter.status', 'entity'],
      ['dateRange', 'dateRange'],
      // Nav-only settings and the row itself are the page: its nav item.
      ['id', undefined],
      ['roles', undefined],
      [undefined, undefined],
    ]
    for (const [control, part] of table) expect(previewPartOf(control), control ?? '(page)').toBe(part)
  })

  it('lights a part only for the same page and part', () => {
    expect(highlights({ page: 0, control: 'widget.1.presetFilter.status' }, { page: 0, control: 'widget.1' })).toBe(true)
    expect(highlights({ page: 1, control: 'widget.1' }, { page: 0, control: 'widget.1' })).toBe(false)
    expect(highlights({ page: 0, control: 'widget.0' }, { page: 0, control: 'widget.1' })).toBe(false)
    expect(highlights(null, { page: 0, control: 'title' })).toBe(false)
  })

  it('draws a report grouped by a relation with one bar per related record', () => {
    const preview = buildLayoutPreview([
      { id: 'by-customer', type: 'report', entity: 'Order', chart: { groupBy: 'customer', agg: 'sum', field: 'total' } },
    ], entities, { locale: 'en', projectOpts: [] })
    const screen = preview.screens[0]
    expect(screen.type).toBe('report')
    if (screen.type !== 'report') return
    expect(screen.groupLabel).toBe('Customer')
    expect(screen.chartTitle).toContain('by Customer')
    expect(screen.chart.bars).toHaveLength(5)
    expect(screen.chart.bars[0].label).toBe('Name 1')
  })

  it('marks the nav entries of the pages the validation warns about', () => {
    const plain = buildLayoutPreview(pages, entities, { locale: 'en', projectOpts: [] })
    expect(plain.nav.map(item => item.warning)).toEqual(plain.nav.map(() => false))
    const warned = buildLayoutPreview(pages, entities, { locale: 'en', projectOpts: [], warnPages: new Set([0]) })
    expect(warned.nav.map(item => [item.index, item.warning])).toEqual(plain.nav.map(item => [item.index, item.index === 0]))
  })
})

describe('buildLayoutPreview — the details the editor sets', () => {
  it('says how many rows a page holds and where a row opens', () => {
    const withRecord: FullstackPageDef[] = [
      { id: 'orders', type: 'entity-list', entity: 'Order', pageSize: 50 },
      { id: 'customers', type: 'entity-list', entity: 'Customer', detail: 'drawer' },
      { id: 'order', type: 'record', entity: 'Order', hidden: true },
    ]
    const [orders, customers] = buildLayoutPreview(withRecord, entities, ctx).screens
    if (orders.type !== 'entity-list' || customers.type !== 'entity-list') throw new Error('lists')
    expect(orders.table.footer).toBe('50 per page · rows open their page')
    expect(customers.table.footer).toBe('20 per page · rows open in a drawer')
  })

  it('opens related lists with their own columns and sort, and the details by form section', () => {
    const sectioned: FullstackEntityDef[] = [
      { ...entities[0] },
      { ...entities[1], formSections: [{ title: 'Money', fields: ['total'] }, { title: 'Who', fields: ['customer', 'status'] }] },
    ]
    const layout: FullstackPageDef[] = [
      { id: 'customers', type: 'master-detail', parent: 'Customer', child: 'Order', columns: ['total', 'status'], sort: { field: 'total', dir: 'desc' } },
      { id: 'customer', type: 'record', entity: 'Customer', hidden: true, childTabs: [{ entity: 'Order', columns: ['placedOn'] }] },
      { id: 'order', type: 'record', entity: 'Order', hidden: true },
    ]
    const [md, customer, order] = buildLayoutPreview(layout, sectioned, ctx).screens
    if (md.type !== 'master-detail' || customer.type !== 'record' || order.type !== 'record') throw new Error('types')
    expect(md.child.columns).toEqual(['Total', 'Status'])
    expect(md.child.sort).toBe('Total ↓')
    expect(customer.tabTables[0]?.columns).toEqual(['Placed on'])
    expect(order.details.map(d => [d.section ?? '', d.label])).toEqual([['Money', 'Total'], ['Who', 'Customer'], ['', 'Status']])
  })

  it('draws a totals table under each chart that asks for one', () => {
    const report: FullstackPageDef = {
      id: 'r', type: 'report', entity: 'Order',
      charts: [{ groupBy: 'status', table: false }, { groupBy: 'placedOn' }, { groupBy: 'customer', table: true }],
    }
    const screen = buildLayoutPreview([report], entities, ctx).screens[0]
    if (screen.type !== 'report') throw new Error(screen.type)
    expect([screen.chartTable, ...screen.moreCharts.map(c => c.table)]).toEqual([false, false, true])
  })

  it('names the column recent rows are newest by, and the roles a page is for', () => {
    const layout: FullstackPageDef[] = [
      { id: 'desk', type: 'dashboard', widgets: [{ kind: 'recent', entity: 'Order', sortBy: 'placedOn' }] },
      { id: 'admin', type: 'entity-list', entity: 'Customer', roles: ['ADMIN'] },
    ]
    const preview = buildLayoutPreview(layout, entities, ctx)
    const desk = preview.screens[0]
    if (desk.type !== 'dashboard' || desk.widgets[0].kind !== 'recent') throw new Error('recent')
    expect(desk.widgets[0].by).toBe('Newest by Placed on')
    expect(preview.nav.map(n => n.roles)).toEqual([[], ['ADMIN']])
  })
})
