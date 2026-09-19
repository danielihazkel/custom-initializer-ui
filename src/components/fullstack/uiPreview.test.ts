import { describe, it, expect } from 'vitest'
import { buildUiPreview } from './uiPreview'
import { fieldChips } from './FieldChips'
import { settingsSummary } from './EntitySettingsPanel'
import { humanize, uniqueName } from './naming'
import type { FullstackEntityDef } from '../../types'

const customer: FullstackEntityDef = {
  name: 'Customer',
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true, generated: true },
    { name: 'fullName', type: 'STRING', required: true, length: 120, label: 'Full name' },
  ],
}
const order: FullstackEntityDef = {
  name: 'Order',
  label: 'Purchase',
  labelPlural: 'Purchases',
  listViews: ['table', 'kanban'],
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true, generated: true },
    { name: 'reference', type: 'STRING', required: true, unique: true, readOnly: true },
    { name: 'status', type: 'ENUM', required: true, enumValues: ['OPEN', 'PAID'], defaultValue: 'OPEN' },
    { name: 'total', type: 'BIG_DECIMAL', min: 0, max: 1000 },
    { name: 'notes', type: 'TEXT', searchable: false },
    { name: 'placedOn', type: 'LOCAL_DATE', filterable: false },
  ],
  relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer', required: true }],
}

describe('buildUiPreview', () => {
  const ctx = { projectOpts: ['audit', 'csvExport', 'bulkDelete'], entities: [customer, order] }

  it('derives the page title, columns (fields, relations, audit) and the enabled views', () => {
    const p = buildUiPreview(order, ctx)
    expect(p.title).toBe('Purchase')
    expect(p.titlePlural).toBe('Purchases')
    expect(p.views).toEqual(['table', 'kanban'])
    expect(p.columns.map(c => c.label)).toEqual(['Id', 'Reference', 'Status', 'Total', 'Notes', 'Placed on', 'Customer', 'Created', 'Updated'])
    expect(p.columns.map(c => c.kind)).toEqual(['key', 'text', 'enum', 'number', 'text', 'date', 'relation', 'audit', 'audit'])
    expect(p.hasExport).toBe(true)
    expect(p.hasSelection).toBe(true)
    expect(p.hasRowActions).toBe(true)
  })

  it('builds one form control per non-generated field plus a select per relation', () => {
    const p = buildUiPreview(order, ctx)
    expect(p.form.map(c => c.name)).toEqual(['reference', 'status', 'total', 'notes', 'placedOn', 'customer'])
    const status = p.form.find(c => c.name === 'status')!
    expect(status.control).toBe('select')
    // Options are the display labels the generated select shows (humanized when none is set).
    expect(status.options).toEqual(['Open', 'Paid'])
    expect(status.value).toBe('Open')
    expect(p.form.find(c => c.name === 'reference')!.locked).toBe(true)
    expect(p.form.find(c => c.name === 'total')!.hint).toBe('0 – 1000')
    expect(p.form.find(c => c.name === 'notes')!.control).toBe('textarea')
    const rel = p.form.find(c => c.name === 'customer')!
    expect(rel.isRelation).toBe(true)
    expect(rel.required).toBe(true)
    expect(rel.options).toEqual(['Choose Customer…'])
  })

  it('honours per-field search/filter opt-outs and the relation filter', () => {
    const p = buildUiPreview(order, ctx)
    // reference is searchable (default), notes opted out → search box still shown.
    expect(p.showSearch).toBe(true)
    // placedOn opted out of the filter bar; status stays; the relation adds Customer.
    expect(p.filters).toEqual(['Status', 'Total', 'Customer'])
  })

  it('makes a read-only view GET-only: no create, no row actions, no selection', () => {
    const view: FullstackEntityDef = {
      name: 'MonthlySales', viewQuery: 'SELECT 1 AS month', fields: [{ name: 'month', type: 'STRING', primaryKey: true }],
    }
    const p = buildUiPreview(view, { projectOpts: ['bulkDelete', 'audit'], entities: [view] })
    expect(p.canCreate).toBe(false)
    expect(p.hasRowActions).toBe(false)
    expect(p.hasSelection).toBe(false)
    expect(p.columns.map(c => c.kind)).toEqual(['key'])
    // A non-generated key is still typed on create — but there is no create form here.
    expect(p.form.map(c => c.name)).toEqual(['month'])
  })

  it('keeps a client-supplied primary key in the form as required', () => {
    const p = buildUiPreview({ name: 'Tag', fields: [{ name: 'code', type: 'STRING', primaryKey: true }] }, { projectOpts: [], entities: [] })
    expect(p.form).toHaveLength(1)
    expect(p.form[0].required).toBe(true)
    expect(p.titlePlural).toBe('Tags')
  })
})

describe('fieldChips', () => {
  it('lists everything set inside the More panel, label only when asked', () => {
    const f = order.fields[2]
    expect(fieldChips(f)).toEqual(['2 values', '= OPEN'])
    expect(fieldChips(order.fields[3])).toEqual(['0–1000'])
    expect(fieldChips(order.fields[1])).toEqual(['locked'])
    expect(fieldChips(order.fields[4])).toEqual(['no search'])
    expect(fieldChips(order.fields[5])).toEqual(['no filter'])
    expect(fieldChips(customer.fields[1])).toEqual(['len 120'])
    expect(fieldChips(customer.fields[1], { includeLabel: true })).toEqual(['“Full name”', 'len 120'])
    expect(fieldChips(customer.fields[0])).toEqual([])
  })
})

describe('settingsSummary', () => {
  it('summarises labels, mapping and the view state', () => {
    expect(settingsSummary(order)).toEqual(['“Purchase” / “Purchases”'])
    expect(settingsSummary({ ...customer, schema: 'crm', tableName: 'customers' })).toEqual(['crm.customers'])
    expect(settingsSummary({ ...customer, viewQuery: '' })).toEqual(['SELECT view (query missing)'])
    expect(settingsSummary({ ...customer, viewQuery: 'SELECT 1' })).toEqual(['SELECT view'])
    expect(settingsSummary(customer)).toEqual([])
  })
})

describe('naming helpers', () => {
  it('uniqueName avoids case-insensitive collisions by numbering', () => {
    expect(uniqueName('UserCopy', ['User'])).toBe('UserCopy')
    expect(uniqueName('UserCopy', ['User', 'usercopy'])).toBe('UserCopy2')
    expect(uniqueName('UserCopy', ['User', 'UserCopy', 'UserCopy2'])).toBe('UserCopy3')
  })
  it('humanize turns identifiers into labels', () => {
    expect(humanize('fullName')).toBe('Full name')
    expect(humanize('order_line')).toBe('Order line')
    expect(humanize('ID')).toBe('Id')
    expect(humanize('')).toBe('')
  })
})
