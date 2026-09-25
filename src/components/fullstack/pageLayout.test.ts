import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import {
  MAX_PAGES, MAX_WIDGETS, describePage, enabledListViews, listColumns, pageLabel, pageLayoutProblems, renameEntityInPages, renameFieldInPages,
  renameRelationInPages, seedLayout, slugify, sortableKeys, suggestPages, uniquePageId, validatePages,
} from './pageLayout'

const entities: FullstackEntityDef[] = [
  { name: 'Ticket', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'status', type: 'ENUM', enumValues: ['OPEN'] }] },
]

describe('pageLayoutProblems', () => {
  it('has nothing to say about a consistent layout, or about none', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'bar', entity: 'ticket', groupBy: 'status' }] },
      { id: 'tickets', type: 'entity-list', entity: 'Ticket', presetFilter: { status: 'OPEN' } },
    ]
    expect(pageLayoutProblems(pages, entities)).toEqual([])
    expect(pageLayoutProblems([], [])).toEqual([])
  })

  it('names stale entity, field and tab references', () => {
    const problems = pageLayoutProblems([
      { id: 'home', type: 'dashboard', title: 'Home', widgets: [{ kind: 'kpi', entity: 'Order' }, { kind: 'bar', entity: 'Ticket', groupBy: 'priority' }] },
      { id: 'list', type: 'entity-list', entity: 'Ticket', presetFilter: { state: 'OPEN' } },
      { id: 'tabs', type: 'tabs', title: 'Tabs', tabs: [{ page: 'list' }, { page: 'gone' }] },
    ], entities)
    expect(problems).toEqual([
      'Page “Home” has a widget for “Order”, which is no longer an entity',
      'Page “Home” groups Ticket by “priority”, which it no longer has',
      'Page “list” filters on “state”, which Ticket no longer has',
      'Page “Tabs” has a tab for the missing page “gone”',
    ])
  })

  it('needs one page in the navigation', () => {
    expect(pageLayoutProblems([{ id: 'a', type: 'entity-list', entity: 'Ticket', hidden: true }], entities))
      .toContain('Every page is hidden — at least one must be in the navigation')
  })
})

describe('describePage / pageLabel', () => {
  it('summarizes each page type and falls back like the generator does', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Ticket' }, { kind: 'kpi', entity: 'Ticket' }, { kind: 'recent', entity: 'Ticket' }] },
      { id: 'open', type: 'entity-list', entity: 'Ticket', title: 'Open tickets' },
      { id: 'q', type: 'tabs', title: 'Queue', tabs: [{ page: 'open' }, { title: 'Overview', page: 'home' }] },
    ]
    expect(describePage(pages[0], pages)).toBe('2 number tiles · 1 recent-rows list')
    expect(describePage(pages[1], pages)).toBe('Ticket list')
    expect(describePage(pages[2], pages)).toBe('Open tickets | Overview')
    expect(pages.map(pageLabel)).toEqual(['Dashboard', 'Open tickets', 'Queue'])
  })

  it('summarizes the two id-driven page types', () => {
    const md: FullstackPageDef = { id: 'c', type: 'master-detail', parent: 'Customer', child: 'Order', via: 'billTo' }
    expect(describePage(md, [md])).toBe('Customer → Order via billTo')
    expect(pageLabel(md)).toBe('Customer')
    expect(describePage({ id: 'o', type: 'record', entity: 'Order' }, [])).toBe('One Order · its related lists')
    expect(describePage({ id: 'o', type: 'record', entity: 'Order', childTabs: [] }, [])).toBe('One Order · no related lists')
    expect(describePage({ id: 'o', type: 'record', entity: 'Order', childTabs: ['OrderLine'] }, [])).toBe('One Order · OrderLine')
  })
})

describe('list page presentation', () => {
  const shop: FullstackEntityDef[] = [
    { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
    {
      name: 'Order',
      listViews: ['table', 'kanban', 'calendar'],
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true },
        { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] },
        { name: 'placedOn', type: 'LOCAL_DATE' },
        { name: 'total', type: 'BIG_DECIMAL' },
      ],
      relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
    },
  ]
  const list = (extra: Partial<FullstackPageDef>): FullstackPageDef => ({ id: 'orders', type: 'entity-list', entity: 'Order', ...extra })

  it('lists the columns a page can show, with the audit pair only when audit applies', () => {
    expect(listColumns(shop[1]).map(c => c.key)).toEqual(['id', 'status', 'placedOn', 'total', 'customer'])
    expect(listColumns(shop[1]).map(c => [c.label, c.sortable, c.kind])).toContainEqual(['Customer', false, 'relation'])
    expect(listColumns(shop[1], ['audit']).map(c => c.key)).toEqual(['id', 'status', 'placedOn', 'total', 'customer', 'createdAt', 'updatedAt'])
    expect(listColumns({ ...shop[1], opts: { audit: false } }, ['audit']).map(c => c.key)).not.toContain('createdAt')
    expect(listColumns({ ...shop[1], opts: { audit: true } }).map(c => c.key)).toContain('createdAt')
    expect(listColumns({ ...shop[1], readOnly: true }, ['audit']).map(c => c.key)).not.toContain('createdAt')
    expect(sortableKeys(shop[1])).toEqual(['id', 'status', 'placedOn', 'total'])
    expect(enabledListViews(shop[1])).toEqual(['table', 'kanban', 'calendar'])
    expect(enabledListViews(shop[0])).toEqual(['table'])
  })

  it('accepts columns, a sort, an offered view and a pager size', () => {
    const page = list({ columns: ['status', 'customer', 'total'], sort: { field: 'placedOn', dir: 'desc' }, view: 'kanban', pageSize: 50 })
    expect(validatePages([page], shop).count).toBe(0)
    expect(describePage(page, [page])).toBe('Order list · board · 3 columns · by placedOn ↓')
    const filtered = list({ view: 'calendar', presetFilter: { status: 'OPEN' } })
    expect(describePage(filtered, [filtered])).toBe('Order list · calendar · filtered on status = OPEN')
  })

  it('names an unknown, duplicate or audit-only column', () => {
    const v = validatePages([list({ columns: ['status', 'nope', 'status', 'createdAt'] })], shop)
    expect(v.problems).toEqual([
      'Page “orders” shows “nope”, which is not a column of Order',
      'Page “orders” lists the “status” column twice',
      'Page “orders” shows “createdAt”, which needs the audit scaffold option on Order',
    ])
    expect(v.byPage[0].columns).toBe('Order has no “nope” column')
    expect(validatePages([list({ columns: [] })], shop).problems).toEqual(['Page “orders” shows no columns'])
    // With the audit opt on, the audit pair is a column like any other.
    expect(validatePages([list({ columns: ['createdAt'], sort: { field: 'updatedAt' } })], shop, { scaffoldOpts: ['audit'] }).count).toBe(0)
  })

  it('only sorts by a sortable column, in a known direction', () => {
    expect(validatePages([list({ sort: { field: 'customer' } })], shop).problems)
      .toEqual(['Page “orders” sorts by “customer”, which Order cannot sort by'])
    expect(validatePages([list({ sort: { field: 'total', dir: 'down' as 'asc' } })], shop).byPage[0].sort).toBe('direction must be asc or desc')
  })

  it('only opens in a view the entity offers, and says why not', () => {
    expect(validatePages([list({ view: 'cards' })], shop).problems)
      .toEqual(['Page “orders” opens as cards, which Order does not offer (not ticked in the list views of Order)'])
    const customers = validatePages([{ id: 'c', type: 'entity-list', entity: 'Customer', view: 'kanban' }], shop)
    expect(customers.byPage[0].view).toBe('Kanban needs an enum or boolean field')
    const readOnly = validatePages([list({ view: 'kanban' })], [shop[0], { ...shop[1], readOnly: true }])
    expect(readOnly.byPage[0].view).toBe('Kanban needs a writable entity')
    expect(validatePages([list({ pageSize: 25 })], shop).byPage[0].pageSize).toBe('must be 10, 20, 50, 100')
  })

  it('follows field and relation renames into a list page’s columns and sort', () => {
    const pages: FullstackPageDef[] = [list({ columns: ['status', 'customer'], sort: { field: 'status' } })]
    const fields = renameFieldInPages(pages, 'Order', 'status', 'state')
    expect(fields[0]).toMatchObject({ columns: ['state', 'customer'], sort: { field: 'state' } })
    const rels = renameRelationInPages(fields, 'Order', 'customer', 'buyer')
    expect(rels[0].columns).toEqual(['state', 'buyer'])
    expect(renameRelationInPages(rels, 'Order', 'nothing', 'x')).toBe(rels)
  })

  it('suggests a board and a calendar only for an entity that enables the view', () => {
    const keys = suggestPages(shop, [], 10).map(s => s.key)
    expect(keys).toContain('board:Order')
    expect(keys).toContain('calendar:Order')
    expect(keys).not.toContain('board:Customer')
    const board = suggestPages(shop, [], 10).find(s => s.key === 'board:Order')!
    expect(board.page).toMatchObject({ type: 'entity-list', entity: 'Order', view: 'kanban', title: 'Order board' })
    expect(suggestPages(shop, [list({ view: 'kanban' })], 10).map(s => s.key)).not.toContain('board:Order')
  })

  it('lets a report bucket by the date it groups over by default', () => {
    const events: FullstackEntityDef[] = [{ name: 'Event', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'on', type: 'LOCAL_DATE' }] }]
    expect(validatePages([{ id: 'r', type: 'report', entity: 'Event', chart: { bucket: 'year' } }], events).count).toBe(0)
    // Order groups by status by default, so a bucket is still out of place there.
    expect(validatePages([{ id: 'r', type: 'report', entity: 'Order', chart: { bucket: 'year' } }], shop).byPage[0]['chart.bucket'])
      .toBe('a bucket applies to a date grouping')
  })
})

describe('validatePages — master-detail and record pages', () => {
  const shop: FullstackEntityDef[] = [
    { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
    { name: 'Order', fields: [{ name: 'id', type: 'LONG', primaryKey: true }], relations: [
      { type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' },
      { type: 'MANY_TO_ONE', fieldName: 'billTo', targetEntity: 'Customer' },
    ] },
    { name: 'Ledger', fields: [{ name: 'day', type: 'LOCAL_DATE', primaryKey: true }, { name: 'book', type: 'STRING', primaryKey: true }] },
  ]

  it('accepts a layout whose references all hold', () => {
    const pages: FullstackPageDef[] = [
      { id: 'customers', type: 'master-detail', parent: 'Customer', child: 'Order', via: 'customer' },
      { id: 'order', type: 'record', entity: 'Order', hidden: true, childTabs: [] },
    ]
    expect(validatePages(pages, shop).problems).toEqual([])
  })

  it('asks which relation a master-detail page links through, and flags an unknown one', () => {
    const ambiguous = validatePages([{ id: 'c', type: 'master-detail', parent: 'Customer', child: 'Order' }], shop)
    expect(ambiguous.byPage[0].via).toBe('pick the relation to link through')
    const wrong = validatePages([{ id: 'c', type: 'master-detail', parent: 'Customer', child: 'Order', via: 'buyer' }], shop)
    expect(wrong.byPage[0].via).toBe('“buyer” is not a relation to Customer')
    const unrelated = validatePages([{ id: 'c', type: 'master-detail', parent: 'Order', child: 'Customer' }], shop)
    expect(unrelated.byPage[0].child).toBe('Customer has no relation to Order')
  })

  it('keeps record pages to one per entity, single-key, with related children only', () => {
    const twice = validatePages([
      { id: 'order', type: 'record', entity: 'Order', hidden: true },
      { id: 'order-2', type: 'record', entity: 'Order', hidden: true },
      { id: 'orders', type: 'entity-list', entity: 'Order' },
    ], shop)
    expect(twice.byPage[1].entity).toBe('Order already has the record page “order”')
    const composite = validatePages([{ id: 'ledger', type: 'record', entity: 'Ledger', hidden: true }], shop)
    expect(composite.byPage[0].entity).toBe('Ledger has a composite key')
    const stranger = validatePages([
      { id: 'customer', type: 'record', entity: 'Customer', hidden: true, childTabs: ['Ledger'] },
      { id: 'customers', type: 'entity-list', entity: 'Customer' },
    ], shop)
    expect(stranger.byPage[0]['childTab.0']).toBe('Ledger has no relation to Customer')
  })

  it('will not embed a record page in a tab, and needs one page in the navigation', () => {
    const result = validatePages([
      { id: 'order', type: 'record', entity: 'Order', hidden: true },
      { id: 'orders', type: 'entity-list', entity: 'Order' },
      { id: 'q', type: 'tabs', title: 'Q', tabs: [{ page: 'orders' }, { page: 'order' }] },
    ], shop)
    expect(result.byPage[2]['tab.1']).toBe('a tab cannot embed a record page')
    // A record page is never in the navigation, so it does not count as the visible one.
    expect(validatePages([{ id: 'order', type: 'record', entity: 'Order', hidden: true }], shop).general)
      .toEqual(['Every page is hidden — at least one must be in the navigation'])
  })
})

describe('seedLayout / renames / slugs', () => {
  const entities: FullstackEntityDef[] = [
    { name: 'Ticket', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'status', type: 'ENUM', enumValues: ['OPEN'] }] },
    { name: 'Team', fields: [{ name: 'id', type: 'LONG', primaryKey: true }] },
    { name: '', fields: [] },
  ]

  it('seeds the classic layout: a dashboard of every entity plus one list page each', () => {
    const pages = seedLayout(entities)
    expect(pages.map(p => `${p.id}:${p.type}`)).toEqual(['dashboard:dashboard', 'ticket:entity-list', 'team:entity-list'])
    expect(pages[0].widgets).toEqual([
      { kind: 'kpi', entity: 'Ticket' },
      { kind: 'kpi', entity: 'Team' },
      { kind: 'bar', entity: 'Ticket' },
      { kind: 'recent', entity: 'Ticket' },
    ])
    expect(validatePages(pages, entities).problems).toEqual([])
    expect(seedLayout([])).toEqual([])
  })

  it('carries the dashboard heading and stays inside the caps on a big model', () => {
    const [dashboard] = seedLayout(entities, { title: '  Ops desk ', description: 'Everything today' })
    expect(dashboard).toMatchObject({ title: 'Ops desk', description: 'Everything today' })
    expect(seedLayout(entities, { title: ' ' })[0].title).toBeUndefined()

    const many: FullstackEntityDef[] = Array.from({ length: 40 }, (_, i) => ({
      name: `Thing${i}`,
      fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'state', type: 'ENUM', enumValues: ['A', 'B'] }],
    }))
    const big = seedLayout(many)
    expect(big).toHaveLength(MAX_PAGES)
    expect(big[0].widgets).toHaveLength(MAX_WIDGETS)
    expect(big[0].widgets?.[MAX_WIDGETS - 1]).toEqual({ kind: 'recent', entity: 'Thing0' })
    expect(validatePages(big, many).problems).toEqual([])
  })

  it('follows an entity rename through every reference', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Ticket' }, { kind: 'kpi', entity: 'Team' }] },
      { id: 'list', type: 'entity-list', entity: 'ticket' },
      { id: 'md', type: 'master-detail', parent: 'Team', child: 'Ticket' },
      { id: 'rec', type: 'record', entity: 'Team', childTabs: ['Ticket'] },
    ]
    const renamed = renameEntityInPages(pages, 'Ticket', 'Issue')
    expect(renamed[0].widgets?.map(w => w.entity)).toEqual(['Issue', 'Team'])
    expect(renamed[1].entity).toBe('Issue')
    expect(renamed[2].child).toBe('Issue')
    expect(renamed[3].childTabs).toEqual(['Issue'])
    expect(renameEntityInPages(pages, 'Ticket', 'Ticket')).toBe(pages)
  })

  it('follows a field rename into preset filters and chart groupings of that entity only', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'bar', entity: 'Ticket', groupBy: 'status' }, { kind: 'bar', entity: 'Team', groupBy: 'status' }] },
      { id: 'open', type: 'entity-list', entity: 'Ticket', presetFilter: { status: 'OPEN' } },
    ]
    const renamed = renameFieldInPages(pages, 'Ticket', 'status', 'state')
    expect(renamed[0].widgets?.map(w => w.groupBy)).toEqual(['state', 'status'])
    expect(renamed[1].presetFilter).toEqual({ state: 'OPEN' })
  })

  it('follows a field rename into widget and chart aggregates', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [
        { kind: 'kpi', entity: 'Sale', agg: 'sum', field: 'amount' },
        { kind: 'line', entity: 'Sale', groupBy: 'soldOn', agg: 'sum', field: 'amount' },
      ] },
      { id: 'rev', type: 'report', entity: 'Sale', chart: { groupBy: 'soldOn', agg: 'sum', field: 'amount' } },
    ]
    const renamed = renameFieldInPages(pages, 'Sale', 'amount', 'total')
    expect(renamed[0].widgets?.map(w => w.field)).toEqual(['total', 'total'])
    expect(renamed[1].chart).toEqual({ groupBy: 'soldOn', agg: 'sum', field: 'total' })

    const byDate = renameFieldInPages(pages, 'Sale', 'soldOn', 'closedOn')
    expect(byDate[0].widgets?.[1].groupBy).toBe('closedOn')
    expect(byDate[1].chart?.groupBy).toBe('closedOn')
  })

  it('slugifies titles and keeps page ids unique', () => {
    expect(slugify('Order lines!')).toBe('order-lines')
    expect(slugify('  42 ')).toBe('')
    expect(uniquePageId('orders', ['orders', 'orders-2'])).toBe('orders-3')
    expect(uniquePageId('', [])).toBe('page')
  })
})

const sales: FullstackEntityDef[] = [
  {
    name: 'Sale',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'reference', type: 'STRING' },
      { name: 'region', type: 'ENUM', enumValues: ['NORTH', 'SOUTH'] },
      { name: 'amount', type: 'BIG_DECIMAL' },
      { name: 'soldOn', type: 'LOCAL_DATE' },
    ],
  },
]

describe('aggregate widgets and report pages', () => {
  const ok = (pages: FullstackPageDef[]) => pageLayoutProblems(pages, sales)

  it('accepts the aggregate tiles, a trend and a report the generator would', () => {
    expect(ok([
      { id: 'home', type: 'dashboard', widgets: [
        { kind: 'kpi', entity: 'Sale' },
        { kind: 'kpi', entity: 'Sale', agg: 'sum', field: 'amount' },
        { kind: 'bar', entity: 'Sale', groupBy: 'region', agg: 'avg', field: 'amount' },
        { kind: 'line', entity: 'Sale', groupBy: 'soldOn', bucket: 'month', agg: 'sum', field: 'amount' },
      ] },
      { id: 'rev', type: 'report', entity: 'Sale', chart: { groupBy: 'region', agg: 'sum', field: 'amount' } },
    ])).toEqual([])
  })

  it('mirrors the backend on aggregates that name no numeric field, or a field a count cannot take', () => {
    expect(ok([{ id: 'h', type: 'dashboard', title: 'H', widgets: [{ kind: 'kpi', entity: 'Sale', agg: 'sum' }] }]))
      .toEqual(['Page “H” reduces Sale with sum but names no numeric field'])
    expect(ok([{ id: 'h', type: 'dashboard', title: 'H', widgets: [{ kind: 'kpi', entity: 'Sale', agg: 'sum', field: 'reference' }] }]))
      .toEqual(['Page “H” reduces “reference”, which is not a numeric field of Sale'])
    expect(ok([{ id: 'h', type: 'dashboard', title: 'H', widgets: [{ kind: 'kpi', entity: 'Sale', field: 'amount' }] }]))
      .toEqual(['Page “H” counts rows, so it takes no field'])
    expect(ok([{ id: 'h', type: 'dashboard', title: 'H', widgets: [{ kind: 'recent', entity: 'Sale', agg: 'sum', field: 'amount' }] }]))
      .toContain('Page “H” asks a recent list for an aggregate')
  })

  it('wants a date field for a trend, and a bucket only on one', () => {
    expect(ok([{ id: 'h', type: 'dashboard', title: 'H', widgets: [{ kind: 'line', entity: 'Sale', groupBy: 'region' }] }]))
      .toEqual(['Page “H” plots Sale over “region”, which is not one of its date fields'])
    expect(ok([{ id: 'h', type: 'dashboard', title: 'H', widgets: [{ kind: 'bar', entity: 'Sale', groupBy: 'region', bucket: 'month' }] }]))
      .toEqual(['Page “H” buckets a bar widget'])
  })

  it('checks a report’s entity, grouping and bucket', () => {
    expect(ok([{ id: 'r', type: 'report', title: 'R', entity: 'Nope', chart: {} }]))
      .toEqual(['Page “R” reports on “Nope”, which is no longer an entity'])
    expect(ok([{ id: 'r', type: 'report', title: 'R', entity: 'Sale', chart: { groupBy: 'reference' } }]))
      .toEqual(['Page “R” groups by “reference”, which is not an enum, boolean or date field, or a relation, of Sale'])
    expect(ok([{ id: 'r', type: 'report', title: 'R', entity: 'Sale', chart: { groupBy: 'region', bucket: 'month' } }]))
      .toEqual(['Page “R” buckets by month, but it does not group over a date'])
    // A report is an ordinary visible page, so it satisfies the "something in the nav" rule.
    expect(ok([{ id: 'r', type: 'report', entity: 'Sale', chart: {} }])).toEqual([])
  })

  it('describes a report and counts trends in a dashboard', () => {
    expect(describePage({ id: 'r', type: 'report', entity: 'Sale', chart: { groupBy: 'region', agg: 'sum', field: 'amount' } }, []))
      .toBe('Sale · sum of amount by region')
    expect(describePage({ id: 'r', type: 'report', entity: 'Sale', chart: { groupBy: 'soldOn', bucket: 'month' } }, []))
      .toBe('Sale · row count by soldOn per month')
    expect(describePage({ id: 'h', type: 'dashboard', widgets: [{ kind: 'line', entity: 'Sale' }] }, []))
      .toBe('1 trend')
  })
})
