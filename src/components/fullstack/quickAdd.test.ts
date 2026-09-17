import { describe, it, expect } from 'vitest'
import { parseQuickAdd } from './quickAdd'

const strip = (r: ReturnType<typeof parseQuickAdd>) => r.fields.map(({ uid: _u, ...f }) => f)

describe('parseQuickAdd', () => {
  it('parses one field per line with type aliases, flags and key=value options', () => {
    const r = parseQuickAdd([
      '# comment',
      'id long pk gen',
      'email STRING req uniq email len=200',
      'nickname varchar(40)',
      'age int min=0 max=150 nofilter',
      'status values=DRAFT|SENT|PAID req',
      'price decimal',
      'createdOn date lock',
      'notes text nosearch label="Internal notes"',
      'ref:uuid',
      '',
    ].join('\n'))
    expect(r.errors).toEqual([])
    expect(strip(r)).toEqual([
      { name: 'id', type: 'LONG', primaryKey: true, generated: true },
      { name: 'email', type: 'STRING', required: true, unique: true, email: true, length: 200 },
      { name: 'nickname', type: 'STRING', length: 40 },
      { name: 'age', type: 'INTEGER', min: 0, max: 150, filterable: false },
      { name: 'status', type: 'ENUM', enumValues: ['DRAFT', 'SENT', 'PAID'], required: true },
      { name: 'price', type: 'BIG_DECIMAL' },
      { name: 'createdOn', type: 'LOCAL_DATE', readOnly: true },
      { name: 'notes', type: 'TEXT', searchable: false, label: 'Internal notes' },
      { name: 'ref', type: 'UUID' },
    ])
  })

  it('defaults to STRING and tolerates bullets and trailing commas', () => {
    const r = parseQuickAdd('- title,\n* body text;')
    expect(strip(r)).toEqual([{ name: 'title', type: 'STRING' }, { name: 'body', type: 'TEXT' }])
  })

  it('reports unknown tokens per line and keeps the good lines', () => {
    const r = parseQuickAdd('ok string\nfirst name string\nbad flux=1')
    expect(r.fields.map(f => f.name)).toEqual(['ok'])
    expect(r.errors).toEqual([
      { line: 2, message: "first: unknown type 'name'" },
      { line: 3, message: "bad: unknown option 'flux'" },
    ])
  })
})
