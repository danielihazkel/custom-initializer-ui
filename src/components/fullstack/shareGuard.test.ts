import { describe, it, expect } from 'vitest'
import { draftHasUnsavedWork } from './shareGuard'
import { DEFAULT_PROJECT_META, makeSnapshot, type FullstackSnapshot } from './snapshot'
import type { FullstackEntityDef } from '../../types'

const stock: FullstackEntityDef[] = [{ name: 'User', fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }] }]
const STOCK_JSON = JSON.stringify(stock)

function snap(entities: FullstackEntityDef[], deps: string[] = []): FullstackSnapshot {
  return makeSnapshot({ meta: DEFAULT_PROJECT_META, entities, selectedDeps: deps, scaffoldOpts: [], backendSet: 'a', frontendSet: 'b' })
}

const edited = snap([{ name: 'Order', fields: [{ name: 'id', type: 'LONG', primaryKey: true }] }])
const link = snap([{ name: 'Invoice', fields: [{ name: 'id', type: 'LONG', primaryKey: true }] }])

describe('draftHasUnsavedWork', () => {
  it('lets a link replace the untouched stock model', () => {
    expect(draftHasUnsavedWork(snap(stock, ['web']), link, [], STOCK_JSON)).toBe(false)
  })

  it('lets a link replace a draft that is the same model', () => {
    expect(draftHasUnsavedWork(edited, edited, [], STOCK_JSON)).toBe(false)
  })

  it('lets a link replace a draft already kept as a preset or recent', () => {
    expect(draftHasUnsavedWork(edited, link, [snap(stock), edited], STOCK_JSON)).toBe(false)
  })

  it('protects a genuinely unsaved draft', () => {
    expect(draftHasUnsavedWork(edited, link, [snap(stock)], STOCK_JSON)).toBe(true)
  })
})
