import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { chartKindsFor, defaultChartSeries, retargetReport, validatePages } from './pageLayout'

const ticket: FullstackEntityDef = {
  name: 'Ticket',
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true },
    { name: 'priority', type: 'ENUM', enumValues: ['LOW', 'HIGH'] },
    { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'CLOSED'] },
    { name: 'dueAt', type: 'LOCAL_DATE' },
  ],
  relations: [{ type: 'MANY_TO_ONE', fieldName: 'team', targetEntity: 'Team' }],
}
const team: FullstackEntityDef = { name: 'Team', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] }
const entities = [ticket, team]

const report = (charts: FullstackPageDef['charts']): FullstackPageDef[] => [{ id: 'r', type: 'report', entity: 'Ticket', charts }]

describe('report chart kinds', () => {
  it('offers the kinds that fit the grouping', () => {
    expect(chartKindsFor(false, false).map(k => k.value)).toEqual(['bar', 'donut', 'stacked', 'table'])
    expect(chartKindsFor(false, true).map(k => k.value)).toEqual(['bar', 'donut', 'table'])
    expect(chartKindsFor(true, false).map(k => k.value)).toEqual(['line', 'area', 'table'])
    expect(defaultChartSeries(ticket, 'priority')).toBe('status')
  })

  it('accepts what the backend draws and names what it would not', () => {
    expect(validatePages(report([
      { groupBy: 'status', kind: 'donut' },
      { groupBy: 'priority', kind: 'stacked' },
      { groupBy: 'dueAt', kind: 'area' },
      { groupBy: 'team', kind: 'table' },
    ]), entities).problems).toEqual([])
    expect(validatePages(report([
      { groupBy: 'dueAt', kind: 'donut' },
      { groupBy: 'team', kind: 'stacked' },
      { groupBy: 'status', series: 'priority' },
      { groupBy: 'status', kind: 'stacked', series: 'status' },
    ]), entities).problems).toEqual([
      'Page “r” (chart 1) is drawn as donut, which does not fit its grouping',
      'Page “r” (chart 2) is drawn as stacked, which does not fit its grouping',
      'Page “r” (chart 3) splits by “priority” but is not stacked',
      'Page “r” (chart 4) splits by “status”, which is not another enum or boolean field',
    ])
  })

  it('keeps a kind across a retarget only while it fits', () => {
    const page: FullstackPageDef = { id: 'r', type: 'report', entity: 'Ticket', chart: { groupBy: 'priority', kind: 'stacked', series: 'status' } }
    expect(retargetReport(page, ticket).patch.chart).toEqual({ groupBy: 'priority', kind: 'stacked', series: 'status' })
    // Team has no priority: the grouping goes, its default (none here) cannot stack.
    const { patch, dropped } = retargetReport(page, team)
    expect(patch.chart).toEqual({})
    expect(dropped).toEqual(['group by', 'chart kind'])
  })
})
