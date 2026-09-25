import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef, FullstackWidgetDef } from '../../types'
import { describePage, validatePages } from './pageLayout'

const entities: FullstackEntityDef[] = [{
  name: 'Ticket',
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true },
    { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'DONE'] },
    { name: 'urgent', type: 'BOOLEAN' },
  ],
}]
const dash = (widgets: FullstackWidgetDef[]): FullstackPageDef[] => [{ id: 'desk', type: 'dashboard', widgets }]

describe('validating the donut, stacked and text widgets', () => {
  it('accepts well-formed ones', () => {
    const v = validatePages(dash([
      { kind: 'donut', entity: 'Ticket' },
      { kind: 'stacked', entity: 'Ticket', groupBy: 'status', series: 'urgent' },
      { kind: 'stacked', entity: 'Ticket' },
      { kind: 'text', entity: '', text: 'Hello' },
    ]), entities)
    expect(v.count).toBe(0)
  })

  it('flags what the generator would reject', () => {
    const v = validatePages(dash([
      { kind: 'stacked', entity: 'Ticket', groupBy: 'status', series: 'status' },
      { kind: 'bar', entity: 'Ticket', series: 'urgent' },
      { kind: 'text', entity: '', text: '  ' },
    ]), entities)
    expect(v.byPage[0]).toMatchObject({
      'widget.0': 'needs a second enum or boolean field to split by',
      'widget.1': 'only a stacked chart takes a series',
      'widget.2': 'needs some text',
    })
  })

  it('counts them in the page summary', () => {
    expect(describePage(dash([{ kind: 'donut', entity: 'Ticket' }, { kind: 'text', entity: '', text: 'x' }])[0], []))
      .toBe('1 donut chart · 1 text note')
  })
})

describe('page roles', () => {
  const pages: FullstackPageDef[] = [
    { id: 'desk', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Ticket' }] },
    { id: 'open', type: 'entity-list', entity: 'Ticket', hidden: true },
    { id: 'all', type: 'entity-list', entity: 'Ticket', hidden: true },
    { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'open' }, { page: 'all' }] },
    { id: 'tickets', type: 'entity-list', entity: 'Ticket', roles: ['ADMIN'] },
  ]

  it('accepts roles on a nav page when ldap-auth is on', () => {
    expect(validatePages(pages, entities, { ldapAuth: true }).count).toBe(0)
  })

  it('flags roles the generator would reject', () => {
    expect(validatePages(pages, entities, { ldapAuth: false }).byPage[4]).toEqual({ roles: 'needs ldap-auth-rest or ldap-auth' })
    const start = pages.map((p, i) => (i === 0 ? { ...p, roles: ['USER' as const] } : p))
    expect(validatePages(start, entities, { ldapAuth: true }).byPage[0]).toEqual({ roles: 'the start page is open to everyone' })
    const tab = pages.map((p, i) => (i === 1 ? { ...p, roles: ['USER' as const] } : p))
    expect(validatePages(tab, entities, { ldapAuth: true }).byPage[1]).toEqual({ roles: 'restrict the tabs page instead' })
  })
})

describe('dashboard auto-refresh', () => {
  it('takes one of the refresh choices, on a dashboard with data to reload, and says so', () => {
    const ok: FullstackPageDef[] = [{ id: 'desk', type: 'dashboard', refreshSeconds: 60, widgets: [{ kind: 'kpi', entity: 'Ticket' }] }]
    expect(validatePages(ok, entities).problems).toEqual([])
    expect(describePage(ok[0], ok)).toBe('1 number tile · refreshes every minute')
    const odd: FullstackPageDef[] = [{ ...ok[0], refreshSeconds: 45 }]
    expect(validatePages(odd, entities).byPage[0]).toEqual({ refreshSeconds: '45 seconds is not one of the refresh choices' })
    const noData: FullstackPageDef[] = [{ id: 'desk', type: 'dashboard', refreshSeconds: 60, widgets: [{ kind: 'text', entity: '', text: 'Hi' }] }]
    expect(validatePages(noData, entities).problems).toEqual(['Page “desk” refreshes on a timer, but none of its widgets shows data to reload'])
  })
})
