import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { validatePages } from './pageLayout'

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Order',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] },
      { name: 'placedOn', type: 'LOCAL_DATE' },
    ],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
  },
]

const summaries = (pages: FullstackPageDef[], model = entities) => validatePages(pages, model).warnings.map(w => w.summary)

describe('validatePages warnings', () => {
  it('are advice: never counted, never an error', () => {
    const v = validatePages([
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'bar', entity: 'Order' }] },
    ], entities)
    expect(v.count).toBe(0)
    expect(v.issues).toEqual([])
    expect(v.warnings).toHaveLength(1)
    expect(v.warningsByPage).toEqual({ 0: 1 })
  })

  it('flags a chart whose entity has no list page in the navigation, once per entity, with a fix', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'bar', entity: 'Order' }, { kind: 'donut', entity: 'Order' }] },
      { id: 'orders', type: 'entity-list', entity: 'Order', hidden: true },
      { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'orders' }, { page: 'home' }] },
    ]
    const { warnings } = validatePages(pages, entities)
    expect(warnings.map(w => w.summary)).toEqual([
      'Page “Dashboard”: clicking a bar of the Order chart goes nowhere — Order has no list page in the navigation',
    ])
    expect(warnings[0].field).toBe('widget.0')
    const fixed = warnings[0].fix!.apply(pages)
    expect(fixed.at(-1)).toEqual({ id: 'orders-2', type: 'entity-list', entity: 'Order' })
    expect(summaries(fixed)).toEqual([])
  })

  it('flags recent rows without a record page and offers a hidden one', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'recent', entity: 'Customer' }] },
      { id: 'customers', type: 'entity-list', entity: 'Customer' },
    ]
    const { warnings } = validatePages(pages, entities)
    expect(warnings.map(w => w.summary)).toEqual(['Page “Dashboard”: the recent Customer rows open nothing — Customer has no record page'])
    expect(warnings[0].fix!.apply(pages).at(-1)).toEqual({ id: 'customer', type: 'record', entity: 'Customer', hidden: true })
  })

  it('flags a hidden page nothing embeds, and roles that never apply', () => {
    const pages: FullstackPageDef[] = [
      { id: 'orders', type: 'entity-list', entity: 'Order' },
      { id: 'paid', type: 'entity-list', entity: 'Order', hidden: true, presetFilter: { status: 'PAID' }, roles: ['ADMIN'] },
    ]
    const { warnings } = validatePages(pages, entities)
    expect(warnings.map(w => [w.field, w.summary])).toEqual([
      ['page', 'Page “Order” is hidden but no tabs page embeds it, so nothing opens it'],
      ['roles', 'Page “Order” is restricted to roles, but it is out of the navigation, so the roles never apply'],
    ])
    expect(warnings[0].fix!.apply(pages)[1].hidden).toBe(false)
    expect(warnings[1].fix!.apply(pages)[1].roles).toBeUndefined()
    // A hidden wizard is a route of its own, so it is not a dead end.
    expect(summaries([pages[0], { id: 'new-order', type: 'wizard', entity: 'Order', hidden: true }])).toEqual([])
  })

  it('says which widgets a period picker cannot limit', () => {
    expect(summaries([
      { id: 'home', type: 'dashboard', dateRange: '30d', widgets: [{ kind: 'kpi', entity: 'Order' }, { kind: 'kpi', entity: 'Customer' }, { kind: 'text', text: 'Hi' }] },
      { id: 'orders', type: 'entity-list', entity: 'Order' },
    ])).toEqual(['Page “Dashboard”: one widget has no date, so the period picker does not limit it'])
  })

  it('names the silent caps on a record page and picks the first ones as the fix', () => {
    const children: FullstackEntityDef[] = ['A', 'B', 'C', 'D', 'E', 'F'].map(name => ({
      name,
      fields: [{ name: 'id', type: 'LONG', primaryKey: true }],
      relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
    }))
    const model = [entities[0], ...children]
    const pages: FullstackPageDef[] = [
      { id: 'customers', type: 'entity-list', entity: 'Customer' },
      { id: 'customer', type: 'record', entity: 'Customer', hidden: true },
    ]
    const { warnings } = validatePages(pages, model)
    expect(warnings.map(w => w.summary)).toEqual([
      'Page “Customer” shows only the first 5 of its 6 related lists',
      'Page “Customer” shows only the first 4 of its 6 header numbers',
    ])
    expect(warnings[0].fix!.apply(pages)[1].childTabs).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(warnings[1].fix!.apply(pages)[1].headerStats).toEqual([{ child: 'A' }, { child: 'B' }, { child: 'C' }, { child: 'D' }])
    // Explicit choices silence them.
    expect(summaries([pages[0], { ...pages[1], childTabs: ['A', 'B'], headerStats: [] }], model)).toEqual([])
  })
})
