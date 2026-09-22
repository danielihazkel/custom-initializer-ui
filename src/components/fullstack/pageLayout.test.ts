import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import {
  describePage, pageLabel, pageLayoutProblems, renameEntityInPages, renameFieldInPages,
  seedLayout, slugify, uniquePageId, validatePages,
} from './pageLayout'

const entities: FullstackEntityDef[] = [
  { name: 'Ticket', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'status', type: 'ENUM', enumValues: ['OPEN'] }] },
]

describe('pageLayoutProblems', () => {
  it('has nothing to say about a consistent layout, or about none', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'bar', entity: 'ticket', groupBy: 'status' }] },
      { id: 'tickets', type: 'entity-list', entity: 'Ticket', presetFilter: { status: 'OPEN' } },
    ]
    expect(pageLayoutProblems(pages, entities)).toEqual([])
    expect(pageLayoutProblems([], [])).toEqual([])
  })

  it('names stale entity, field and tab references', () => {
    const problems = pageLayoutProblems([
      { id: 'home', type: 'dashboard', title: 'Home', widgets: [{ kind: 'kpi', entity: 'Order' }, { kind: 'bar', entity: 'Ticket', groupBy: 'priority' }] },
      { id: 'list', type: 'entity-list', entity: 'Ticket', presetFilter: { state: 'OPEN' } },
      { id: 'tabs', type: 'tabs', title: 'Tabs', tabs: [{ page: 'list' }, { page: 'gone' }] },
    ], entities)
    expect(problems).toEqual([
      'Page “Home” has a widget for “Order”, which is no longer an entity',
      'Page “Home” groups Ticket by “priority”, which it no longer has',
      'Page “list” filters on “state”, which Ticket no longer has',
      'Page “Tabs” has a tab for the missing page “gone”',
    ])
  })

  it('needs one page in the navigation', () => {
    expect(pageLayoutProblems([{ id: 'a', type: 'entity-list', entity: 'Ticket', hidden: true }], entities))
      .toContain('Every page is hidden — at least one must be in the navigation')
  })
})

describe('describePage / pageLabel', () => {
  it('summarizes each page type and falls back like the generator does', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Ticket' }, { kind: 'kpi', entity: 'Ticket' }, { kind: 'recent', entity: 'Ticket' }] },
      { id: 'open', type: 'entity-list', entity: 'Ticket', title: 'Open tickets' },
      { id: 'q', type: 'tabs', title: 'Queue', tabs: [{ page: 'open' }, { title: 'Overview', page: 'home' }] },
    ]
    expect(describePage(pages[0], pages)).toBe('2 count tiles · 1 recent list')
    expect(describePage(pages[1], pages)).toBe('Ticket list')
    expect(describePage(pages[2], pages)).toBe('Open tickets | Overview')
    expect(pages.map(pageLabel)).toEqual(['Dashboard', 'Open tickets', 'Queue'])
  })

  it('summarizes the two id-driven page types', () => {
    const md: FullstackPageDef = { id: 'c', type: 'master-detail', parent: 'Customer', child: 'Order', via: 'billTo' }
    expect(describePage(md, [md])).toBe('Customer → Order via billTo')
    expect(pageLabel(md)).toBe('Customer')
    expect(describePage({ id: 'o', type: 'record', entity: 'Order' }, [])).toBe('One Order · its related lists')
    expect(describePage({ id: 'o', type: 'record', entity: 'Order', childTabs: [] }, [])).toBe('One Order · no related lists')
    expect(describePage({ id: 'o', type: 'record', entity: 'Order', childTabs: ['OrderLine'] }, [])).toBe('One Order · OrderLine')
  })
})

describe('validatePages — master-detail and record pages', () => {
  const shop: FullstackEntityDef[] = [
    { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
    { name: 'Order', fields: [{ name: 'id', type: 'LONG', primaryKey: true }], relations: [
      { type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' },
      { type: 'MANY_TO_ONE', fieldName: 'billTo', targetEntity: 'Customer' },
    ] },
    { name: 'Ledger', fields: [{ name: 'day', type: 'LOCAL_DATE', primaryKey: true }, { name: 'book', type: 'STRING', primaryKey: true }] },
  ]

  it('accepts a layout whose references all hold', () => {
    const pages: FullstackPageDef[] = [
      { id: 'customers', type: 'master-detail', parent: 'Customer', child: 'Order', via: 'customer' },
      { id: 'order', type: 'record', entity: 'Order', hidden: true, childTabs: [] },
    ]
    expect(validatePages(pages, shop).problems).toEqual([])
  })

  it('asks which relation a master-detail page links through, and flags an unknown one', () => {
    const ambiguous = validatePages([{ id: 'c', type: 'master-detail', parent: 'Customer', child: 'Order' }], shop)
    expect(ambiguous.byPage[0].via).toBe('pick the relation to link through')
    const wrong = validatePages([{ id: 'c', type: 'master-detail', parent: 'Customer', child: 'Order', via: 'buyer' }], shop)
    expect(wrong.byPage[0].via).toBe('“buyer” is not a relation to Customer')
    const unrelated = validatePages([{ id: 'c', type: 'master-detail', parent: 'Order', child: 'Customer' }], shop)
    expect(unrelated.byPage[0].child).toBe('Customer has no relation to Order')
  })

  it('keeps record pages to one per entity, single-key, with related children only', () => {
    const twice = validatePages([
      { id: 'order', type: 'record', entity: 'Order', hidden: true },
      { id: 'order-2', type: 'record', entity: 'Order', hidden: true },
      { id: 'orders', type: 'entity-list', entity: 'Order' },
    ], shop)
    expect(twice.byPage[1].entity).toBe('Order already has the record page “order”')
    const composite = validatePages([{ id: 'ledger', type: 'record', entity: 'Ledger', hidden: true }], shop)
    expect(composite.byPage[0].entity).toBe('Ledger has a composite key')
    const stranger = validatePages([
      { id: 'customer', type: 'record', entity: 'Customer', hidden: true, childTabs: ['Ledger'] },
      { id: 'customers', type: 'entity-list', entity: 'Customer' },
    ], shop)
    expect(stranger.byPage[0]['childTab.0']).toBe('Ledger has no relation to Customer')
  })

  it('will not embed a record page in a tab, and needs one page in the navigation', () => {
    const result = validatePages([
      { id: 'order', type: 'record', entity: 'Order', hidden: true },
      { id: 'orders', type: 'entity-list', entity: 'Order' },
      { id: 'q', type: 'tabs', title: 'Q', tabs: [{ page: 'orders' }, { page: 'order' }] },
    ], shop)
    expect(result.byPage[2]['tab.1']).toBe('a tab cannot embed a record page')
    // A record page is never in the navigation, so it does not count as the visible one.
    expect(validatePages([{ id: 'order', type: 'record', entity: 'Order', hidden: true }], shop).general)
      .toEqual(['Every page is hidden — at least one must be in the navigation'])
  })
})

describe('seedLayout / renames / slugs', () => {
  const entities: FullstackEntityDef[] = [
    { name: 'Ticket', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'status', type: 'ENUM', enumValues: ['OPEN'] }] },
    { name: 'Team', fields: [{ name: 'id', type: 'LONG', primaryKey: true }] },
    { name: '', fields: [] },
  ]

  it('seeds the classic layout: a dashboard of every entity plus one list page each', () => {
    const pages = seedLayout(entities)
    expect(pages.map(p => `${p.id}:${p.type}`)).toEqual(['dashboard:dashboard', 'ticket:entity-list', 'team:entity-list'])
    expect(pages[0].widgets).toEqual([
      { kind: 'kpi', entity: 'Ticket' },
      { kind: 'kpi', entity: 'Team' },
      { kind: 'bar', entity: 'Ticket' },
      { kind: 'recent', entity: 'Ticket' },
    ])
    expect(validatePages(pages, entities).problems).toEqual([])
    expect(seedLayout([])).toEqual([])
  })

  it('follows an entity rename through every reference', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Ticket' }, { kind: 'kpi', entity: 'Team' }] },
      { id: 'list', type: 'entity-list', entity: 'ticket' },
      { id: 'md', type: 'master-detail', parent: 'Team', child: 'Ticket' },
      { id: 'rec', type: 'record', entity: 'Team', childTabs: ['Ticket'] },
    ]
    const renamed = renameEntityInPages(pages, 'Ticket', 'Issue')
    expect(renamed[0].widgets?.map(w => w.entity)).toEqual(['Issue', 'Team'])
    expect(renamed[1].entity).toBe('Issue')
    expect(renamed[2].child).toBe('Issue')
    expect(renamed[3].childTabs).toEqual(['Issue'])
    expect(renameEntityInPages(pages, 'Ticket', 'Ticket')).toBe(pages)
  })

  it('follows a field rename into preset filters and chart groupings of that entity only', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'bar', entity: 'Ticket', groupBy: 'status' }, { kind: 'bar', entity: 'Team', groupBy: 'status' }] },
      { id: 'open', type: 'entity-list', entity: 'Ticket', presetFilter: { status: 'OPEN' } },
    ]
    const renamed = renameFieldInPages(pages, 'Ticket', 'status', 'state')
    expect(renamed[0].widgets?.map(w => w.groupBy)).toEqual(['state', 'status'])
    expect(renamed[1].presetFilter).toEqual({ state: 'OPEN' })
  })

  it('slugifies titles and keeps page ids unique', () => {
    expect(slugify('Order lines!')).toBe('order-lines')
    expect(slugify('  42 ')).toBe('')
    expect(uniquePageId('orders', ['orders', 'orders-2'])).toBe('orders-3')
    expect(uniquePageId('', [])).toBe('page')
  })
})
