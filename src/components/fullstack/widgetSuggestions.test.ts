import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { suggestWidgets, validatePages } from './pageLayout'

const customer: FullstackEntityDef = { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] }
const order: FullstackEntityDef = {
  name: 'Order',
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true },
    { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] },
    { name: 'quantity', type: 'INTEGER' },
    { name: 'amount', type: 'BIG_DECIMAL', label: 'Amount' },
    { name: 'placedOn', type: 'LOCAL_DATE' },
  ],
  relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
}
const entities = [customer, order]
const dashboard = (widgets: FullstackPageDef['widgets']): FullstackPageDef[] => [
  { id: 'desk', type: 'dashboard', widgets },
  { id: 'orders', type: 'entity-list', entity: 'Order' },
]

describe('suggestWidgets', () => {
  it('offers a count, a money total, a breakdown, a trend, a top list and the latest rows', () => {
    const got = suggestWidgets(order, dashboard([]), 0, { entities })
    expect(got.map(s => s.key)).toEqual(['count', 'sum:amount', 'donut:status', 'line:placedOn', 'top:customer', 'recent'])
    // The money column wins over the first number.
    expect(got[1].widget).toEqual({ kind: 'kpi', entity: 'Order', agg: 'sum', field: 'amount' })
    expect(got[3].widget).toMatchObject({ kind: 'line', groupBy: 'placedOn', bucket: 'month' })
  })

  it('leaves out what the dashboard already shows, a bar counting as a donut', () => {
    const got = suggestWidgets(order, dashboard([{ kind: 'kpi', entity: 'Order' }, { kind: 'bar', entity: 'Order' }]), 0, { entities })
    expect(got.map(s => s.key)).toEqual(['sum:amount', 'line:placedOn', 'top:customer', 'recent'])
  })

  it('offers only what an entity can show, and nothing off a dashboard', () => {
    expect(suggestWidgets(customer, dashboard([]), 0, { entities }).map(s => s.key)).toEqual(['count', 'recent'])
    expect(suggestWidgets(order, dashboard([]), 1, { entities })).toEqual([])
  })

  it('suggests only widgets the validator accepts', () => {
    const pages = dashboard([])
    const widgets = suggestWidgets(order, pages, 0, { entities }).map(s => s.widget)
    const filled = [{ ...pages[0], widgets }, pages[1]]
    expect(validatePages(filled, entities).problems).toEqual([])
  })
})
