import { describe, it, expect } from 'vitest'
import { FULLSTACK_ENTITY_OPT_KEYS } from '../../types'
import { ENTITY_OPT_LABELS, OPTIONS_SECTION, PROJECT_ONLY_OPTS, RTL_OPTION, SCAFFOLD_OPTIONS, optCoverage } from './scaffoldOptions'
import { withUids } from './uid'

describe('scaffoldOptions', () => {
  it('derives the per-entity labels from exactly the overridable keys', () => {
    expect(Object.keys(ENTITY_OPT_LABELS).sort()).toEqual([...FULLSTACK_ENTITY_OPT_KEYS].sort())
    expect(SCAFFOLD_OPTIONS.filter(o => o.perEntity).map(o => o.value).sort()).toEqual([...FULLSTACK_ENTITY_OPT_KEYS].sort())
    // The entity wording is the shorter, per-entity one where it exists.
    expect(ENTITY_OPT_LABELS.tests).toEqual({ label: 'Controller tests', hint: '@WebMvcTest for this entity' })
  })

  it('keeps RTL out of the Options section and lists the project-only flags', () => {
    expect(RTL_OPTION.value).toBe('rtl')
    expect(OPTIONS_SECTION.some(o => o.value === 'rtl')).toBe(false)
    expect(PROJECT_ONLY_OPTS.map(o => o.value)).toEqual(['inverseCollections', 'openapi', 'secured', 'seedData'])
  })

  it('reports which entities a project option reaches and why the others are skipped', () => {
    const pk = { name: 'id', type: 'LONG' as const, primaryKey: true, generated: true }
    const entities = withUids([
      { name: 'Order', fields: [pk, { name: 'n', type: 'STRING' }] },
      { name: 'Report', viewQuery: 'select 1 as id', fields: [pk] },
      { name: 'Enrolment', fields: [{ name: 'a', type: 'LONG', primaryKey: true }, { name: 'b', type: 'LONG', primaryKey: true }, { name: 'n', type: 'STRING' }] },
      { name: 'Note', opts: { softDelete: false }, fields: [pk, { name: 'n', type: 'STRING' }] },
    ])
    const coverage = optCoverage(entities, 'softDelete')
    expect(coverage.applies.map(e => e.name)).toEqual(['Order'])
    expect(coverage.excluded).toEqual([
      { uid: entities[1].uid, name: 'Report', reason: 'SELECT-backed view' },
      { uid: entities[2].uid, name: 'Enrolment', reason: 'composite primary key' },
      { uid: entities[3].uid, name: 'Note', reason: 'opted out on the entity' },
    ])
    // CSV export applies everywhere unless opted out.
    expect(optCoverage(entities, 'csvExport').applies).toHaveLength(4)
  })
})
