import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackListAction, FullstackPageDef } from '../../types'
import { retargetPage, validatePages } from './pageLayout'

const entities: FullstackEntityDef[] = [
  { name: 'Order', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'status', type: 'ENUM', enumValues: ['OPEN'] }] },
  { name: 'Summary', readOnly: true, fields: [{ name: 'id', type: 'LONG', primaryKey: true }] },
]

const list = (entity: string, hideActions: string[]): FullstackPageDef[] =>
  [{ id: 'list', type: 'entity-list', entity, hideActions: hideActions as FullstackListAction[] }]

describe('hidden list actions', () => {
  it('takes known actions once each, on a list with something to hide', () => {
    expect(validatePages(list('Order', ['new', 'bulk']), entities).problems).toEqual([])
    expect(validatePages(list('Order', ['archive']), entities).problems).toEqual(['Page “list” hides the unknown action “archive”'])
    expect(validatePages(list('Order', ['new', 'new']), entities).problems).toEqual(['Page “list” hides an action twice'])
    expect(validatePages(list('Summary', ['export']), entities).problems)
      .toEqual(['Page “list” hides actions, but Summary is read-only and exports nothing'])
    expect(validatePages(list('Summary', ['export']), entities, { scaffoldOpts: ['csvExport'] }).problems).toEqual([])
  })

  it('keeps them only while the page stays a list', () => {
    const page: FullstackPageDef = { id: 'list', type: 'entity-list', entity: 'Order', hideActions: ['edit'] }
    const { page: report, dropped } = retargetPage(page, 'report', entities, [page])
    expect(report.hideActions).toBeUndefined()
    expect(dropped).toContain('hidden actions')
  })
})
