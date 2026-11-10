import { describe, expect, it } from 'vitest'
import type { FullstackEntityDef, FullstackFieldDef } from '../../types'
import { isDateType, isDecimalType, isKeyableType, isLongTextType, isNumericType, isTextualType } from './fieldTypes'
import { cellText, detailText, moneyText } from './previewSample'
import { parseQuickAdd } from './quickAdd'
import { carryDefaultAcrossTypes, defaultValueError, validateEntities } from './validation'

const pk: FullstackFieldDef = { name: 'id', type: 'LONG', primaryKey: true, generated: true }
const entity = (...fields: FullstackFieldDef[]): FullstackEntityDef => ({ name: 'Shift', fields: [pk, ...fields] })

describe('what kind of thing a field type is (mirrors FieldType.java)', () => {
  it('money is a number with decimals; Markdown is long, searchable text', () => {
    expect(isNumericType('MONEY')).toBe(true)
    expect(isDecimalType('MONEY')).toBe(true)
    expect(isDecimalType('LONG')).toBe(false)
    expect(isLongTextType('MARKDOWN')).toBe(true)
    expect(isTextualType('MARKDOWN')).toBe(true)
    expect(isTextualType('LOCAL_TIME')).toBe(false)
  })

  it('a time of day and an instant are not dates the app filters or charts by', () => {
    expect(isDateType('LOCAL_DATE')).toBe(true)
    expect(isDateType('LOCAL_DATE_TIME')).toBe(true)
    expect(isDateType('LOCAL_TIME')).toBe(false)
    expect(isDateType('INSTANT')).toBe(false)
  })

  it('the Round 9 types cannot be a key', () => {
    for (const t of ['LOCAL_TIME', 'INSTANT', 'MONEY', 'MARKDOWN'] as const) expect(isKeyableType(t), t).toBe(false)
    for (const t of ['LONG', 'STRING', 'UUID', 'LOCAL_DATE'] as const) expect(isKeyableType(t), t).toBe(true)
  })
})

describe('validation of the Round 9 types', () => {
  it('checks a default the way the server parses it', () => {
    expect(defaultValueError({ type: 'MONEY', defaultValue: '12.50' })).toBeUndefined()
    expect(defaultValueError({ type: 'MONEY', defaultValue: '12.505' })).toMatch(/two decimals/)
    expect(defaultValueError({ type: 'LOCAL_TIME', defaultValue: '09:30' })).toBeUndefined()
    expect(defaultValueError({ type: 'LOCAL_TIME', defaultValue: '9:30' })).toMatch(/time/)
    expect(defaultValueError({ type: 'LOCAL_TIME', defaultValue: '25:00' })).toMatch(/time/)
    expect(defaultValueError({ type: 'INSTANT', defaultValue: '2026-01-31T08:00:00Z' })).toBeUndefined()
    expect(defaultValueError({ type: 'INSTANT', defaultValue: '2026-01-31T08:00:00' })).toMatch(/UTC instant/)
    expect(defaultValueError({ type: 'MARKDOWN', defaultValue: '# Hello' })).toBeUndefined()
  })

  it('keeps a default across TEXT and MARKDOWN, like STRING and TEXT', () => {
    expect(carryDefaultAcrossTypes('TEXT', 'MARKDOWN', 'notes')).toBe('notes')
    expect(carryDefaultAcrossTypes('MONEY', 'BIG_DECIMAL', '5')).toBeUndefined()
  })

  it('a currency is a MONEY field\'s, three letters', () => {
    const errors = validateEntities([entity(
      { name: 'rate', type: 'MONEY', currency: 'usd' },
      { name: 'fee', type: 'MONEY', currency: 'shekel' },
      { name: 'total', type: 'BIG_DECIMAL', currency: 'USD' },
      { name: 'bonus', type: 'MONEY' },
    )])
    const fields = errors.entities[0].fields
    expect(fields[1]).toBeUndefined()
    expect(fields[2].currency).toMatch(/three-letter/)
    expect(fields[3].currency).toMatch(/MONEY only/)
    expect(fields[4]).toBeUndefined()
  })

  it('money takes decimal bounds; a Round 9 type as the key is flagged', () => {
    const ok = validateEntities([entity({ name: 'rate', type: 'MONEY', min: 0.5, max: 99.99 })])
    expect(ok.entities[0]).toBeUndefined()
    const bad = validateEntities([{ name: 'Shift', fields: [{ name: 'amount', type: 'MONEY', primaryKey: true }] }])
    expect(bad.entities[0].fields[0].generated).toMatch(/cannot be the key/)
  })
})

describe('quick add', () => {
  it('reads the new types, their aliases and a currency', () => {
    const { fields, errors } = parseQuickAdd([
      'startsAt time default=09:00',
      'clockedIn instant',
      'rate money currency=usd min=0',
      'notes markdown',
      'bio rich_text',
    ].join('\n'))
    expect(errors).toEqual([])
    expect(fields.map(f => f.type)).toEqual(['LOCAL_TIME', 'INSTANT', 'MONEY', 'MARKDOWN', 'MARKDOWN'])
    expect(fields[2].currency).toBe('USD')
    expect(fields[0].defaultValue).toBe('09:00')
  })
})

describe('preview text', () => {
  it('prints money in its currency, ILS when it names none', () => {
    expect(moneyText({ name: 'rate', type: 'MONEY', currency: 'USD' }, 1234.5)).toBe('$1,234.50')
    expect(moneyText({ name: 'rate', type: 'MONEY' }, 10)).toContain('10.00')
    expect(cellText({ name: 'rate', type: 'MONEY', currency: 'USD' }, 5)).toBe('$5.00')
    // An unknown code never throws in the preview; the validator is what reports it.
    expect(moneyText({ name: 'rate', type: 'MONEY', currency: '???' }, 5)).toBe('5')
  })

  it('shows an instant as a local date-time', () => {
    const words = { yes: 'Yes', no: 'No' }
    expect(detailText({ name: 'seenAt', type: 'INSTANT' }, '2026-01-31T08:00:00Z', 'en', words))
      .toBe(new Date('2026-01-31T08:00:00Z').toLocaleString('en'))
  })
})

describe('file and image fields', () => {
  it('are not keys, take no default, and quick add reads them', () => {
    expect(isKeyableType('FILE')).toBe(false)
    expect(isKeyableType('IMAGE')).toBe(false)
    expect(defaultValueError({ type: 'FILE', defaultValue: 'a.pdf' })).toMatch(/uploaded, not typed/)
    const { fields, errors } = parseQuickAdd('contract file\nphoto image required\nscan attachment\navatar photo')
    expect(errors).toEqual([])
    expect(fields.map(f => f.type)).toEqual(['FILE', 'IMAGE', 'FILE', 'IMAGE'])
    expect(fields[1].required).toBe(true)
  })

  it('validate as ordinary fields otherwise', () => {
    const errors = validateEntities([entity({ name: 'contract', type: 'FILE' }, { name: 'photo', type: 'IMAGE', required: true })])
    expect(errors.entities[0]).toBeUndefined()
  })
})
