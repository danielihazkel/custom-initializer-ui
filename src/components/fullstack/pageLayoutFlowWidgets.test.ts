import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef, FullstackWidgetDef } from '../../types'
import { defaultSpan, funnelStageFields, newWidget, retargetWidget, validatePages, widgetKindDisabledReason } from './pageLayout'

const claim = (trackMoves?: boolean, workflow = true): FullstackEntityDef => ({
  name: 'Claim',
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true },
    { name: 'title', type: 'STRING' },
    { name: 'amount', type: 'BIG_DECIMAL' },
    { name: 'category', type: 'ENUM', enumValues: ['TRAVEL', 'MEALS'] },
    { name: 'status', type: 'ENUM', enumValues: ['DRAFT', 'SENT', 'PAID'] },
  ],
  ...(workflow ? {
    workflow: {
      statusField: 'status',
      ...(trackMoves ? { trackMoves: true } : {}),
      transitions: [{ name: 'send', from: ['DRAFT'], to: 'SENT' }, { name: 'pay', from: ['SENT'], to: 'PAID' }],
    },
  } : {}),
})
const note: FullstackEntityDef = { name: 'Note', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'text', type: 'STRING' }] }

const dashboard = (...widgets: FullstackWidgetDef[]): FullstackPageDef[] => [{ id: 'home', type: 'dashboard', widgets }]
const problems = (entities: FullstackEntityDef[], ...widgets: FullstackWidgetDef[]) => validatePages(dashboard(...widgets), entities).problems

describe('funnel, gauge and time-in-state widgets', () => {
  it('reads a funnel’s stages from an enum, the workflow’s status first', () => {
    expect(funnelStageFields(claim()).map(f => f.name)).toEqual(['status', 'category'])
    expect(problems([claim()], { kind: 'funnel', entity: 'Claim' })).toEqual([])
    expect(problems([claim()], { kind: 'funnel', entity: 'Claim', groupBy: 'category', agg: 'sum', field: 'amount' })).toEqual([])
    expect(problems([claim()], { kind: 'funnel', entity: 'Claim', groupBy: 'title' }))
      .toEqual(['Page “home” draws a funnel over “title”, which is not an enum field of Claim'])
    expect(problems([claim()], { kind: 'funnel', entity: 'Claim', agg: 'avg', field: 'amount' })[0]).toMatch(/only a count or a sum adds up/)
    expect(widgetKindDisabledReason('funnel', note)).toMatch(/no enum field/)
    expect(widgetKindDisabledReason('funnel', claim())).toBeUndefined()
  })

  it('asks a gauge for its full-scale value, like a progress tile', () => {
    expect(newWidget('gauge', 'Claim')).toEqual({ kind: 'gauge', entity: 'Claim', target: '100' })
    expect(defaultSpan('gauge')).toBe(1)
    expect(problems([claim()], { kind: 'gauge', entity: 'Claim', target: '50' })).toEqual([])
    expect(problems([claim()], { kind: 'gauge', entity: 'Claim' })).toEqual(['Page “home” has a gauge without a target'])
  })

  it('offers time in state only where the workflow keeps a log of its moves', () => {
    expect(widgetKindDisabledReason('timeInState', claim(true))).toBeUndefined()
    expect(widgetKindDisabledReason('timeInState', claim(false))).toMatch(/Keep a log of moves/)
    expect(widgetKindDisabledReason('timeInState', note)).toMatch(/has no workflow/)
    expect(problems([claim(true)], { kind: 'timeInState', entity: 'Claim' })).toEqual([])
    expect(problems([claim(false)], { kind: 'timeInState', entity: 'Claim' }))
      .toEqual(['Page “home” shows time in state for Claim, whose workflow keeps no log of its moves'])
    // It reads the log, so nothing that measures or filters applies; the fix drops it.
    const issue = validatePages(dashboard({ kind: 'timeInState', entity: 'Claim', agg: 'sum', field: 'amount', title: 'Stays' }), [claim(true)]).issues[0]
    expect(issue.summary).toMatch(/settings it does not take/)
    expect(issue.fix?.apply(dashboard({ kind: 'timeInState', entity: 'Claim', agg: 'sum', field: 'amount', title: 'Stays' }))[0].widgets)
      .toEqual([{ kind: 'timeInState', entity: 'Claim', title: 'Stays' }])
  })

  it('keeps what the new kind takes when a widget changes kind', () => {
    const progress: FullstackWidgetDef = { kind: 'progress', entity: 'Claim', agg: 'sum', field: 'amount', target: '500' }
    expect(retargetWidget(progress, { kind: 'gauge' }, claim(true)).widget).toEqual({ ...progress, kind: 'gauge' })
    const bar: FullstackWidgetDef = { kind: 'bar', entity: 'Claim', groupBy: 'status', agg: 'avg', field: 'amount' }
    const funnel = retargetWidget(bar, { kind: 'funnel' }, claim(true))
    expect(funnel.widget).toEqual({ kind: 'funnel', entity: 'Claim', groupBy: 'status' })
    expect(funnel.dropped).toEqual(['aggregate'])
    const time = retargetWidget({ ...bar, presetFilter: { category: 'TRAVEL' } }, { kind: 'timeInState' }, claim(true))
    expect(time.widget).toEqual({ kind: 'timeInState', entity: 'Claim' })
  })
})
