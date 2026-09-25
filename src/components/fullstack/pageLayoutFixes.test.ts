import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { validatePages } from './pageLayout'

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Order',
    fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'status', type: 'ENUM', enumValues: ['OPEN'], required: true }],
    relations: [
      { type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' },
      { type: 'MANY_TO_ONE', fieldName: 'billTo', targetEntity: 'Customer' },
    ],
  },
]

/** The fix attached to the issue on `field` (the first issue with a fix when no field is named). */
const fixOf = (pages: FullstackPageDef[], field?: string) =>
  validatePages(pages, entities).issues.find(i => (field ? i.field === field : Boolean(i.fix)))?.fix
/** The removal a stale entity offers — beside "Switch to …" when the model has a likely replacement. */
const removalOf = (pages: FullstackPageDef[], field: string) => {
  const issue = validatePages(pages, entities).issues.find(i => i.field === field)
  return issue?.alsoFix ?? issue?.fix
}

describe('validatePages fixes', () => {
  it('removes a page whose entity is gone, and the tabs that embedded it', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }] },
      { id: 'gone', type: 'entity-list', entity: 'Product', hidden: true },
      { id: 'q', type: 'tabs', title: 'Q', tabs: [{ page: 'gone' }, { page: 'home' }] },
    ]
    const fix = removalOf(pages, 'entity')!
    expect(fix.label).toBe('Remove the “Product” page')
    const next = fix.apply(pages)
    expect(next.map(p => p.id)).toEqual(['home', 'q'])
    expect(next[1].tabs).toEqual([{ page: 'home' }])
    // The other pages are the same objects: nothing else was touched.
    expect(next[0]).toBe(pages[0])
  })

  it('removes a widget for a missing entity, or the page when it was the only widget', () => {
    const two: FullstackPageDef[] = [{ id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }, { kind: 'kpi', entity: 'Product' }] }]
    const fix = removalOf(two, 'widget.1')!
    expect(fix.label).toBe('Remove widget 2')
    expect(fix.apply(two)[0].widgets).toEqual([{ kind: 'kpi', entity: 'Order' }])
    const one: FullstackPageDef[] = [
      { id: 'orders', type: 'entity-list', entity: 'Order' },
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Product' }] },
    ]
    expect(removalOf(one, 'widget.0')!.apply(one).map(p => p.id)).toEqual(['orders'])
  })

  it('offers to switch a stale page or widget to the one entity the layout does not mention yet', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }, { kind: 'kpi', entity: 'Client' }] },
      { id: 'clients', type: 'entity-list', entity: 'Client', columns: ['name'], sort: { field: 'name', dir: 'asc' } },
    ]
    const page = validatePages(pages, entities).issues.find(i => i.page === 1 && i.field === 'entity')!
    expect(page.fix!.label).toBe('Switch to Customer')
    expect(page.alsoFix!.label).toBe('Remove the “Client” page')
    const switched = page.fix!.apply(pages)
    expect(switched[1]).toMatchObject({ entity: 'Customer', columns: ['name'], sort: { field: 'name', dir: 'asc' } })
    const widget = validatePages(switched, entities).issues.find(i => i.field === 'widget.1')!
    // Customer is mentioned now, so nothing is left to switch to: the widget can only go.
    expect(widget.fix!.label).toBe('Remove widget 2')
    expect(widget.alsoFix).toBeUndefined()
    expect(validatePages(pages, entities).issues.find(i => i.field === 'widget.1')!.fix!.label).toBe('Switch widget 2 to Customer')
  })

  it('picks the first relation for an ambiguous master-detail link', () => {
    const pages: FullstackPageDef[] = [{ id: 'c', type: 'master-detail', parent: 'Customer', child: 'Order' }]
    const fix = fixOf(pages, 'via')!
    expect(fix.label).toBe('Link through “customer”')
    const next = fix.apply(pages)
    expect(next[0].via).toBe('customer')
    expect(validatePages(next, entities).count).toBe(0)
  })

  it('adds the required fields a wizard never asks for to its last step', () => {
    const pages: FullstackPageDef[] = [
      { id: 'orders', type: 'entity-list', entity: 'Order' },
      { id: 'w', type: 'wizard', entity: 'Order', steps: [{ fields: ['customer'] }, { fields: ['billTo'] }] },
    ]
    const fix = fixOf(pages, 'steps')!
    expect(fix.label).toBe('Add id, status to the last step')
    const next = fix.apply(pages)
    expect(next[1].steps).toEqual([{ fields: ['customer'] }, { fields: ['billTo', 'id', 'status'] }])
    expect(validatePages(next, entities).count).toBe(0)
  })

  it('removes a stale related-list tab or header tile from a record page', () => {
    const pages: FullstackPageDef[] = [
      { id: 'orders', type: 'entity-list', entity: 'Order' },
      { id: 'c', type: 'record', entity: 'Customer', childTabs: ['Order', 'Invoice'], headerStats: [{ child: 'Invoice', title: 'Invoices' }] },
    ]
    const tab = fixOf(pages, 'childTab.1')!
    expect(tab.label).toBe('Remove the Invoice tab')
    expect(tab.apply(pages)[1].childTabs).toEqual(['Order'])
    const tile = fixOf(pages, 'headerStat.0')!
    expect(tile.label).toBe('Remove the Invoices tile')
    expect(tile.apply(pages)[1].headerStats).toEqual([])
  })

  it('offers no fix when a page merely lacks an entity, or when nothing is wrong', () => {
    expect(fixOf([{ id: 'x', type: 'entity-list' }], 'entity')).toBeUndefined()
    expect(fixOf([{ id: 'orders', type: 'entity-list', entity: 'Order' }])).toBeUndefined()
  })
})
