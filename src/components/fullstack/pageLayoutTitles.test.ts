import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { MAX_TITLE, retargetHeaderStat, validatePages } from './pageLayout'

const customer: FullstackEntityDef = {
  name: 'Customer',
  fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }],
}
const order: FullstackEntityDef = {
  name: 'Order',
  fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'total', type: 'BIG_DECIMAL' }],
  relations: [{ fieldName: 'customer', targetEntity: 'Customer', type: 'MANY_TO_ONE' }],
}
const invoice: FullstackEntityDef = {
  name: 'Invoice',
  fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'total', type: 'BIG_DECIMAL' }],
  relations: [{ fieldName: 'billedTo', targetEntity: 'Customer', type: 'MANY_TO_ONE' }],
}
const entities = [customer, order, invoice]

describe('titles inside a page', () => {
  const long = 'x'.repeat(MAX_TITLE + 1)

  it('flags widget, tab, step and header-tile titles over the server cap', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order', title: long }] },
      { id: 'orders', type: 'entity-list', entity: 'Order' },
      { id: 'customers', type: 'entity-list', entity: 'Customer' },
      { id: 'both', type: 'tabs', title: 'Both', tabs: [{ page: 'orders', title: long }, { page: 'customers' }] },
      { id: 'new-order', type: 'wizard', entity: 'Order', steps: [{ title: long, fields: ['total', 'customer'] }] },
      { id: 'customer', type: 'record', entity: 'Customer', hidden: true, headerStats: [{ child: 'Order', title: long }] },
    ]
    const fields = validatePages(pages, entities).issues.map(p => p.field)
    expect(fields).toEqual(expect.arrayContaining(['widget.0', 'tab.0', 'step.0', 'headerStat.0']))
  })

  it('counts a title the way the server does: trimmed', () => {
    const pages: FullstackPageDef[] = [
      { id: 'home', type: 'dashboard', title: ` ${'x'.repeat(MAX_TITLE)} `, widgets: [{ kind: 'kpi', entity: 'Order' }] },
    ]
    expect(validatePages(pages, entities).problems).toEqual([])
  })
})

describe('retargetHeaderStat', () => {
  it('keeps the title, and the measure and link when they still fit', () => {
    expect(retargetHeaderStat({ child: 'Order', agg: 'sum', field: 'total', title: 'Spent' }, invoice, 'Customer'))
      .toEqual({ stat: { child: 'Invoice', agg: 'sum', field: 'total', title: 'Spent' }, dropped: [] })
  })

  it('names what it drops', () => {
    const { stat, dropped } = retargetHeaderStat({ child: 'Order', agg: 'avg', field: 'total', via: 'customer' }, { ...invoice, fields: invoice.fields.slice(0, 1) }, 'Customer')
    expect(stat).toEqual({ child: 'Invoice' })
    expect(dropped).toEqual(['measure', 'link'])
  })
})
