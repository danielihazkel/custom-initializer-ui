import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import {
  duplicatePage, pageOfServerError, requestPages, retargetEntityList, retargetMasterDetail, retargetMasterDetailChild, retargetRecord, retargetReport,
  retargetWidget, retargetWizardSteps, stripDateRange,
} from './pageLayout'

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

describe('retargetEntityList', () => {
  it('keeps the columns, sort and view the new entity also has, and names the rest', () => {
    const page: FullstackPageDef = {
      id: 'l', type: 'entity-list', entity: 'Order', columns: ['status', 'total', 'customer'],
      sort: { field: 'total', dir: 'desc' }, view: 'table', presetFilter: { status: 'OPEN' },
    }
    const { patch, dropped } = retargetEntityList(page, customer)
    expect(patch).toEqual({ entity: 'Customer', presetFilter: undefined, columns: undefined, sort: undefined, view: 'table' })
    expect(dropped).toEqual(['filter', 'columns', 'sort'])
  })

  it('is silent when everything fits', () => {
    const page: FullstackPageDef = { id: 'l', type: 'entity-list', entity: 'Order', columns: ['status'], sort: { field: 'status' } }
    const { patch, dropped } = retargetEntityList(page, { ...order, name: 'Purchase' })
    expect(patch).toEqual({ entity: 'Purchase', presetFilter: undefined, columns: ['status'], sort: { field: 'status' }, view: undefined })
    expect(dropped).toEqual([])
  })

  it('drops a view the new entity does not offer, and keeps a partial column set', () => {
    const board: FullstackEntityDef = { ...order, name: 'Task', listViews: ['table', 'kanban'] }
    const page: FullstackPageDef = { id: 'l', type: 'entity-list', entity: 'Task', view: 'kanban', columns: ['status', 'vip'] }
    expect(retargetEntityList(page, customer)).toEqual({ patch: { entity: 'Customer', presetFilter: undefined, columns: ['vip'], sort: undefined, view: undefined }, dropped: ['columns', 'view'] })
    expect(retargetEntityList(page, board).dropped).toEqual(['columns'])
  })
})

describe('retargetMasterDetail / retargetMasterDetailChild / retargetRecord / stripDateRange', () => {
  const invoice: FullstackEntityDef = {
    name: 'Invoice',
    fields: [{ name: 'id', type: 'LONG', primaryKey: true }],
    relations: [
      { type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' },
      { type: 'MANY_TO_ONE', fieldName: 'payer', targetEntity: 'Customer' },
    ],
  }
  const entities = [customer, order, invoice]

  it('keeps a master-detail child and link that still fit the new parent, and picks a lone child', () => {
    const page: FullstackPageDef = { id: 'md', type: 'master-detail', parent: 'Customer', child: 'Invoice', via: 'payer' }
    expect(retargetMasterDetail(page, 'Order', entities))
      .toEqual({ patch: { parent: 'Order', child: undefined, via: undefined }, dropped: ['child', 'linked-through relation'] })
    expect(retargetMasterDetail({ ...page, parent: 'Order' }, 'Customer', entities))
      .toEqual({ patch: { parent: 'Customer', child: 'Invoice', via: 'payer' }, dropped: [] })
    expect(retargetMasterDetail({ id: 'md', type: 'master-detail' }, 'Customer', [customer, order]).patch)
      .toEqual({ parent: 'Customer', child: 'Order', via: undefined })
  })

  it('keeps the link when the new child also has it', () => {
    const page: FullstackPageDef = { id: 'md', type: 'master-detail', parent: 'Customer', child: 'Invoice', via: 'payer' }
    expect(retargetMasterDetailChild(page, 'Order', entities))
      .toEqual({ patch: { child: 'Order', via: undefined }, dropped: ['linked-through relation'] })
    expect(retargetMasterDetailChild({ ...page, via: 'customer' }, 'Order', entities))
      .toEqual({ patch: { child: 'Order', via: 'customer' }, dropped: [] })
  })

  it('resets a record page’s related lists and header numbers', () => {
    expect(retargetRecord({ id: 'r', type: 'record', entity: 'Customer', childTabs: ['Order'], headerStats: [{ child: 'Order' }] }, 'Order'))
      .toEqual({ patch: { entity: 'Order', childTabs: undefined, headerStats: undefined }, dropped: ['related lists', 'header numbers'] })
    expect(retargetRecord({ id: 'r', type: 'record', entity: 'Customer' }, 'Order').dropped).toEqual([])
  })

  it('strips the period date and comparison when the picker goes', () => {
    const page: FullstackPageDef = {
      id: 'd', type: 'dashboard', dateRange: '30d',
      widgets: [{ kind: 'kpi', entity: 'Order', dateField: 'placedOn', compare: true }, { kind: 'kpi', entity: 'Customer' }],
    }
    const { patch, dropped } = stripDateRange(page)
    expect(patch.dateRange).toBeUndefined()
    expect(patch.widgets).toEqual([{ kind: 'kpi', entity: 'Order', dateField: undefined, compare: undefined }, { kind: 'kpi', entity: 'Customer' }])
    expect(dropped).toEqual(['period date', 'period comparison'])
    expect(stripDateRange({ ...page, widgets: [{ kind: 'kpi', entity: 'Customer' }] }).dropped).toEqual([])
  })
})

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
  it('keeps the step shape when the new form mostly overlaps, and drops nothing', () => {
    const renamed: FullstackEntityDef = { ...order, name: 'Purchase' }
    expect(retargetWizardSteps([{ title: 'Basics', fields: ['status', 'total'] }, { fields: ['customer'] }], renamed))
      .toEqual({ steps: [{ title: 'Basics', fields: ['status', 'total'] }, { fields: ['customer'] }, { fields: ['id', 'placedOn'] }], dropped: [] })
  })

  it('names the fields that did not carry over', () => {
    expect(retargetWizardSteps([{ fields: ['status', 'total', 'placedOn', 'customer', 'note'] }], order))
      .toEqual({ steps: [{ fields: ['status', 'total', 'placedOn', 'customer'] }, { fields: ['id'] }], dropped: ['fields'] })
  })

  it('starts over when little of the old form carries over', () => {
    expect(retargetWizardSteps([{ fields: ['id', 'name', 'vip'] }], order))
      .toEqual({ steps: [{ fields: ['id', 'status', 'total', 'placedOn'] }, { fields: ['customer'] }], dropped: ['step layout'] })
  })

  it('drops nothing when there were no steps to keep', () => {
    expect(retargetWizardSteps(undefined, order).dropped).toEqual([])
  })
})

describe('requestPages', () => {
  it('strips the editor-only id lock and nothing else; duplicatePage does not carry it', () => {
    const page: FullstackPageDef = { id: 'queue', idLocked: true, type: 'entity-list', entity: 'Order', title: 'Queue' }
    expect(requestPages([page])).toEqual([{ id: 'queue', type: 'entity-list', entity: 'Order', title: 'Queue' }])
    expect(page.idLocked).toBe(true)
    expect('idLocked' in duplicatePage(page, ['queue'])).toBe(false)
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

describe('the donut, stacked and text widgets', () => {
  it('keeps a breakdown’s group when it becomes a donut or a stacked chart', () => {
    const { widget, dropped } = retargetWidget({ kind: 'bar', entity: 'Order', groupBy: 'status' }, { kind: 'stacked' }, order)
    expect(widget).toEqual({ kind: 'stacked', entity: 'Order', groupBy: 'status' })
    expect(dropped).toEqual([])
  })

  it('drops the data settings when a widget becomes a text note', () => {
    const { widget, dropped } = retargetWidget({ kind: 'bar', entity: 'Order', groupBy: 'status', title: 'Mix' }, { kind: 'text' }, order)
    expect(widget).toEqual({ kind: 'text', entity: '', title: 'Mix' })
    expect(dropped).toEqual(['data settings'])
  })
})
