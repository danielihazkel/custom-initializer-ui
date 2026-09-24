import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef, FullstackWidgetDef } from '../../types'
import {
  defaultWizardSteps, renameEntityInPages,
  defaultBarGroupBy, defaultLineGroupBy, defaultOptionLabel, defaultReportGroupBy, describePagesChange,
  adoptedGroup, describePage, describePresetValue, dropTabsTo, duplicatePage, keptPresetFilter, moveNavGroup, navSections, pageFromSuggestion,
  pagesEmbedding, renameFieldInPages,
  renameGroupInPages, renamePageIdInPages,
  renameRelationInPages, reportCharts, suggestPages, validatePages,
} from './pageLayout'

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Order',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'paid', type: 'BOOLEAN' },
      { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] },
      { name: 'total', type: 'BIG_DECIMAL' },
      { name: 'placedOn', type: 'LOCAL_DATE' },
    ],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
  },
]

const layout: FullstackPageDef[] = [
  { id: 'open', type: 'entity-list', entity: 'Order', hidden: true },
  { id: 'all', type: 'entity-list', entity: 'Order', hidden: true },
  { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'open' }, { page: 'all' }] },
]

describe('defaults the generator resolves', () => {
  it('matches FullstackPageValidator: enum before boolean for a bar, declaration order for a report', () => {
    const order = entities[1]
    // `paid` (boolean) is declared first, but a breakdown prefers the enum.
    expect(defaultBarGroupBy(order)).toBe('status')
    expect(defaultReportGroupBy(order)).toBe('paid')
    expect(defaultLineGroupBy(order)).toBe('placedOn')
    expect(defaultBarGroupBy(entities[0])).toBeUndefined()
    expect(defaultOptionLabel('status', 'enum')).toBe('Default (status)')
    expect(defaultOptionLabel(undefined, 'date field')).toBe('Default (first date field)')
  })
})

describe('page references', () => {
  it('follows a page id change into the tabs that embed it, and leaves the rest untouched', () => {
    const next = renamePageIdInPages(layout, 'open', 'open-orders')
    expect(next[2].tabs).toEqual([{ page: 'open-orders' }, { page: 'all' }])
    expect(next[0]).toBe(layout[0])
    expect(renamePageIdInPages(layout, 'nothing', 'x')).toBe(layout)
    expect(validatePages(next.map((p, i) => (i === 0 ? { ...p, id: 'open-orders' } : p)), entities).count).toBe(0)
  })

  it('finds and drops the tabs pointing at a removed page', () => {
    expect(pagesEmbedding(layout, 'all').map(p => p.id)).toEqual(['queue'])
    expect(pagesEmbedding(layout, 'queue')).toEqual([])
    expect(dropTabsTo(layout, 'all')[2].tabs).toEqual([{ page: 'open' }])
  })

  it('follows a relation rename into the master-detail pages that link through it', () => {
    const pages: FullstackPageDef[] = [{ id: 'customers', type: 'master-detail', parent: 'Customer', child: 'Order', via: 'customer' }]
    expect(renameRelationInPages(pages, 'order', 'customer', 'buyer')[0].via).toBe('buyer')
    expect(renameRelationInPages(pages, 'Customer', 'customer', 'buyer')).toBe(pages)
  })

  it('duplicates a page under a free id', () => {
    const copy = duplicatePage(layout[0], layout.map(p => p.id))
    expect(copy).toMatchObject({ id: 'open-copy', title: 'Order (copy)', entity: 'Order' })
    expect(duplicatePage(layout[0], ['open-copy']).id).toBe('open-copy-2')
  })
})

describe('suggestPages', () => {
  it('suggests what the model is shaped for, and stops once the layout has it', () => {
    const keys = suggestPages(entities, [], 10).map(s => s.key)
    expect(keys).toEqual(['md:Customer:Order', 'record:Customer', 'report:Order', 'trend:Order', 'wizard:Order'])

    const added: FullstackPageDef[] = []
    for (const s of suggestPages(entities, [], 10)) added.push(pageFromSuggestion(s, added.map(p => p.id)))
    expect(added.map(p => p.id)).toEqual(['customer', 'customer-2', 'order-report', 'order-trends', 'new-order'])
    expect(validatePages(added, entities).count).toBe(0)
    expect(added[2]).toMatchObject({ id: 'order-report', type: 'report', chart: { groupBy: 'status', agg: 'sum', field: 'total' } })
    expect(suggestPages(entities, added, 10)).toEqual([])
  })
})

describe('describePagesChange', () => {
  it('names the page that changed', () => {
    expect(describePagesChange([], layout)).toBe('Started a page layout')
    expect(describePagesChange(layout, [])).toBe('Switched to the classic page layout')
    expect(describePagesChange(layout, layout.slice(1))).toBe('Removed the “Order” page')
    expect(describePagesChange(layout, [layout[1], layout[0], layout[2]])).toBe('Reordered pages')
    expect(describePagesChange(layout, layout.map((p, i) => (i === 2 ? { ...p, title: 'Inbox' } : p))))
      .toBe('Renamed the “Inbox” page')
    expect(describePagesChange(layout, layout.map((p, i) => (i === 0 ? { ...p, hidden: false } : p))))
      .toBe('Showed “Order” in the navigation')
  })
})

describe('nav sections', () => {
  const nav: FullstackPageDef[] = [
    { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }] },
    { id: 'orders', type: 'entity-list', entity: 'Order', group: 'Sales', icon: 'ShoppingCart' },
    { id: 'people', type: 'entity-list', entity: 'Customer', group: 'People' },
    { id: 'more-orders', type: 'entity-list', entity: 'Order', group: 'Sales' },
    { id: 'tab-only', type: 'entity-list', entity: 'Order', hidden: true },
    { id: 'loose', type: 'entity-list', entity: 'Customer' },
  ]

  it('gathers a group where it first appears, like the generated shell', () => {
    expect(navSections(nav)).toEqual([
      { items: [0] },
      { group: 'Sales', items: [1, 3] },
      { group: 'People', items: [2] },
      { items: [5] },
    ])
    expect(validatePages(nav, entities).count).toBe(0)
  })

  it('puts a group or icon only on a page that is in the nav', () => {
    const v = validatePages(nav.map((p, i) => (i === 4 ? { ...p, group: 'Sales' } : p)), entities)
    expect(v.byPage[4]?.group).toBe('only applies to a page in the navigation')
    const long = validatePages(nav.map((p, i) => (i === 2 ? { ...p, group: 'x'.repeat(41) } : p)), entities)
    expect(long.byPage[2]?.group).toBe('is longer than 40 characters')
  })
})

describe('dashboard layout and filters', () => {
  const dash = (widgets: FullstackPageDef['widgets'], extra: Partial<FullstackPageDef> = {}): FullstackPageDef[] =>
    [{ id: 'desk', type: 'dashboard', widgets, ...extra }]

  it('accepts spans, widget filters, a recent sort and a period picker over a date', () => {
    const pages = dash([
      { kind: 'kpi', entity: 'Order', presetFilter: { status: 'OPEN' }, span: 2 },
      { kind: 'recent', entity: 'Order', sortBy: 'placedOn', dateField: 'placedOn' },
    ], { dateRange: '30d' })
    expect(validatePages(pages, entities).count).toBe(0)
  })

  it('flags what the generator would reject', () => {
    const v = validatePages(dash([
      { kind: 'kpi', entity: 'Order', span: 5 },
      { kind: 'bar', entity: 'Order', sortBy: 'placedOn' },
      { kind: 'kpi', entity: 'Order', presetFilter: { status: 'LOST' } },
      { kind: 'kpi', entity: 'Order', dateField: 'placedOn' },
    ]), entities)
    expect(v.byPage[0]).toMatchObject({
      'widget.0': 'spans 1 to 4 columns',
      'widget.1': 'only a recent list takes a sort',
      'widget.2.presetFilter.status': '“LOST” is not one of the values of status',
      'widget.3': 'a date field needs the dashboard’s period picker',
    })
    // A period picker needs some widget with a date to limit.
    expect(validatePages(dash([{ kind: 'kpi', entity: 'Customer' }], { dateRange: '7d' }), entities).byPage[0]?.dateRange)
      .toBe('no widget counts an entity with a filterable date')
  })

  it('follows a field rename into a widget’s filter, sort and date', () => {
    const pages = dash([{ kind: 'recent', entity: 'Order', sortBy: 'placedOn', dateField: 'placedOn', presetFilter: { status: 'OPEN' } }],
      { dateRange: '30d' })
    const renamed = renameFieldInPages(renameFieldInPages(pages, 'Order', 'placedOn', 'orderedOn'), 'Order', 'status', 'state')
    expect(renamed[0].widgets?.[0]).toMatchObject({ sortBy: 'orderedOn', dateField: 'orderedOn', presetFilter: { state: 'OPEN' } })
  })
})

describe('top lists, targets, comparisons and report charts', () => {
  it('ranks by an enum or a relation, and checks targets and comparisons', () => {
    const ok: FullstackPageDef[] = [{
      id: 'desk', type: 'dashboard', dateRange: '30d', widgets: [
        { kind: 'top', entity: 'Order', groupBy: 'customer', agg: 'sum', field: 'total', limit: 3 },
        { kind: 'top', entity: 'Order' },
        { kind: 'progress', entity: 'Order', agg: 'sum', field: 'total', target: '5000' },
        { kind: 'kpi', entity: 'Order', compare: true },
      ],
    }]
    expect(validatePages(ok, entities).count).toBe(0)

    const bad = validatePages([{
      id: 'desk', type: 'dashboard', widgets: [
        { kind: 'top', entity: 'Order', groupBy: 'total' },
        { kind: 'progress', entity: 'Order' },
        { kind: 'progress', entity: 'Order', target: '-1' },
        { kind: 'kpi', entity: 'Order', compare: true },
        { kind: 'top', entity: 'Customer' },
      ],
    }], entities)
    expect(bad.byPage[0]).toMatchObject({
      'widget.0': 'Order has no enum, boolean or relation “total”',
      'widget.1': 'needs a target',
      'widget.2': 'the target must be a number above 0',
      'widget.3': 'comparing needs the period picker and a filterable date',
      'widget.4': 'Customer has no enum, boolean or relation to rank by',
    })
  })

  it('validates every chart of a report under its own control', () => {
    const v = validatePages([{
      id: 'r', type: 'report', entity: 'Order', charts: [{ groupBy: 'status' }, { groupBy: 'nope' }, { agg: 'sum' }],
    }], entities)
    expect(v.byPage[0]).toMatchObject({
      'chart2.groupBy': 'Order has no enum, boolean or date field, or relation, “nope”',
      'chart3.field': 'sum needs a numeric field of Order',
    })
    expect(v.byPage[0]?.['chart.groupBy']).toBeUndefined()
    expect(reportCharts({ id: 'r', type: 'report', chart: { groupBy: 'status' } })).toEqual([{ groupBy: 'status' }])
  })

  it('follows relation and field renames into top lists and report charts', () => {
    const pages: FullstackPageDef[] = [
      { id: 'desk', type: 'dashboard', widgets: [{ kind: 'top', entity: 'Order', groupBy: 'customer' }] },
      { id: 'r', type: 'report', entity: 'Order', charts: [{ groupBy: 'status' }, { groupBy: 'placedOn', bucket: 'month' }] },
    ]
    expect(renameRelationInPages(pages, 'Order', 'customer', 'buyer')[0].widgets?.[0].groupBy).toBe('buyer')
    expect(renameFieldInPages(pages, 'Order', 'placedOn', 'orderedOn')[1].charts?.[1].groupBy).toBe('orderedOn')
  })
})

describe('wizard pages and record header stats', () => {
  it('deals the form into steps and wants every required field asked for', () => {
    expect(defaultWizardSteps(entities[1])).toEqual([
      { fields: ['id', 'paid', 'status', 'total'] },
      { fields: ['placedOn', 'customer'] },
    ])
    const wizard = (steps: { fields: string[] }[]): FullstackPageDef[] => [{ id: 'new-order', type: 'wizard', entity: 'Order', steps }]
    expect(validatePages(wizard(defaultWizardSteps(entities[1])), entities).count).toBe(0)
    const v = validatePages(wizard([{ fields: ['status', 'nope'] }, { fields: ['status'] }]), entities)
    expect(v.byPage[0]).toMatchObject({
      'step.0': 'Order has no field “nope”',
      'step.1': '“status” is already asked for',
      steps: 'never asks for “id”, which is required',
    })
  })

  it('checks a record page’s header tiles', () => {
    const v = validatePages([
      { id: 'home', type: 'entity-list', entity: 'Customer' },
      { id: 'customer', type: 'record', entity: 'Customer', hidden: true, headerStats: [{ child: 'Order', agg: 'sum' }, { child: 'Customer' }] },
    ], entities)
    expect(v.byPage[1]).toMatchObject({
      'headerStat.0': 'sum needs a numeric field of Order',
      'headerStat.1': 'Customer has no relation to Customer',
    })
  })

  it('follows field, relation and entity renames into steps and tiles', () => {
    const pages: FullstackPageDef[] = [
      { id: 'new-order', type: 'wizard', entity: 'Order', steps: [{ fields: ['status', 'customer'] }] },
      { id: 'customer', type: 'record', entity: 'Customer', hidden: true, headerStats: [{ child: 'Order', agg: 'sum', field: 'total' }] },
    ]
    expect(renameFieldInPages(pages, 'Order', 'status', 'state')[0].steps?.[0].fields).toEqual(['state', 'customer'])
    expect(renameRelationInPages(pages, 'Order', 'customer', 'buyer')[0].steps?.[0].fields).toEqual(['status', 'buyer'])
    expect(renameFieldInPages(pages, 'Order', 'total', 'amount')[1].headerStats?.[0].field).toBe('amount')
    expect(renameEntityInPages(pages, 'Order', 'Purchase')[1].headerStats?.[0].child).toBe('Purchase')
  })
})

describe('a report grouped by a relation', () => {
  const pages: FullstackPageDef[] = [
    { id: 'orders', type: 'entity-list', entity: 'Order' },
    { id: 'by-customer', type: 'report', entity: 'Order', chart: { groupBy: 'customer', agg: 'sum', field: 'total' } },
    { id: 'more', type: 'report', entity: 'Order', charts: [{ groupBy: 'status' }, { groupBy: 'customer' }] },
  ]

  it('is valid, as the generator accepts it; a bucket on it is not', () => {
    expect(validatePages(pages, entities).count).toBe(0)
    const v = validatePages([{ ...pages[1], chart: { groupBy: 'customer', bucket: 'month' } }], entities)
    expect(v.byPage[0]?.['chart.bucket']).toBe('a bucket applies to a date grouping')
    expect(validatePages([{ ...pages[1], chart: { groupBy: 'nope' } }], entities).problems[0])
      .toContain('which is not an enum, boolean or date field, or a relation, of Order')
  })

  it('follows a relation rename into the chart, whichever spelling the page uses', () => {
    const renamed = renameRelationInPages(pages, 'Order', 'customer', 'buyer')
    expect(renamed[1].chart?.groupBy).toBe('buyer')
    expect(renamed[2].charts?.map(c => c.groupBy)).toEqual(['status', 'buyer'])
    expect(renameRelationInPages(pages, 'Customer', 'customer', 'buyer')).toBe(pages)
  })
})

describe('date and number preset filters', () => {
  const list = (presetFilter: Record<string, string>): FullstackPageDef => ({ id: 'orders', type: 'entity-list', entity: 'Order', presetFilter })
  const problem = (presetFilter: Record<string, string>) => validatePages([list(presetFilter)], entities).byPage[0]?.['presetFilter.' + Object.keys(presetFilter)[0]]

  it('accepts a period, a date range and a number range, and says what is wrong otherwise', () => {
    expect(validatePages([list({ placedOn: 'last:30d', total: '100..', status: 'OPEN' })], entities).count).toBe(0)
    expect(problem({ placedOn: '2026-01-01..2026-03-31' })).toBeUndefined()
    expect(problem({ placedOn: 'last:5d' })).toBe('needs a period or a date range (from..to)')
    expect(problem({ placedOn: '2026-03-31..2026-01-01' })).toBe('from is after to')
    expect(problem({ placedOn: '..' })).toBe('a range needs a from or a to')
    expect(problem({ total: '5' })).toBe('needs a number range (min..max)')
    expect(problem({ total: 'abc..5' })).toBe('min and max must be numbers')
    expect(problem({ total: '50..5' })).toBe('min is above max')
    expect(validatePages([{ id: 'c', type: 'entity-list', entity: 'Customer', presetFilter: { name: 'x' } }], entities).byPage[0]?.['presetFilter.name'])
      .toBe('only a filterable enum, boolean, date or number field can be preset')
  })

  it('keeps a valid range across a retarget and describes it as the app would', () => {
    expect(keptPresetFilter({ placedOn: 'last:30d', total: '..5', status: 'NOPE' }, entities[1])).toEqual({ placedOn: 'last:30d', total: '..5' })
    const placedOn = entities[1].fields.find(f => f.name === 'placedOn')!
    expect(describePresetValue(placedOn, 'last:30d')).toBe('last 30 days')
    expect(describePresetValue(placedOn, '2026-01-01..2026-03-31')).toBe('2026-01-01 – 2026-03-31')
    expect(describePresetValue(entities[1].fields.find(f => f.name === 'total')!, '100..')).toBe('≥ 100')
  })
})

describe('links widgets', () => {
  const pages: FullstackPageDef[] = [
    { id: 'home', type: 'dashboard', widgets: [{ kind: 'links', entity: '', pages: ['orders', 'new-order'] }] },
    { id: 'orders', type: 'entity-list', entity: 'Order' },
    { id: 'new-order', type: 'wizard', entity: 'Order', hidden: true },
    { id: 'order', type: 'record', entity: 'Order', hidden: true },
    { id: 'paid', type: 'entity-list', entity: 'Order', hidden: true },
    { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'paid' }, { page: 'orders' }] },
  ]

  it('opens visible pages and hidden wizards, never a record or a tab-only page', () => {
    expect(validatePages(pages, entities).count).toBe(0)
    const bad = (ids: string[]) => validatePages([{ ...pages[0], widgets: [{ kind: 'links', entity: '', pages: ids }] }, ...pages.slice(1)], entities)
    expect(bad([]).problems).toEqual(['Page “home” has a links widget that opens no page'])
    expect(bad(['order']).problems).toEqual(['Page “home” links to the record page “Order”, which opens from a row'])
    expect(bad(['paid']).problems).toEqual(['Page “home” links to “Order”, which is hidden from the navigation'])
    expect(bad(['nope']).problems).toEqual(['Page “home” links to the missing page “nope”'])
    expect(bad(['orders', 'orders']).problems).toEqual(['Page “home” links to “Order” twice'])
    // The fix drops the one bad link.
    const v = bad(['orders', 'nope'])
    expect(v.issues[0].fix!.apply(v.issues[0].fix!.apply(pages))[0].widgets?.[0].pages).toEqual(['orders', 'new-order'])
  })

  it('follows a page id change and a removal into the links', () => {
    expect(renamePageIdInPages(pages, 'orders', 'all-orders')[0].widgets?.[0].pages).toEqual(['all-orders', 'new-order'])
    expect(dropTabsTo(pages, 'new-order')[0].widgets?.[0].pages).toEqual(['orders'])
    expect(describePage(pages[0], pages)).toBe('1 link panel')
  })
})

describe('list widgets', () => {
  const home: FullstackPageDef = {
    id: 'home', type: 'dashboard', widgets: [{ kind: 'list', entity: 'Order', columns: ['status', 'customer'], sort: { field: 'total', dir: 'desc' }, presetFilter: { status: 'OPEN' } }],
  }

  it('takes a list page’s presentation and the pager’s sizes, reported on the widget', () => {
    expect(validatePages([home], entities).count).toBe(0)
    const bad = (w: Partial<FullstackWidgetDef>) => validatePages([{ ...home, widgets: [{ ...home.widgets![0], ...w }] }], entities)
    expect(bad({ columns: ['nope'] }).byPage[0]?.['widget.0']).toBe('Order has no “nope” column')
    expect(bad({ sort: { field: 'customer' } }).byPage[0]?.['widget.0']).toBe('Order cannot sort by “customer”')
    expect(bad({ limit: 15 }).byPage[0]?.['widget.0']).toBe('shows 10 or 20 rows')
    expect(bad({ presetFilter: { status: 'NOPE' } }).byPage[0]?.['widget.0.presetFilter.status']).toContain('is not one of the values')
    expect(describePage(home, [home])).toBe('1 embedded list')
  })

  it('follows a field rename into the columns and sort', () => {
    const renamed = renameFieldInPages([home], 'Order', 'total', 'amount')[0].widgets![0]
    expect(renamed.sort).toEqual({ field: 'amount', dir: 'desc' })
    const cols = renameFieldInPages([home], 'Order', 'status', 'state')[0].widgets![0]
    expect(cols.columns).toEqual(['state', 'customer'])
    expect(cols.presetFilter).toEqual({ state: 'OPEN' })
  })
})

describe('nav group tools', () => {
  const nav: FullstackPageDef[] = [
    { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }] },
    { id: 'orders', type: 'entity-list', entity: 'Order', group: 'Sales' },
    { id: 'people', type: 'entity-list', entity: 'Customer', group: 'People' },
    { id: 'tab-only', type: 'entity-list', entity: 'Order', hidden: true },
    { id: 'more-orders', type: 'entity-list', entity: 'Order', group: 'Sales' },
    { id: 'loose', type: 'entity-list', entity: 'Customer' },
  ]

  it('renames a group on every page that carries it, and ungroups on a blank name', () => {
    const renamed = renameGroupInPages(nav, 'Sales', 'Orders')
    expect(renamed.map(p => p.group)).toEqual([undefined, 'Orders', 'People', undefined, 'Orders', undefined])
    expect(renameGroupInPages(nav, 'Sales', 'Sales')).toBe(nav)
    expect(renameGroupInPages(nav, 'Nope', 'X')).toBe(nav)
    expect(renameGroupInPages(nav, 'Sales', ' ').map(p => 'group' in p)).toEqual([false, false, true, false, false, false])
    expect(describePagesChange(nav, renamed)).toBe('Renamed the “Sales” group to “Orders”')
    expect(describePagesChange(nav, renameGroupInPages(nav, 'Sales', ''))).toBe('Ungrouped the “Sales” pages')
  })

  it('moves a section past its neighbour as a block, leaving hidden pages where they are', () => {
    // Sections: [home] [Sales: orders, more-orders] [People: people] [loose]
    const moved = moveNavGroup(nav, 1, 1)
    expect(moved.map(p => p.id)).toEqual(['home', 'people', 'orders', 'tab-only', 'more-orders', 'loose'])
    expect(navSections(moved).map(s => s.group)).toEqual([undefined, 'People', 'Sales', undefined])
    expect(moveNavGroup(nav, 0, -1)).toBe(nav)
    expect(moveNavGroup(nav, 3, 1)).toBe(nav)
    expect(describePagesChange(nav, moved)).toBe('Reordered pages')
  })

  it('has a dropped page join the section it lands inside', () => {
    const inside: FullstackPageDef[] = [nav[1], nav[5], nav[4]]
    expect(adoptedGroup(inside, 1)).toBe('Sales')
    expect(adoptedGroup([nav[1], nav[4], nav[5]], 2)).toBeUndefined()
    expect(adoptedGroup([nav[1], nav[3], nav[4]], 1)).toBeUndefined()
    expect(adoptedGroup([nav[1], { ...nav[5], group: 'Sales' }, nav[4]], 1)).toBeUndefined()
  })
})
