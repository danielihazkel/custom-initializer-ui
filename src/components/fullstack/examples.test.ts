import { describe, it, expect } from 'vitest'
import type { ExampleModel } from '../../types'
import { cloneExample } from './examples'
import { validatePages } from './pageLayout'
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

  // On the set's default dependencies (ldap-auth-rest, so roles are allowed) and the example's own opts.
  const layoutOf = (model: ExampleModel) =>
    validatePages(model.pages!, model.entities, { ldapAuth: true, scaffoldOpts: model.settings?.scaffold })

  it.each(EXAMPLES.filter(m => m.pages?.length).map(m => [m.name, m] as const))('%s opens on a layout with no problems or warnings', (_name, model) => {
    const v = layoutOf(model)
    expect(v.problems).toEqual([])
    expect(Object.values(v.byPage).flatMap(controls => Object.values(controls))).toEqual([])
    expect(v.warnings.map(w => w.summary)).toEqual([])
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
