import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef, FullstackWidgetDef } from '../../types'
import seeded from './__fixtures__/fullstack-examples.json'
import { buildLayoutPreview } from './layoutPreviewModel'
import {
  dashboardFilterCandidates, describePage, drillToPages, MAX_DASHBOARD_FILTERS, resolveDashboardFilter, validatePages,
} from './pageLayout'

const entities: FullstackEntityDef[] = [
  { name: 'Region', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Sale',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'region', type: 'ENUM', enumValues: ['NORTH', 'SOUTH'], label: 'Sales region' },
      { name: 'paid', type: 'BOOLEAN' },
      { name: 'channel', type: 'ENUM', enumValues: ['WEB', 'SHOP'] },
      { name: 'secret', type: 'ENUM', enumValues: ['A', 'B'], filterable: false },
      { name: 'amount', type: 'BIG_DECIMAL' },
    ],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'office', targetEntity: 'Region' }],
  },
  {
    name: 'Lead',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      // Same name and values as Sale.region: one control can set both.
      { name: 'Region', type: 'ENUM', enumValues: ['NORTH', 'SOUTH'] },
      // Same name, other values: it cannot.
      { name: 'channel', type: 'ENUM', enumValues: ['PHONE', 'MAIL'] },
      // Same name, but a yes/no field here.
      { name: 'office', type: 'BOOLEAN' },
    ],
  },
]

const dash = (filters: string[] | undefined, widgets: FullstackWidgetDef[] = [
  { kind: 'kpi', entity: 'Sale' },
  { kind: 'bar', entity: 'Lead' },
], extra: FullstackPageDef[] = []): FullstackPageDef[] => [{ id: 'desk', type: 'dashboard', widgets, ...(filters ? { filters } : {}) }, ...extra]

describe('dashboard filters', () => {
  it('accepts enum, boolean and relation names the widgets’ entities agree on, ignoring case', () => {
    expect(validatePages(dash(['region', 'PAID']), entities).count).toBe(0)
    // A list widget's entity counts too; a text or links widget's does not.
    expect(validatePages(dash(['office'], [{ kind: 'list', entity: 'Sale' }, { kind: 'text', entity: '', text: 'x' }]), entities).count).toBe(0)
    expect(resolveDashboardFilter('REGION', [entities[1], entities[2]], entities)).toEqual(
      { name: 'region', field: entities[1].fields[1], entities: ['Sale', 'Lead'] })
  })

  it('names a filter none of the widgets’ entities has', () => {
    const v = validatePages(dash(['amount', 'secret', 'nope']), entities)
    expect(v.byPage[0].filters).toBe('none of the widgets’ entities filters by “amount”')
    expect(v.problems).toContain('Page “desk”: filter “amount” is not an enum, boolean or relation filter of any of its widgets’ entities (Sale, Lead)')
    // A field marked not filterable is not a filter either.
    expect(v.problems).toContain('Page “desk”: filter “secret” is not an enum, boolean or relation filter of any of its widgets’ entities (Sale, Lead)')
    expect(v.count).toBe(3)
  })

  it('rejects one name that is a different filter on two entities', () => {
    const v = validatePages(dash(['channel', 'office']), entities)
    expect(v.problems).toEqual([
      'Page “desk”: filter “channel” is the values WEB, SHOP on Sale but the values PHONE, MAIL on Lead — one control cannot set both',
      'Page “desk”: filter “office” is a link to Region on Sale but a yes/no field on Lead — one control cannot set both',
    ])
  })

  it('rejects blanks, duplicates and more than four', () => {
    const v = validatePages(dash(['region', 'Region', ' ']), entities)
    expect(v.problems).toEqual(['Page “desk”: filter “region” is listed twice', 'Page “desk”: a filter name is blank'])
    const many = validatePages(dash(['region', 'paid', 'office', 'region', 'paid'], [{ kind: 'kpi', entity: 'Sale' }]), entities)
    expect(many.problems[0]).toBe(`Page “desk” has more than ${MAX_DASHBOARD_FILTERS} filters`)
  })

  it('offers a fix that drops the bad filter', () => {
    const v = validatePages(dash(['region', 'nope']), entities)
    const issue = v.issues.find(i => i.field === 'filters')!
    expect(issue.fix?.label).toBe('Drop the “nope” filter')
    expect(issue.fix!.apply(dash(['region', 'nope']))[0].filters).toEqual(['region'])
    expect('filters' in validatePages(dash(['nope']), entities).issues[0].fix!.apply(dash(['nope']))[0]).toBe(false)
  })

  it('flags a filter no widget takes once the widgets change', () => {
    expect(validatePages(dash(['paid'], [{ kind: 'kpi', entity: 'Lead' }]), entities).byPage[0].filters)
      .toBe('none of the widgets’ entities filters by “paid”')
  })

  it('is for dashboards only', () => {
    const pages: FullstackPageDef[] = [{ id: 'sales', type: 'entity-list', entity: 'Sale', filters: ['region'] }]
    const v = validatePages(pages, entities)
    expect(v.problems).toEqual(['Page “sales” (entity-list) does not take filters (only a dashboard does — a list or report page has its own filter bar)'])
    expect(v.issues[0].fix!.apply(pages)[0]).toEqual({ id: 'sales', type: 'entity-list', entity: 'Sale' })
  })

  it('lists the candidates one control can set: agreeing names once, conflicting ones not at all', () => {
    expect(dashboardFilterCandidates(dash(undefined)[0], entities).map(c => [c.name, c.entities])).toEqual([
      ['region', ['Sale', 'Lead']],
      ['paid', ['Sale']],
    ])
    expect(dashboardFilterCandidates(dash(undefined, [{ kind: 'kpi', entity: 'Sale' }])[0], entities).map(c => c.name))
      .toEqual(['region', 'paid', 'channel', 'office'])
    expect(dashboardFilterCandidates(dash(undefined, [{ kind: 'text', entity: '', text: 'x' }])[0], entities)).toEqual([])
  })

  it('shows in the summary and as a filter row in the preview', () => {
    const pages = dash(['region', 'office'], [{ kind: 'kpi', entity: 'Sale' }])
    expect(describePage(pages[0], pages)).toBe('1 number tile · filters: region, office')
    const screen = buildLayoutPreview(pages, entities, { locale: 'en', projectOpts: [] }).screens[0]
    expect(screen.type === 'dashboard' && screen.filters).toEqual(['Sales region', 'Office'])
    const plain = buildLayoutPreview(dash(undefined), entities, { locale: 'en', projectOpts: [] }).screens[0]
    expect(plain.type === 'dashboard' && plain.filters).toEqual([])
  })
})

describe('a widget’s click target (drillTo)', () => {
  const lists: FullstackPageDef[] = [
    { id: 'sales', type: 'entity-list', entity: 'Sale' },
    { id: 'revenue', type: 'report', entity: 'Sale', chart: {} },
    { id: 'north', type: 'entity-list', entity: 'Sale', hidden: true, presetFilter: { region: 'NORTH' } },
    { id: 'leads', type: 'entity-list', entity: 'Lead' },
    { id: 'by-office', type: 'master-detail', parent: 'Region', child: 'Sale' },
    { id: 'q', type: 'tabs', title: 'Q', tabs: [{ page: 'north' }, { page: 'sales' }] },
  ]
  const withDrill = (drillTo: string, kind: FullstackWidgetDef['kind'] = 'bar', entity = 'Sale') =>
    [{ id: 'desk', type: 'dashboard' as const, widgets: [{ kind, entity, drillTo }] }, ...lists]

  it('offers the visible list and report pages of the widget’s entity', () => {
    expect(drillToPages(lists, 'sale').map(p => p.id)).toEqual(['sales', 'revenue'])
    expect(validatePages(withDrill('revenue'), entities).count).toBe(0)
    expect(validatePages(withDrill('sales', 'list'), entities).count).toBe(0)
    expect(validatePages(withDrill('sales', 'kpi'), entities).count).toBe(0)
  })

  it('rejects a missing, wrong-type, hidden or other-entity page', () => {
    const msg = (drillTo: string) => validatePages(withDrill(drillTo), entities).byPage[0]['widget.0.drillTo']
    expect(msg('gone')).toBe('no page “gone”')
    expect(msg('by-office')).toBe('“Region” must be an entity-list or report page')
    expect(msg('north')).toBe('“Sale” is hidden, so it cannot be opened from a widget')
    expect(msg('leads')).toBe('“Lead” shows Lead, not Sale')
    expect(validatePages(withDrill('leads'), entities).problems)
      .toContain('Page “desk” has a widget whose clicks open “Lead”, which shows Lead, not Sale')
  })

  it('fixes a bad one by going back to the entity’s own list', () => {
    const pages = withDrill('gone')
    const issue = validatePages(pages, entities).issues.find(i => i.field === 'widget.0.drillTo')!
    expect(issue.fix!.label).toBe('Open Sale’s own list from widget 1')
    expect(issue.fix!.apply(pages)[0].widgets).toEqual([{ kind: 'bar', entity: 'Sale' }])
  })

  it('is not for a note or a launcher', () => {
    const pages: FullstackPageDef[] = [{ id: 'desk', type: 'dashboard', widgets: [{ kind: 'text', entity: '', text: 'x', drillTo: 'sales' }] }, ...lists]
    expect(validatePages(pages, entities).byPage[0]['widget.0.drillTo']).toBe('a text widget opens no page on click')
  })

  it('silences the “clicking a bar goes nowhere” warning', () => {
    const report: FullstackPageDef = { id: 'revenue', type: 'report', entity: 'Sale', chart: {} }
    const bare: FullstackPageDef[] = [{ id: 'desk', type: 'dashboard', widgets: [{ kind: 'bar', entity: 'Sale' }] }, report]
    expect(validatePages(bare, entities).warnings.map(w => w.key)).toContain('chart-dead-end:desk:sale')
    const drilled: FullstackPageDef[] = [{ id: 'desk', type: 'dashboard', widgets: [{ kind: 'bar', entity: 'Sale', drillTo: 'revenue' }] }, report]
    expect(validatePages(drilled, entities).warnings.map(w => w.key)).not.toContain('chart-dead-end:desk:sale')
  })
})

describe('the seeded Sales reporting example', () => {
  it('carries a region filter and a drill-down to its report, and validates clean', () => {
    const example = (seeded as unknown as { id: string; entities: FullstackEntityDef[]; pages: FullstackPageDef[]; settings?: { scaffold?: string[] } }[])
      .find(ex => ex.id === 'reporting')!
    const report = example.pages.find(p => p.id === 'report')!
    expect(report.filters).toEqual(['region'])
    expect(report.widgets?.find(w => w.title === 'Revenue by region')?.drillTo).toBe('revenue')
    expect(validatePages(example.pages, example.entities, { ldapAuth: true, scaffoldOpts: example.settings?.scaffold }).problems).toEqual([])
  })
})
