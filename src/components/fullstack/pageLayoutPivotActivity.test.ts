import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef, FullstackWidgetDef } from '../../types'
import { activityEntities, newWidget, renameEntityInPages, retargetWidget, validatePages, widgetKindDisabledReason } from './pageLayout'
import { buildLayoutPreview } from './layoutPreviewModel'

const entities: FullstackEntityDef[] = [
  { name: 'Team', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Ticket',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'CLOSED'] },
      { name: 'urgent', type: 'BOOLEAN' },
    ],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'team', targetEntity: 'Team' }],
  },
  { name: 'Note', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'body', type: 'STRING' }], opts: { audit: false } },
]
const [team, ticket] = entities

const dashboard = (...widgets: FullstackWidgetDef[]): FullstackPageDef[] => [{ id: 'home', type: 'dashboard', widgets }]
const problems = (pages: FullstackPageDef[], scaffoldOpts: string[] = []) => validatePages(pages, entities, { scaffoldOpts }).problems

describe('pivot widgets', () => {
  it('crosses two enum, boolean or relation fields, and says when there is no second one', () => {
    expect(problems(dashboard({ kind: 'pivot', entity: 'Ticket', groupBy: 'team', series: 'status' }))).toEqual([])
    expect(problems(dashboard({ kind: 'pivot', entity: 'Ticket' }))).toEqual([])
    expect(problems(dashboard({ kind: 'pivot', entity: 'Ticket', groupBy: 'status', series: 'status' }))).toEqual([
      'Page “home” has a pivot of Ticket, which has no second enum, boolean or relation for its columns',
    ])
    expect(widgetKindDisabledReason('pivot', team)).toBe('Team needs two enum, boolean or relation fields to cross')
    expect(widgetKindDisabledReason('pivot', ticket)).toBeUndefined()
  })

  it('keeps its axes across a kind switch while they fit', () => {
    const pivot: FullstackWidgetDef = { kind: 'pivot', entity: 'Ticket', groupBy: 'team', series: 'status' }
    // A relation cannot be stacked, so the rows go; the columns still split the bars.
    expect(retargetWidget(pivot, { kind: 'stacked' }, ticket).widget).toEqual({ kind: 'stacked', entity: 'Ticket', series: 'status' })
    expect(retargetWidget({ kind: 'stacked', entity: 'Ticket', groupBy: 'status', series: 'urgent' }, { kind: 'pivot' }, ticket).widget)
      .toEqual({ kind: 'pivot', entity: 'Ticket', groupBy: 'status', series: 'urgent' })
  })

  it('previews a table of made-up numbers', () => {
    const screen = buildLayoutPreview(dashboard({ kind: 'pivot', entity: 'Ticket', groupBy: 'team', series: 'status' }), entities,
      { locale: 'en', projectOpts: [] }).screens[0]
    const widget = screen.type === 'dashboard' ? screen.widgets[0] : undefined
    expect(widget?.kind).toBe('pivot')
    if (widget?.kind === 'pivot') {
      expect([...widget.columns].sort()).toEqual(['Closed', 'Open'])
      expect(widget.rows).toHaveLength(3)
      expect(widget.title).toBe('Tickets by Team and Status')
    }
  })
})

describe('activity widgets', () => {
  it('follows the audited entities, and needs the audit option', () => {
    const feed: FullstackWidgetDef = newWidget('activity', 'Ticket')
    expect(feed).toEqual({ kind: 'activity', entity: '' })
    expect(activityEntities(feed, entities, ['audit'])).toEqual(['Team', 'Ticket'])
    expect(problems(dashboard(feed), ['audit'])).toEqual([])
    expect(problems(dashboard(feed))).toEqual(['Page “home” has an activity feed, but the audit option is off for every entity'])
    expect(problems(dashboard({ kind: 'activity', entity: '', entities: ['Note'] }), ['audit'])).toEqual([
      'Page “home” has an activity feed over Note, which does not record when it changed',
    ])
    expect(problems(dashboard({ kind: 'activity', entity: '', limit: 2 }), ['audit'])).toEqual([
      'Page “home” shows an activity feed of 2 changes (5–20)',
    ])
    expect(widgetKindDisabledReason('activity', undefined, { entities, scaffoldOpts: [] }))
      .toBe('Turn the audit option on first — the feed reads when rows changed')
    expect(widgetKindDisabledReason('activity', undefined, { entities, scaffoldOpts: ['audit'] })).toBeUndefined()
  })

  it('drops entity settings when a widget becomes a feed, and follows entity renames', () => {
    const { widget, dropped } = retargetWidget({ kind: 'bar', entity: 'Ticket', groupBy: 'status', title: 'Load' }, { kind: 'activity' }, ticket)
    expect(widget).toEqual({ kind: 'activity', entity: '', title: 'Load' })
    expect(dropped).toEqual(['data settings'])
    const renamed = renameEntityInPages(dashboard({ kind: 'activity', entity: '', entities: ['Ticket'] }), 'Ticket', 'Case')
    expect(renamed[0].widgets?.[0].entities).toEqual(['Case'])
  })

  it('lets a recent list sort by when rows changed, with audit on', () => {
    const recent: FullstackWidgetDef = { kind: 'recent', entity: 'Ticket', sortBy: 'updatedAt' }
    expect(problems(dashboard(recent), ['audit'])).toEqual([])
    expect(problems(dashboard(recent))).toEqual(['Page “home” sorts Ticket by “updatedAt”, which it no longer has'])
  })
})
