import { describe, it, expect } from 'vitest'
import { EXAMPLE_MODELS, cloneExample } from './examples'
import { validateEntities } from './validation'

describe('example models', () => {
  it.each(EXAMPLE_MODELS.map(m => [m.name, m] as const))('%s passes the editor validation', (_name, model) => {
    const result = validateEntities(cloneExample(model))
    expect(result.count, JSON.stringify(result.entities)).toBe(0)
  })

  it('has unique ids and at least two entities each', () => {
    const ids = EXAMPLE_MODELS.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const m of EXAMPLE_MODELS) expect(m.entities.length).toBeGreaterThanOrEqual(2)
  })

  it('cloneExample returns a detached copy', () => {
    const a = cloneExample(EXAMPLE_MODELS[0])
    a[0].fields[0].name = 'changed'
    expect(EXAMPLE_MODELS[0].entities[0].fields[0].name).toBe('id')
  })
})
