import { describe, it, expect } from 'vitest'
import { defaultValueError, validateEntities } from './validation'
import { parseQuickAdd } from './quickAdd'

describe('defaultValueError mirrors the backend type check', () => {
  it('accepts well-typed defaults and rejects the rest', () => {
    expect(defaultValueError({ type: 'INTEGER', defaultValue: '42' })).toBeUndefined()
    expect(defaultValueError({ type: 'INTEGER', defaultValue: 'abc' })).toBe('Must be a whole number')
    expect(defaultValueError({ type: 'LONG', defaultValue: '1.5' })).toBe('Must be a whole number')
    expect(defaultValueError({ type: 'BIG_DECIMAL', defaultValue: '1.50' })).toBeUndefined()
    expect(defaultValueError({ type: 'BOOLEAN', defaultValue: 'True' })).toBeUndefined()
    expect(defaultValueError({ type: 'BOOLEAN', defaultValue: 'yes' })).toBe('Must be true or false')
    expect(defaultValueError({ type: 'LOCAL_DATE', defaultValue: '2024-02-29' })).toBeUndefined()
    expect(defaultValueError({ type: 'LOCAL_DATE', defaultValue: '29/02/2024' })).toMatch(/ISO date/)
    expect(defaultValueError({ type: 'LOCAL_DATE_TIME', defaultValue: '2024-02-29T10:30' })).toBeUndefined()
    expect(defaultValueError({ type: 'UUID', defaultValue: '123e4567-e89b-12d3-a456-426614174000' })).toBeUndefined()
    expect(defaultValueError({ type: 'UUID', defaultValue: 'nope' })).toBe('Must be a UUID')
    expect(defaultValueError({ type: 'ENUM', defaultValue: 'active', enumValues: ['ACTIVE', 'CLOSED'] })).toBeUndefined()
    expect(defaultValueError({ type: 'ENUM', defaultValue: 'GONE', enumValues: ['ACTIVE'] })).toBe('Must be one of the enum values')
    expect(defaultValueError({ type: 'STRING', defaultValue: 'abcd', length: 3 })).toMatch(/max length/)
    expect(defaultValueError({ type: 'STRING', defaultValue: '', length: 3 })).toBeUndefined()
    expect(defaultValueError({ type: 'LONG', defaultValue: '1', primaryKey: true, generated: true })).toMatch(/generated key/)
  })

  it('surfaces as a per-field error in validateEntities', () => {
    const r = validateEntities([{
      name: 'Ticket',
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true, generated: true },
        { name: 'priority', type: 'INTEGER', defaultValue: 'high' },
      ],
    }])
    expect(r.entities[0]?.fields[1]?.defaultValue).toBe('Must be a whole number')
    expect(r.count).toBe(1)
  })

  it('is settable from the quick-add grammar', () => {
    const r = parseQuickAdd('status values=OPEN|DONE default=OPEN\ncount int default=0')
    expect(r.fields.map(f => f.defaultValue)).toEqual(['OPEN', '0'])
  })
})
