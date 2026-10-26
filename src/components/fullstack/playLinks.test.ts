import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { buildPlayLinks, pageLinks } from './playLinks'

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Order',
    fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] }],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
  },
]

const pages: FullstackPageDef[] = [
  {
    id: 'desk', type: 'dashboard', widgets: [
      { kind: 'kpi', entity: 'Order' },
      { kind: 'links', entity: '', pages: ['customers', 'new-order', 'gone'] },
      { kind: 'recent', entity: 'Order' },
      { kind: 'list', entity: 'Customer' },
      { kind: 'bar', entity: 'Order', drillTo: 'sales' },
    ],
  },
  { id: 'orders', type: 'entity-list', entity: 'Order' },
  { id: 'customers', type: 'entity-list', entity: 'Customer', detail: 'side' },
  { id: 'order', type: 'record', entity: 'Order', hidden: true },
  { id: 'new-order', type: 'wizard', entity: 'Order', hidden: true },
  { id: 'sales', type: 'report', entity: 'Order' },
  { id: 'customer', type: 'record', entity: 'Customer', hidden: true },
]

describe('buildPlayLinks', () => {
  const links = buildPlayLinks(pages, entities)

  it('opens a list row on its record page and New in the wizard', () => {
    expect(links[1]).toMatchObject({ row: 3, create: 4 })
    // A side pane opens no page, and says so.
    expect(links[2].row).toBeNull()
    expect(links[2].rowNote).toMatch(/pane/)
  })

  it('takes a record back to its home, a wizard to the new row, a report into its list', () => {
    expect(links[3].back).toBe(1)
    expect(links[4].afterSave).toBe(3)
    expect(links[5].drill).toBe(1)
    // A customer's related tab lists orders, whose rows open the order page.
    expect(links[6].childRows).toEqual([3])
  })

  it('drills a dashboard card into its list (or its own page), and follows link tiles', () => {
    const [kpi, tiles, recent, list, bar] = links[0].widgets
    expect(kpi).toMatchObject({ open: 1, rows: 3 })
    expect(tiles.tiles).toEqual([2, 4, null])
    expect(recent.rows).toBe(3)
    expect(list.open).toBe(2)
    expect(bar.open).toBe(5)
  })
})

describe('pageLinks', () => {
  it('finds an entity home through a tabs page when its list is tab-only', () => {
    const tabbed: FullstackPageDef[] = [
      { id: 'l', type: 'entity-list', entity: 'Order', hidden: true },
      { id: 'c', type: 'entity-list', entity: 'Customer', hidden: true },
      { id: 't', type: 'tabs', title: 'Work', tabs: [{ page: 'l' }, { page: 'c' }] },
    ]
    const links = pageLinks(tabbed)
    expect(links.homeOf('order')).toBe(2)
    // A drill-down needs a visible list; a tab-only one is not.
    expect(links.listOf('Order')).toBeNull()
  })
})
