import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef, FullstackWidgetDef } from '../../types'
import { ADVICE, validatePages } from './pageLayout'

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Order',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] },
      { name: 'paid', type: 'BOOLEAN' },
    ],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
  },
  // Linked to nothing: a forgotten entity when no page names it.
  { name: 'AuditNote', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'text', type: 'STRING' }] },
]

const warnings = (pages: FullstackPageDef[], model = entities) => validatePages(pages, model).warnings
const keys = (pages: FullstackPageDef[], model = entities) => warnings(pages, model).map(w => w.key)
const notes: FullstackPageDef = { id: 'notes', type: 'entity-list', entity: 'AuditNote' }

describe('layout advice', () => {
  it('suggests grouping a long navigation, and groups it by what each page is for', () => {
    const lists: FullstackPageDef[] = Array.from({ length: ADVICE.navItems }, (_, i) => ({ id: `orders-${i}`, type: 'entity-list', entity: 'Order', presetFilter: { paid: i % 2 ? 'true' : 'false' }, view: i < 2 ? undefined : 'table' as const, title: `Orders ${i}` }))
    const pages: FullstackPageDef[] = [{ id: 'home', type: 'dashboard', widgets: [] }, ...lists, notes]
    const w = warnings(pages).find(x => x.key === 'crowded-nav:layout')
    expect(w?.page).toBeUndefined()
    expect(w?.summary).toBe(`The navigation lists ${ADVICE.navItems + 2} pages with no sections — group them so the menu stays scannable`)
    const grouped = w!.fix!.apply(pages)
    expect(grouped[0].group).toBe('Insights')
    expect(grouped[1].group).toBe('Data')
    expect(keys(grouped)).not.toContain('crowded-nav:layout')
    // One section already named, or a short menu: no advice.
    expect(keys(pages.map((p, i) => (i === 1 ? { ...p, group: 'Sales' } : p)))).not.toContain('crowded-nav:layout')
    expect(keys(pages.slice(0, 4))).not.toContain('crowded-nav:layout')
  })

  it('says when a dashboard is crowded, with no fix', () => {
    const many: FullstackWidgetDef[] = Array.from({ length: ADVICE.dashboardWidgets }, () => ({ kind: 'kpi', entity: 'Order' }))
    const w = warnings([{ id: 'home', type: 'dashboard', widgets: many }, { id: 'orders', type: 'entity-list', entity: 'Order' }, notes])
      .find(x => x.key === 'crowded-dashboard:home')
    expect(w?.summary).toBe(`Page “Dashboard” has ${ADVICE.dashboardWidgets} widgets — consider splitting it into a tabs page or a second dashboard`)
    expect(w?.fix).toBeUndefined()
    expect(keys([{ id: 'home', type: 'dashboard', widgets: many.slice(1) }, notes])).not.toContain('crowded-dashboard:home')
  })

  it('suggests fewer columns on a wide list, keeping the first ones', () => {
    const wide: FullstackEntityDef = {
      name: 'Wide',
      fields: [{ name: 'id', type: 'LONG', primaryKey: true }, ...Array.from({ length: ADVICE.listColumns - 1 }, (_, i) => ({ name: `f${i}`, type: 'STRING' as const }))],
    }
    const pages: FullstackPageDef[] = [{ id: 'wide', type: 'entity-list', entity: 'Wide' }]
    const w = warnings(pages, [wide]).find(x => x.key === 'wide-list:wide')
    expect(w?.summary).toBe(`Page “Wide” shows ${ADVICE.listColumns} columns — a list reads best with ${ADVICE.keepColumns} or fewer`)
    const fixed = w!.fix!.apply(pages)
    expect(fixed[0].columns).toEqual(['id', 'f0', 'f1', 'f2', 'f3', 'f4'])
    expect(keys(fixed, [wide])).not.toContain('wide-list:wide')
    // One column fewer reads fine.
    expect(keys([{ ...pages[0], columns: ['id', 'f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'] }], [wide])).not.toContain('wide-list:wide')
  })

  it('flags the same list twice in the navigation, and removes the second', () => {
    const pages: FullstackPageDef[] = [
      { id: 'orders', type: 'entity-list', entity: 'Order' },
      { id: 'all-orders', type: 'entity-list', entity: 'Order', title: 'All orders' },
      { id: 'paid', type: 'entity-list', entity: 'Order', presetFilter: { paid: 'true' }, title: 'Paid' },
      notes,
    ]
    const w = warnings(pages).find(x => x.key === 'duplicate-list:all-orders')
    expect(w?.summary).toBe('Page “All orders” lists the same Order rows as “Order”')
    expect(w!.fix!.apply(pages).map(p => p.id)).toEqual(['orders', 'paid', 'notes'])
    // A list with its own preset is another list.
    expect(keys(pages)).not.toContain('duplicate-list:paid')
  })

  it('flags an entity the layout forgot, but not a lookup shown through a relation', () => {
    const pages: FullstackPageDef[] = [{ id: 'orders', type: 'entity-list', entity: 'Order' }]
    const forgotten = warnings(pages).filter(w => w.key.startsWith('entity-without-page:'))
    expect(forgotten.map(w => w.summary)).toEqual(['No page shows AuditNote — the app offers no way to browse or edit its rows'])
    expect(forgotten[0].fix!.apply(pages).map(p => p.entity)).toEqual(['Order', 'AuditNote'])
    // Customer is linked from Order, so it is not flagged; nothing at all is said before the first page.
    expect(keys([])).toEqual([])
  })

  it('flags a pivot with no list to drill into', () => {
    const pages: FullstackPageDef[] = [{ id: 'home', type: 'dashboard', widgets: [{ kind: 'pivot', entity: 'Order', groupBy: 'status', series: 'paid' }] }, notes]
    const w = warnings(pages).find(x => x.key === 'pivot-dead-end:home:order')
    expect(w?.summary).toBe('Page “Dashboard”: clicking a cell of the Order pivot goes nowhere — Order has no list page in the navigation')
    expect(keys(w!.fix!.apply(pages))).not.toContain('pivot-dead-end:home:order')
  })
})
