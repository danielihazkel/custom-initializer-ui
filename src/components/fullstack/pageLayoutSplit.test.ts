import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackFieldDef, FullstackPageDef } from '../../types'
import { describePagesChange, newWidget, splitDisabledReason, splitListByField, validatePages, valuesOf, widgetKindDisabledReason } from './pageLayout'

const status: FullstackFieldDef = { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'IN_PROGRESS', 'DONE'], enumLabels: { DONE: 'Closed' } }
const urgent: FullstackFieldDef = { name: 'urgent', type: 'BOOLEAN', label: 'Is urgent' }
const ticket: FullstackEntityDef = {
  name: 'Ticket',
  fields: [{ name: 'id', type: 'LONG', primaryKey: true }, status, urgent, { name: 'dueAt', type: 'LOCAL_DATE' }],
}
const team: FullstackEntityDef = { name: 'Team', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] }
const list: FullstackPageDef = { id: 'tickets', type: 'entity-list', entity: 'Ticket', group: 'Work', icon: 'Inbox', sort: { field: 'dueAt' }, pageSize: 50 }

describe('splitListByField', () => {
  it('adds a tabs page over one hidden preset list per value, right after the source page', () => {
    const next = splitListByField(list, status, [{ id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Ticket' }] }, list])
    expect(next.map(p => p.id)).toEqual(['home', 'tickets', 'tickets-by-status', 'ticket-open', 'ticket-in-progress', 'ticket-done'])
    expect(next[2]).toEqual({
      id: 'tickets-by-status', type: 'tabs', title: 'Tickets by status', group: 'Work', icon: 'Inbox',
      // Labels: the explicit one where set, else the humanized constant.
      tabs: [{ page: 'ticket-open', title: 'Open' }, { page: 'ticket-in-progress', title: 'In progress' }, { page: 'ticket-done', title: 'Closed' }],
    })
    // The lists keep how the source opens (sort, page size), and stay out of the nav.
    expect(next[3]).toEqual({ id: 'ticket-open', type: 'entity-list', entity: 'Ticket', hidden: true, presetFilter: { status: 'OPEN' }, sort: { field: 'dueAt' }, pageSize: 50 })
    // The source page is untouched, and the result is valid as it stands.
    expect(next[1]).toBe(list)
    expect(validatePages(next, [ticket]).count).toBe(0)
  })

  it('splits by a boolean with Yes/No tabs, on top of an existing preset, minting unique ids', () => {
    const preset: FullstackPageDef = { id: 'open', type: 'entity-list', entity: 'Ticket', presetFilter: { status: 'OPEN' } }
    const taken: FullstackPageDef = { id: 'ticket-urgent-true', type: 'entity-list', entity: 'Ticket' }
    const next = splitListByField(preset, urgent, [preset, taken])
    expect(next.map(p => p.id)).toEqual(['open', 'open-by-urgent', 'ticket-urgent-true-2', 'ticket-urgent-false', 'ticket-urgent-true'])
    expect(next[1].title).toBe('Tickets by is urgent')
    expect(next[1].tabs).toEqual([{ page: 'ticket-urgent-true-2', title: 'Yes' }, { page: 'ticket-urgent-false', title: 'No' }])
    expect(next[2].presetFilter).toEqual({ status: 'OPEN', urgent: 'true' })
  })

  it('says why a split is not possible', () => {
    expect(splitDisabledReason(list, undefined, [list])).toBe('Pick a field to split by')
    expect(splitDisabledReason({ ...list, presetFilter: { status: 'OPEN' } }, status, [list])).toBe('This list is already filtered on status')
    expect(splitDisabledReason(list, { name: 'kind', type: 'ENUM', enumValues: ['ONE'] }, [list])).toBe('kind needs at least 2 values to split by')
    expect(splitDisabledReason(list, { name: 'kind', type: 'ENUM', enumValues: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }, [list]))
      .toBe('kind has 7 values; a tabs page takes at most 6')
    const crowded = Array.from({ length: 27 }, (_, i) => ({ id: `p${i}`, type: 'entity-list' as const, entity: 'Ticket' }))
    expect(splitDisabledReason(list, status, crowded)).toBe('Splitting would take the layout past 30 pages')
    expect(splitDisabledReason(list, status, [list])).toBeUndefined()
    expect(valuesOf(urgent)).toEqual(['true', 'false'])
  })

  it('is one labelled undo entry: the automatic label counts the pages', () => {
    const next = splitListByField(list, status, [list])
    expect(describePagesChange([list], next)).toBe('Added 4 pages (“Tickets by status”…)')
  })
})

describe('the Add-widget gallery helpers', () => {
  it('says which kinds an entity cannot feed, in the validator\'s terms', () => {
    expect(widgetKindDisabledReason('bar', ticket)).toBeUndefined()
    expect(widgetKindDisabledReason('stacked', ticket)).toBeUndefined()
    expect(widgetKindDisabledReason('line', ticket)).toBeUndefined()
    expect(widgetKindDisabledReason('top', ticket)).toBeUndefined()
    expect(widgetKindDisabledReason('bar', team)).toBe('Team has no enum, boolean or relation to break down by')
    expect(widgetKindDisabledReason('donut', team)).toBe('Team has no enum, boolean or relation to break down by')
    expect(widgetKindDisabledReason('stacked', { ...ticket, fields: ticket.fields.filter(f => f.name !== 'urgent') })).toBe('Ticket needs two enum or boolean fields to stack')
    expect(widgetKindDisabledReason('line', team)).toBe('Team has no date field to plot over')
    expect(widgetKindDisabledReason('top', team)).toBe('Team has no enum, boolean or relation to rank by')
    expect(widgetKindDisabledReason('kpi', team)).toBeUndefined()
    expect(widgetKindDisabledReason('recent', undefined)).toBe('Pick an entity first')
    expect(widgetKindDisabledReason('text', undefined)).toBeUndefined()
  })

  it('pre-fills what the validator insists on, so a new widget is valid on sight', () => {
    expect(newWidget('kpi', 'Ticket')).toEqual({ kind: 'kpi', entity: 'Ticket' })
    expect(newWidget('progress', 'Ticket')).toEqual({ kind: 'progress', entity: 'Ticket', target: '100' })
    expect(newWidget('text', 'Ticket')).toEqual({ kind: 'text', entity: '', text: 'Note' })
    const widgets = (['kpi', 'bar', 'donut', 'stacked', 'line', 'recent', 'top', 'progress', 'text'] as const).map(k => newWidget(k, 'Ticket'))
    expect(validatePages([{ id: 'home', type: 'dashboard', widgets }], [ticket]).count).toBe(0)
  })
})
