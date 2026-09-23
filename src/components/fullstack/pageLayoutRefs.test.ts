import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import {
  defaultBarGroupBy, defaultLineGroupBy, defaultOptionLabel, defaultReportGroupBy, describePagesChange,
  dropTabsTo, duplicatePage, pageFromSuggestion, pagesEmbedding, renamePageIdInPages, renameRelationInPages,
  suggestPages, validatePages,
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
    expect(keys).toEqual(['md:Customer:Order', 'record:Customer', 'report:Order', 'trend:Order'])

    const added: FullstackPageDef[] = []
    for (const s of suggestPages(entities, [], 10)) added.push(pageFromSuggestion(s, added.map(p => p.id)))
    expect(added.map(p => p.id)).toEqual(['customer', 'customer-2', 'order-report', 'order-trends'])
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
