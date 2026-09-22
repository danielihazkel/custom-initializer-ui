import { describe, it, expect } from 'vitest'
import type { ExampleModel } from '../../types'
import { cloneExample } from './examples'
import { validateEntities } from './validation'
// A copy of the seeded examples (backend catalog/fullstack-examples.json). The backend's
// FullstackExampleTests checks the seed against the generator's validator; this checks it
// against the editor's, which is stricter in places.
import seeded from './__fixtures__/fullstack-examples.json'

const EXAMPLES = seeded as ExampleModel[]

describe('example models', () => {
  it.each(EXAMPLES.map(m => [m.name, m] as const))('%s passes the editor validation', (_name, model) => {
    const result = validateEntities(cloneExample(model))
    expect(result.count, JSON.stringify(result.entities)).toBe(0)
  })

  it('has unique ids and at least two entities each', () => {
    const ids = EXAMPLES.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const m of EXAMPLES) expect(m.entities.length).toBeGreaterThanOrEqual(2)
  })

  it('cloneExample returns a detached copy', () => {
    const a = cloneExample(EXAMPLES[0])
    a[0].fields[0].name = 'changed'
    expect(EXAMPLES[0].entities[0].fields[0].name).toBe('id')
  })
})
