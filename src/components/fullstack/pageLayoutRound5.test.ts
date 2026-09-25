import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import {
  canDuplicate, duplicatePage, groupByFields, groupableFields, removePageAt, renameFieldInPages,
  renameRelationInPages, validatePages,
} from './pageLayout'

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Order',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] },
      { name: 'channel', type: 'ENUM', enumValues: ['WEB', 'SHOP'], filterable: false },
      { name: 'total', type: 'BIG_DECIMAL' },
    ],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
  },
]

describe('removing a page', () => {
  it('drops the links to it and, for the only record page, the lists that opened rows there', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'links', entity: '', pages: ['orders', 'order'] }] },
      { id: 'orders', type: 'entity-list', entity: 'Order', detail: 'record' },
      { id: 'order', type: 'record', entity: 'Order', hidden: true },
      { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'orders' }, { page: 'home' }] },
    ]
    const next = removePageAt(pages, 2)
    expect(next.map(p => p.id)).toEqual(['home', 'orders', 'queue'])
    expect(next[0].widgets?.[0].pages).toEqual(['orders'])
    expect(next[1].detail).toBeUndefined()
    expect(validatePages(next, entities).count).toBe(0)
  })

  it('leaves the tabs that embed it unless asked, and untouched pages as they were', () => {
    const pages: FullstackPageDef[] = [
      { id: 'orders', type: 'entity-list', entity: 'Order', hidden: true },
      { id: 'all', type: 'entity-list', entity: 'Order' },
      { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'orders' }, { page: 'all' }] },
    ]
    expect(removePageAt(pages, 0, false)[1].tabs).toEqual([{ page: 'orders' }, { page: 'all' }])
    const dropped = removePageAt(pages, 0)
    expect(dropped[1].tabs).toEqual([{ page: 'all' }])
    expect(dropped[0]).toBe(pages[1])
  })
})

describe('duplicating a page', () => {
  it('is not offered for the pages a layout holds one of', () => {
    expect(canDuplicate({ id: 'w', type: 'wizard', entity: 'Order' })).toBe(false)
    expect(canDuplicate({ id: 'r', type: 'record', entity: 'Order' })).toBe(false)
    expect(canDuplicate({ id: 'l', type: 'entity-list', entity: 'Order' })).toBe(true)
  })

  it('puts a copy of a tab-only page in the nav, where it can be reached', () => {
    const copy = duplicatePage({ id: 'open', type: 'entity-list', entity: 'Order', hidden: true, title: 'Open' }, ['open'])
    expect(copy.hidden).toBeUndefined()
    expect(copy.id).toBe('open-copy')
  })
})

describe('renames reaching every list', () => {
  it('follows a field into a master-detail child list and a record page tab', () => {
    const pages: FullstackPageDef[] = [
      { id: 'browse', type: 'master-detail', parent: 'Customer', child: 'Order', columns: ['status', 'total'], sort: { field: 'total', dir: 'desc' } },
      { id: 'customer', type: 'record', entity: 'Customer', hidden: true, childTabs: [{ entity: 'Order', columns: ['total'], sort: { field: 'total', dir: 'asc' } }] },
    ]
    const next = renameFieldInPages(pages, 'Order', 'total', 'amount')
    expect(next[0]).toMatchObject({ columns: ['status', 'amount'], sort: { field: 'amount', dir: 'desc' } })
    expect(next[1].childTabs).toEqual([{ entity: 'Order', columns: ['amount'], sort: { field: 'amount', dir: 'asc' } }])
  })

  it('follows a relation into the same lists', () => {
    const pages: FullstackPageDef[] = [
      { id: 'browse', type: 'master-detail', parent: 'Customer', child: 'Order', columns: ['customer', 'total'] },
      { id: 'customer', type: 'record', entity: 'Customer', hidden: true, childTabs: [{ entity: 'Order', columns: ['customer'] }] },
    ]
    const next = renameRelationInPages(pages, 'Order', 'customer', 'buyer')
    expect(next[0].columns).toEqual(['buyer', 'total'])
    expect(next[1].childTabs).toEqual([{ entity: 'Order', columns: ['buyer'] }])
  })
})

describe('grouping by a field the list cannot filter on', () => {
  it('is fine for a chart, as it is for the generator — only presets need a filterable field', () => {
    const order = entities[1]
    expect(groupByFields(order).map(f => f.name)).toEqual(['status', 'channel'])
    expect(groupableFields(order).map(f => f.name)).toEqual(['status'])
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'bar', entity: 'Order', groupBy: 'channel' }, { kind: 'stacked', entity: 'Order', groupBy: 'status', series: 'channel' }] },
      { id: 'sales', type: 'report', entity: 'Order', chart: { groupBy: 'channel' } },
    ]
    expect(validatePages(pages, entities).count).toBe(0)
  })
})

describe('widget errors', () => {
  it('are keyed by the control they are about', () => {
    const v = validatePages([{ id: 'home', type: 'dashboard', widgets: [{ kind: 'progress', entity: 'Order', groupBy: 'nope' }] }], entities)
    expect(Object.keys(v.byPage[0] ?? {})).toEqual(expect.arrayContaining(['widget.0.target']))
    expect(v.byPage[0]?.['widget.0.entity']).toBeUndefined()
  })
})
