import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackFieldDef } from '../../types'
import { validateEntities } from './validation'
import { uniqueKeysProblem } from './uniqueKeys'
import { requirableNames } from './workflow'
import { summarizeEntity } from './summary'

const trip = (photos: Partial<FullstackFieldDef>, over: Partial<FullstackEntityDef> = {}): FullstackEntityDef => ({
  name: 'Trip',
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true, generated: true },
    { name: 'title', type: 'STRING' },
    { name: 'photos', type: 'IMAGE', ...photos },
  ],
  ...over,
})

const photosError = (photos: Partial<FullstackFieldDef>) => validateEntities([trip(photos)]).entities[0]?.fields?.[2]?.maxFiles

describe('several files in one field', () => {
  it('takes 1 to 50 files on a FILE or IMAGE field, never on a condition', () => {
    expect(photosError({ maxFiles: 5 })).toBeUndefined()
    expect(photosError({ maxFiles: 50 })).toBeUndefined()
    expect(photosError({ maxFiles: 0 })).toBe('Between 1 and 50')
    expect(photosError({ maxFiles: 51 })).toBe('Between 1 and 50')
    expect(photosError({ type: 'STRING', maxFiles: 3 })).toBe('Several files apply to FILE and IMAGE only')
    expect(photosError({ maxFiles: 3, showWhen: "title == 'x'" })).toBe('A field with several files cannot be shown on a condition')
  })

  it('keeps such a field out of unique keys, a move\'s asks and the gallery', () => {
    expect(uniqueKeysProblem(trip({ maxFiles: 3 }, { uniqueKeys: [{ fields: ['title', 'photos'] }] })))
      .toMatch(/holds several files/)
    expect(requirableNames(trip({ maxFiles: 3 }))).toEqual(['title'])
    expect(requirableNames(trip({}))).toEqual(['title', 'photos'])
    const gallery = (photos: Partial<FullstackFieldDef>) => summarizeEntity(trip(photos, { listViews: ['table', 'gallery'] })).views
    expect(gallery({})).toContainEqual({ name: 'gallery', by: 'photos' })
    expect(gallery({ maxFiles: 3 })).toEqual([{ name: 'table' }])
  })
})
