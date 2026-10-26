import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { validatePages } from './pageLayout'
import { pageParts, placePart, type PlacedPart } from './pageParts'

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }, { name: 'name', type: 'STRING', required: true }] },
  {
    name: 'Order',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true, generated: true },
      { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] },
      { name: 'total', type: 'BIG_DECIMAL' },
      { name: 'placedOn', type: 'LOCAL_DATE' },
    ],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
  },
  {
    name: 'Ticket',
    fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }, { name: 'subject', type: 'STRING' }],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
  },
]

const pages: FullstackPageDef[] = [
  { id: 'orders', type: 'entity-list', entity: 'Order' },
  { id: 'tickets', type: 'entity-list', entity: 'Ticket' },
  { id: 'desk', type: 'dashboard', widgets: [{ kind: 'text', entity: '', text: 'Hi' }] },
  { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'orders' }, { page: 'tickets' }] },
  { id: 'customer', type: 'record', entity: 'Customer', hidden: true },
  { id: 'sales', type: 'report', entity: 'Order' },
  { id: 'new-order', type: 'wizard', entity: 'Order', steps: [{ fields: ['status', 'total'] }, { fields: ['placedOn'] }, { fields: ['customer'] }] },
]

const patchOf = (placed: PlacedPart) => {
  if ('reason' in placed) throw new Error(placed.reason)
  return placed
}
const reasonOf = (placed: PlacedPart) => ('reason' in placed ? placed.reason : undefined)

describe('pageParts', () => {
  it('offers a tabs page every page it can embed, saying which are tabs already', () => {
    const [group] = pageParts(pages, 3, entities)
    expect(group.slot).toBe('tab')
    expect(group.cards.map(c => [c.key, c.reason])).toEqual([
      ['tab:orders', 'Already a tab here'],
      ['tab:tickets', 'Already a tab here'],
      ['tab:desk', undefined],
      ['tab:sales', undefined],
      ['tab:new-order', undefined],
    ])
  })

  it('offers a record page its related lists and their counts', () => {
    const [tabs, stats] = pageParts(pages, 4, entities)
    // Every related list is a tab, and counted, by default.
    expect(tabs.cards.map(c => c.reason)).toEqual(['Already a tab here', 'Already a tab here'])
    expect(stats.cards.map(c => c.reason)).toEqual(['Already counted', 'Already counted'])
    const named = pageParts([...pages.slice(0, 4), { ...pages[4], childTabs: ['Order'], headerStats: [] }], 4, entities)
    expect(named[0].cards.map(c => [c.label, c.reason])).toEqual([['Order', 'Already a tab here'], ['Ticket', undefined]])
    expect(named[1].cards.map(c => c.reason)).toEqual([undefined, undefined])
  })

  it('offers a report what it can chart, and a wizard its fields with their step', () => {
    expect(pageParts(pages, 5, entities)[0].cards.map(c => [c.key, c.icon])).toEqual([
      ['chart:status', 'bar_chart'], ['chart:placedOn', 'show_chart'], ['chart:customer', 'account_tree'],
    ])
    expect(pageParts(pages, 6, entities)[0].cards.map(c => c.blurb)).toEqual(['Step 1', 'Step 1', 'Step 2', 'Step 3 · picker'])
  })

  it('offers nothing on a page that takes no parts', () => {
    expect(pageParts(pages, 0, entities)).toEqual([])
    expect(pageParts(pages, 2, entities)).toEqual([])
  })
})

describe('placePart', () => {
  it('embeds a page as a tab where it was dropped, once', () => {
    const placed = patchOf(placePart(pages, 3, entities, { kind: 'tab', page: 'desk' }, 1))
    expect(placed.patch.tabs).toEqual([{ page: 'orders' }, { page: 'desk' }, { page: 'tickets' }])
    expect(placed.label).toBe('Added “Dashboard” as a tab of “Queue”')
    expect(reasonOf(placePart(pages, 3, entities, { kind: 'tab', page: 'orders' }))).toContain('already a tab')
    expect(reasonOf(placePart(pages, 3, entities, { kind: 'tab', page: 'customer' }))).toContain('not a tabs or record page')
    expect(reasonOf(placePart(pages, 3, entities, { kind: 'tab', page: 'queue' }))).toContain('its own tabs')
    expect(reasonOf(placePart(pages, 0, entities, { kind: 'tab', page: 'desk' }))).toBe('That does not go on “Order”')
  })

  it('adds a report chart, turning one chart into several', () => {
    const placed = patchOf(placePart(pages, 5, entities, { kind: 'chart', groupBy: 'placedOn' }))
    expect(placed.patch).toEqual({ charts: [{}, { groupBy: 'placedOn' }], chart: undefined })
    const full: FullstackPageDef = { ...pages[5], charts: [{}, {}, {}, {}] }
    expect(reasonOf(placePart([...pages.slice(0, 5), full], 5, entities, { kind: 'chart', groupBy: 'status' }))).toContain('at most 4 charts')
    expect(reasonOf(placePart(pages, 5, entities, { kind: 'chart', groupBy: 'total' }))).toContain('no total to chart')
  })

  it('adds a related tab or a count to a record page, spelling out the defaults it replaces', () => {
    const record: FullstackPageDef = { ...pages[4], childTabs: ['Ticket'] }
    const layout = [...pages.slice(0, 4), record]
    expect(patchOf(placePart(layout, 4, entities, { kind: 'child-tab', entity: 'Order' }, 0)).patch.childTabs).toEqual(['Order', 'Ticket'])
    // The default tiles (a count per tab) are written out, then the new one goes in.
    expect(patchOf(placePart(layout, 4, entities, { kind: 'header-stat', entity: 'Order' })).patch.headerStats)
      .toEqual([{ child: 'Ticket' }, { child: 'Order' }])
    expect(reasonOf(placePart(pages, 4, entities, { kind: 'child-tab', entity: 'Order' }))).toContain('already a tab')
    expect(reasonOf(placePart(pages, 4, entities, { kind: 'child-tab', entity: 'Customer' }))).toContain('no link')
  })

  it('moves a wizard field into another step, dropping a step it leaves empty', () => {
    const into = patchOf(placePart(pages, 6, entities, { kind: 'step-field', field: 'placedOn' }, 0))
    expect(into.patch.steps).toEqual([{ fields: ['status', 'total', 'placedOn'] }, { fields: ['customer'] }])
    expect(into.label).toBe('Moved Placed on to step 1 of “Order”')
    const fresh = patchOf(placePart(pages, 6, entities, { kind: 'step-field', field: 'total' }, 3))
    expect(fresh.patch.steps).toEqual([{ fields: ['status'] }, { fields: ['placedOn'] }, { fields: ['customer'] }, { fields: ['total'] }])
    expect(fresh.label).toContain('into a new step')
    expect(reasonOf(placePart(pages, 6, entities, { kind: 'step-field', field: 'status' }, 0))).toContain('already asked for in step 1')
  })

  it('leaves a layout the validator accepts', () => {
    let next = pages
    const steps: [number, Parameters<typeof placePart>[3], number?][] = [
      [3, { kind: 'tab', page: 'sales' }],
      [4, { kind: 'header-stat', entity: 'Order' }, 0],
      [5, { kind: 'chart', groupBy: 'customer' }],
      [6, { kind: 'step-field', field: 'customer' }, 0],
    ]
    for (const [index, part, at] of steps) {
      const placed = patchOf(placePart(next, index, entities, part, at))
      next = next.map((p, i) => (i === index ? { ...p, ...placed.patch } : p))
    }
    expect(validatePages(next, entities).issues).toEqual([])
  })
})
