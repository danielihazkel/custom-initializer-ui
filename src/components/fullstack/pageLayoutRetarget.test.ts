import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { pageOfServerError, retargetReport, retargetWidget, retargetWizardSteps } from './pageLayout'

const customer: FullstackEntityDef = {
  name: 'Customer',
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true },
    { name: 'name', type: 'STRING' },
    { name: 'vip', type: 'BOOLEAN' },
  ],
}
const order: FullstackEntityDef = {
  name: 'Order',
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true },
    { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] },
    { name: 'total', type: 'BIG_DECIMAL' },
    { name: 'placedOn', type: 'LOCAL_DATE' },
  ],
  relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
}

describe('retargetWidget', () => {
  it('keeps what the new kind can still use', () => {
    const { widget, dropped } = retargetWidget(
      { kind: 'bar', entity: 'Order', groupBy: 'status', agg: 'sum', field: 'total', title: 'Revenue', presetFilter: { status: 'PAID' } },
      { kind: 'top' }, order)
    expect(widget).toEqual({ kind: 'top', entity: 'Order', groupBy: 'status', agg: 'sum', field: 'total', title: 'Revenue', presetFilter: { status: 'PAID' } })
    expect(dropped).toEqual([])
  })

  it('names what it drops', () => {
    const { widget, dropped } = retargetWidget(
      { kind: 'progress', entity: 'Order', agg: 'sum', field: 'total', target: '500', span: 2 },
      { kind: 'recent' }, order)
    expect(widget).toEqual({ kind: 'recent', entity: 'Order' })
    expect(dropped).toEqual(['aggregate', 'target'])
  })

  it('checks the settings against a new entity', () => {
    const { widget, dropped } = retargetWidget(
      { kind: 'bar', entity: 'Order', groupBy: 'status', presetFilter: { status: 'OPEN' }, dateField: 'placedOn' },
      { entity: 'Customer' }, customer)
    expect(widget).toEqual({ kind: 'bar', entity: 'Customer' })
    expect(dropped).toEqual(['group by', 'period date', 'filter'])
  })
})

describe('retargetReport', () => {
  it('keeps the charts the new entity can draw', () => {
    const page: FullstackPageDef = {
      id: 'r', type: 'report', entity: 'Order',
      charts: [{ groupBy: 'status' }, { groupBy: 'placedOn', bucket: 'year', agg: 'sum', field: 'total' }],
    }
    const { patch, dropped } = retargetReport(page, customer)
    expect(patch).toEqual({ entity: 'Customer', presetFilter: undefined, chart: undefined, charts: [{}, {}] })
    expect(dropped).toEqual(['group by', 'aggregate'])
  })
})

describe('retargetWizardSteps', () => {
  it('keeps the step shape when the new form mostly overlaps', () => {
    const renamed: FullstackEntityDef = { ...order, name: 'Purchase' }
    expect(retargetWizardSteps([{ title: 'Basics', fields: ['status', 'total'] }, { fields: ['customer'] }], renamed))
      .toEqual([{ title: 'Basics', fields: ['status', 'total'] }, { fields: ['customer'] }, { fields: ['id', 'placedOn'] }])
  })

  it('starts over when little of the old form carries over', () => {
    expect(retargetWizardSteps([{ fields: ['id', 'name', 'vip'] }], order))
      .toEqual([{ fields: ['id', 'status', 'total', 'placedOn'] }, { fields: ['customer'] }])
  })
})

describe('pageOfServerError', () => {
  const pages: FullstackPageDef[] = [
    { id: 'home', type: 'dashboard', widgets: [] },
    { id: 'orders', type: 'entity-list', entity: 'Order' },
  ]
  it('finds the page by id or by index', () => {
    expect(pageOfServerError("Page 'orders' (report): Order has no field 'x'", pages)).toBe(1)
    expect(pageOfServerError('pages[0].id is required', pages)).toBe(0)
  })
  it('ignores messages about other things', () => {
    expect(pageOfServerError("Page 'gone' needs a title", pages)).toBeNull()
    expect(pageOfServerError('Entity Order has no primary key', pages)).toBeNull()
  })
})
