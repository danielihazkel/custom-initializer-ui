import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../../types'
import { validatePages } from '../pageLayout'
import { duplicatePages, removePages, setPagesGroup, setPagesHidden, setPagesRoles } from './bulkPages'

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Order',
    fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] }],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
  },
]

const layout: FullstackPageDef[] = [
  { id: 'orders', type: 'entity-list', entity: 'Order', title: 'Orders' },
  { id: 'customers', type: 'entity-list', entity: 'Customer', title: 'Customers' },
  { id: 'customer', type: 'record', entity: 'Customer', hidden: true },
  { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'orders' }, { page: 'customers' }] },
]

describe('bulk page actions', () => {
  it('hide drops the nav group and icon, show brings pages back, record pages stay as they are', () => {
    const grouped: FullstackPageDef[] = layout.map(p => (p.id === 'orders' ? { ...p, group: 'Sales', icon: 'ShoppingCart' as const } : p))
    const hidden = setPagesHidden(grouped, ['orders', 'customer'], true)
    expect(hidden[0]).toMatchObject({ hidden: true, group: undefined, icon: undefined })
    expect(hidden[2]).toBe(grouped[2])
    expect(setPagesHidden(hidden, ['orders'], false)[0].hidden).toBe(false)
  })
  it('groups and roles apply to nav pages only, and the start page keeps no roles', () => {
    const grouped = setPagesGroup(layout, ['orders', 'customer', 'queue'], ' Work ')
    expect(grouped.map(p => p.group)).toEqual(['Work', undefined, undefined, 'Work'])
    expect(setPagesGroup(grouped, ['orders'], '')[0].group).toBeUndefined()
    const roled = setPagesRoles(layout, ['orders', 'customers'], ['ADMIN'])
    expect(roled[0].roles).toBeUndefined() // the start page
    expect(roled[1].roles).toEqual(['ADMIN'])
    expect(setPagesRoles(roled, ['customers'], [])[1].roles).toBeUndefined()
  })
  it('duplicates each copyable page after itself, and removes pages with what pointed at them', () => {
    const copied = duplicatePages(layout, ['orders', 'customer'])
    expect(copied.map(p => p.id)).toEqual(['orders', 'orders-copy', 'customers', 'customer', 'queue'])
    const removed = removePages(layout, ['orders', 'customer'])
    expect(removed.map(p => p.id)).toEqual(['customers', 'queue'])
    expect(removed[1].tabs).toEqual([{ page: 'customers' }])
  })
})

describe('warning keys', () => {
  it('name the kind and the page, so a reorder keeps a dismissal', () => {
    const pages: FullstackPageDef[] = [
      { id: 'orders-tab', type: 'entity-list', entity: 'Order', hidden: true },
      { id: 'home', type: 'dashboard', title: 'Home', widgets: [{ kind: 'bar', entity: 'Customer' }] },
    ]
    const keys = validatePages(pages, entities).warnings.map(w => w.key)
    expect(keys).toEqual(['unreachable:orders-tab', 'chart-dead-end:home:customer'])
    const reordered = validatePages([pages[1], pages[0]], entities, { dismissed: ['unreachable:orders-tab'] })
    expect(reordered.warnings.map(w => w.key)).toEqual(['chart-dead-end:home:customer'])
    expect(reordered.dismissedWarnings.map(w => w.page)).toEqual([1])
    expect(reordered.warningsByPage).toEqual({ 0: 1 })
  })
})
