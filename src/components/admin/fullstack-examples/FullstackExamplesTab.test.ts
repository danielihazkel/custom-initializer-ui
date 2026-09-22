import { describe, it, expect } from 'vitest'
import { validateFullstackExample, type ExampleDraft } from './FullstackExamplesTab'

const entities = [{
  name: 'Item',
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true, generated: true },
    { name: 'title', type: 'STRING', required: true },
  ],
}]

const draft = (over: Partial<ExampleDraft> = {}): ExampleDraft => ({
  exampleId: 'items', name: 'Items', icon: 'inventory_2', entitiesText: JSON.stringify(entities), ...over,
})

describe('validateFullstackExample', () => {
  it('accepts a valid example and returns the parsed entities', () => {
    const r = validateFullstackExample(draft())
    expect(r.errors).toEqual({})
    expect(r.entities?.[0].name).toBe('Item')
  })

  it('requires an id and a name, and checks the slug and icon', () => {
    expect(validateFullstackExample(draft({ exampleId: ' ', name: '' })).errors).toMatchObject({ exampleId: 'Required', name: 'Required' })
    for (const id of ['Blog', '1blog', 'my blog', 'blog_x']) {
      expect(validateFullstackExample(draft({ exampleId: id })).errors.exampleId).toBeTruthy()
    }
    expect(validateFullstackExample(draft({ icon: 'Shopping Cart' })).errors.icon).toBeTruthy()
  })

  it('rejects bad JSON, a non-array, an empty array and a model the editor flags', () => {
    expect(validateFullstackExample(draft({ entitiesText: '[{' })).errors.entitiesText).toMatch(/Not valid JSON/)
    expect(validateFullstackExample(draft({ entitiesText: '{}' })).errors.entitiesText).toMatch(/non-empty/)
    expect(validateFullstackExample(draft({ entitiesText: '[]' })).errors.entitiesText).toMatch(/non-empty/)
    const noPk = JSON.stringify([{ name: 'Item', fields: [{ name: 'title', type: 'STRING' }] }])
    expect(validateFullstackExample(draft({ entitiesText: noPk })).errors.entitiesText).toMatch(/problem/)
  })

  it('treats a blank layout / settings as none and parses them when given', () => {
    const blank = validateFullstackExample(draft({ pagesText: '  ', settingsText: '' }))
    expect(blank.errors).toEqual({})
    expect(blank.pages).toBeNull()
    expect(blank.settings).toBeNull()
    const given = validateFullstackExample(draft({
      pagesText: JSON.stringify([{ id: 'items', type: 'entity-list', entity: 'Item' }]),
      settingsText: JSON.stringify({ locale: 'he' }),
    }))
    expect(given.errors).toEqual({})
    expect(given.pages?.[0].id).toBe('items')
    expect(given.settings?.locale).toBe('he')
  })

  it('rejects a layout that is not an array and settings that are not an object', () => {
    const r = validateFullstackExample(draft({ pagesText: '{}', settingsText: '[]' }))
    expect(r.errors.pagesText).toMatch(/JSON array of pages/)
    expect(r.errors.settingsText).toMatch(/JSON object/)
    expect(validateFullstackExample(draft({ pagesText: '[' })).errors.pagesText).toMatch(/Not valid JSON/)
  })
})
