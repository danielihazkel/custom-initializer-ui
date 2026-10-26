import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { MENU, buildPageFlow } from './pageFlow'

const entities: FullstackEntityDef[] = [
  {
    name: 'Order',
    fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] }],
  },
]

const pages: FullstackPageDef[] = [
  { id: 'desk', type: 'dashboard', widgets: [{ kind: 'bar', entity: 'Order' }, { kind: 'links', entity: '', pages: ['sales'] }, { kind: 'text', entity: '', text: 'Hi' }] },
  { id: 'orders', type: 'entity-list', entity: 'Order' },
  { id: 'order', type: 'record', entity: 'Order', hidden: true },
  { id: 'new-order', type: 'wizard', entity: 'Order', hidden: true },
  { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'open' }, { page: 'orders' }] },
  { id: 'open', type: 'entity-list', entity: 'Order', hidden: true },
  { id: 'sales', type: 'report', entity: 'Order', hidden: true },
  { id: 'notes', type: 'content', title: 'Notes', body: 'See [orders](#/orders).', hidden: true },
]

describe('buildPageFlow', () => {
  const flow = buildPageFlow(pages, entities)
  const kinds = (from: number, to: number) => flow.edges.find(e => e.from === from && e.to === to)?.kinds

  it('collects every way one page leads to another, once per pair', () => {
    expect(kinds(MENU, 0)).toEqual(['nav'])
    expect(kinds(0, 1)).toEqual(['drill'])
    expect(kinds(0, 6)).toEqual(['link'])
    expect(kinds(1, 2)).toEqual(['row'])
    expect(kinds(1, 3)).toEqual(['create'])
    expect(kinds(2, 1)).toEqual(['back'])
    expect(kinds(3, 2)).toEqual(['save'])
    expect(kinds(4, 5)).toEqual(['tab'])
    expect(kinds(6, 1)).toEqual(['drill'])
    expect(kinds(7, 1)).toEqual(['link'])
    // The open-orders tab is a list too: its rows open the record, its New the wizard.
    expect(kinds(5, 2)).toEqual(['row'])
    expect(new Set(flow.edges.map(e => `${e.from}>${e.to}`)).size).toBe(flow.edges.length)
  })

  it('lays pages out by clicks from the menu, with what nothing leads to last', () => {
    expect(flow.depth).toEqual([1, 1, 2, 2, 1, 2, 2, null])
    expect(flow.columns).toEqual([[0, 1, 4], [2, 3, 5, 6], [7]])
    expect(flow.unreachable).toEqual([7])
  })

  it('reaches a header-search page from the menu even when it is hidden', () => {
    const withSearch: FullstackPageDef[] = [...pages, { id: 'find', type: 'search', hidden: true, shellSearch: true }]
    const f = buildPageFlow(withSearch, entities)
    expect(f.edges.find(e => e.from === MENU && e.to === 8)?.kinds).toEqual(['search'])
    expect(f.depth[8]).toBe(1)
  })
})
