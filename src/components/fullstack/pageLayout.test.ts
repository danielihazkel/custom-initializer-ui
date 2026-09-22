import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { describePage, pageLabel, pageLayoutProblems } from './pageLayout'

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
})
