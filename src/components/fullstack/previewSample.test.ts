import { describe, it, expect } from 'vitest'
import type { FullstackFieldDef } from '../../types'
import { auditText, cellText, detailText, sampleRaw, type SampleContext } from './previewSample'

const today = new Date(2026, 9, 27)
const en = (entity: string): SampleContext => ({ locale: 'en', entity, today })
const he = (entity: string): SampleContext => ({ locale: 'he', entity, today })
const f = (name: string, type: FullstackFieldDef['type'] = 'STRING', more: Partial<FullstackFieldDef> = {}): FullstackFieldDef => ({ name, type, ...more })
const rows = (field: FullstackFieldDef, ctx: SampleContext) => [1, 2, 3].map(r => sampleRaw(field, r, ctx))

describe('sampleRaw', () => {
  it('reads a name by the entity it belongs to', () => {
    expect(rows(f('name'), en('Customer')).every(v => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(String(v)))).toBe(true)
    expect(rows(f('name'), en('Supplier'))).toEqual(expect.arrayContaining([expect.stringMatching(/Ltd|Inc|Systems|Logistics|Foods|Health|Media|Supply/)]))
    expect(new Set(rows(f('name'), en('Product'))).size).toBe(3)
    expect(rows(f('name'), en('Warehouse')).every(v => ['Tel Aviv', 'Haifa', 'Jerusalem', 'Beersheba', 'Netanya', 'Eilat', 'Herzliya', 'Ashdod'].includes(String(v)))).toBe(true)
  })

  it('fills e-mails, phones, codes, cities and notes by the field name', () => {
    expect(sampleRaw(f('email'), 1, en('Customer'))).toMatch(/^[a-z]+\.[a-z]+@example\.com$/)
    expect(sampleRaw(f('contact', 'STRING', { email: true }), 1, en('Customer'))).toMatch(/@example\.com$/)
    expect(sampleRaw(f('phone'), 2, en('Customer'))).toMatch(/^\(555\) 01\d-\d{4}$/)
    expect(sampleRaw(f('phone'), 2, he('Customer'))).toMatch(/^05\d-\d{6}$/)
    expect(sampleRaw(f('sku'), 3, en('Product'))).toBe('PRO-1021')
    expect(typeof sampleRaw(f('notes', 'TEXT'), 1, en('Order'))).toBe('string')
    expect(String(sampleRaw(f('notes', 'TEXT'), 1, en('Order')))).toMatch(/\.$/)
    expect(sampleRaw(f('assignee'), 1, en('Ticket'))).toMatch(/^[a-z]+\.[a-z]+$/)
  })

  it('speaks Hebrew under the Hebrew locale, but keeps e-mail addresses Latin', () => {
    expect(String(sampleRaw(f('name'), 1, he('Customer')))).toMatch(/^[\u0590-\u05FF]+ [\u0590-\u05FF]+$/)
    expect(String(sampleRaw(f('city'), 1, he('Customer')))).toMatch(/[\u0590-\u05FF]/)
    expect(sampleRaw(f('email'), 1, he('Customer'))).toMatch(/^[a-z.]+@example\.com$/)
  })

  it('keeps numbers inside min/max, money with cents, and the default on the first row', () => {
    for (const r of [1, 2, 3, 4, 5]) {
      const v = sampleRaw(f('quantity', 'INTEGER', { min: 10, max: 12 }), r, en('Order')) as number
      expect(Number.isInteger(v) && v >= 10 && v <= 12).toBe(true)
    }
    const price = sampleRaw(f('price', 'BIG_DECIMAL'), 2, en('Product')) as number
    expect(price).toBeGreaterThanOrEqual(20)
    expect(Math.round(price * 100)).toBe(price * 100)
    expect(sampleRaw(f('status', 'STRING', { defaultValue: 'draft' }), 1, en('Order'))).toBe('draft')
    expect(sampleRaw(f('active', 'BOOLEAN', { defaultValue: 'false' }), 1, en('Order'))).toBe(false)
    expect(sampleRaw(f('active', 'BOOLEAN'), 2, en('Order'))).toBe(false)
  })

  it('dates rows a few days back from today, and due dates ahead of it', () => {
    const placed = String(sampleRaw(f('placedOn', 'LOCAL_DATE'), 1, en('Order')))
    expect(placed < '2026-10-27' && placed >= '2026-10-21').toBe(true)
    const due = String(sampleRaw(f('dueDate', 'LOCAL_DATE'), 1, en('Task')))
    expect(due > '2026-10-27').toBe(true)
    expect(sampleRaw(f('sentAt', 'LOCAL_DATE_TIME'), 1, en('Mail'))).toMatch(/^2026-10-\d\dT\d\d:(00|15|30|45):00$/)
  })

  it('falls back to “Label N” when the field fits nothing, or its pattern refuses the guess, and cuts to the length', () => {
    expect(sampleRaw(f('flavour'), 2, en('Order'))).toBe('Flavour 2')
    expect(sampleRaw(f('city', 'STRING', { pattern: '[0-9]+' }), 1, en('Order'))).toBe('City 1')
    expect(String(sampleRaw(f('description', 'STRING', { length: 6 }), 1, en('Order')))).toHaveLength(6)
  })

  it('is the same every time for the same entity, field and row', () => {
    const field = f('price', 'BIG_DECIMAL')
    expect(rows(field, en('Product'))).toEqual(rows(field, en('Product')))
    expect(sampleRaw(f('id', 'UUID', { primaryKey: true }), 1, en('Order'))).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(sampleRaw(f('id', 'LONG', { primaryKey: true }), 3, en('Order'))).toBe(3)
  })
})

describe('cellText / detailText', () => {
  const status = f('status', 'ENUM', { enumValues: ['OPEN', 'IN_PROGRESS'], enumLabels: { OPEN: 'Waiting' } })
  const words = { yes: 'Yes', no: 'No' }

  it('shows a list cell as the generated table does: labels for enums, the raw value otherwise', () => {
    expect(cellText(status, 'OPEN')).toBe('Waiting')
    expect(cellText(status, 'IN_PROGRESS')).toBe('In progress')
    expect(cellText(f('active', 'BOOLEAN'), true)).toBe('true')
    expect(cellText(f('placedOn', 'LOCAL_DATE'), '2026-10-20')).toBe('2026-10-20')
  })

  it('formats details as the generated drawer does', () => {
    expect(detailText(f('active', 'BOOLEAN'), true, 'en', words)).toBe('Yes')
    expect(detailText(f('placedOn', 'LOCAL_DATE'), '2026-10-20', 'en', words)).toBe(new Date(2026, 9, 20).toLocaleDateString('en'))
    expect(detailText(f('placedOn', 'LOCAL_DATE'), '2026-10-20', 'he', words)).toBe(new Date(2026, 9, 20).toLocaleDateString('he'))
    expect(auditText(1, true, 'en', today)).toBe(new Date(2026, 9, 26, 10, 40).toLocaleString('en'))
  })
})
