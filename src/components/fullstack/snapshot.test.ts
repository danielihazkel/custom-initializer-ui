import { describe, it, expect } from 'vitest'
import { DEFAULT_PROJECT_META, EXPORT_FORMAT, describeSnapshotChange, isSnapshot, makeSnapshot, normalizeMeta, parseExportedModel, snapshotChangeKey, toExportedModel, type FullstackSnapshot } from './snapshot'

const snapshot: FullstackSnapshot = {
  meta: {
    ...DEFAULT_PROJECT_META,
    groupId: 'com.menora', artifactId: 'shop', packageName: 'com.menora.shop', domainPackage: '',
    bootVersion: '3.2.1', javaVersion: '21', dashboardTitle: '', dashboardOverview: '',
  },
  entities: [
    { uid: 'e1', name: 'Order', fields: [{ uid: 'f1', name: 'id', type: 'LONG', primaryKey: true, generated: true }] },
  ],
  selectedDeps: ['data-jpa', 'web'],
  scaffoldOpts: ['audit'],
  backendSet: 'spring-jpa-crud',
  frontendSet: 'react-tailwind-crud',
  colorPalette: 'menora-digital',
}

describe('snapshot export / import', () => {
  it('exports a uid-free snapshot with a format marker and reads it back identically', () => {
    const exported = toExportedModel(snapshot)
    expect(exported.format).toBe(EXPORT_FORMAT)
    expect(JSON.stringify(exported)).not.toContain('"uid"')
    const result = parseExportedModel(JSON.stringify(exported, null, 2))
    expect('snapshot' in result && result.snapshot).toEqual(makeSnapshot(snapshot))
  })

  it('accepts a bare snapshot without the marker (e.g. copied from a preset) and keeps the palette', () => {
    const result = parseExportedModel(JSON.stringify(makeSnapshot(snapshot)))
    expect('snapshot' in result && result.snapshot.colorPalette).toBe('menora-digital')
  })

  it('rejects malformed input with a readable message instead of throwing', () => {
    expect(parseExportedModel('{not json')).toEqual({ error: 'Not valid JSON' })
    const wrong = parseExportedModel(JSON.stringify({ meta: {}, entities: 'nope' }))
    expect('error' in wrong && wrong.error).toMatch(/Not a fullstack model file/)
  })

  it('treats colorPalette as optional so older presets and links still validate', () => {
    const { colorPalette: _p, ...legacy } = snapshot
    expect(isSnapshot(legacy)).toBe(true)
    expect(isSnapshot({ ...legacy, colorPalette: 42 })).toBe(false)
    expect(makeSnapshot(legacy)).not.toHaveProperty('colorPalette')
  })
})

describe('normalizeMeta', () => {
  it('fills in the settings older stored models predate and coerces an unknown locale', () => {
    const m = normalizeMeta({ groupId: 'g', artifactId: 'a', locale: 'fr' as never })
    expect(m.groupId).toBe('g')
    expect(m.name).toBe('')
    expect(m.packaging).toBe('jar')
    expect(m.locale).toBe('en')
    expect(normalizeMeta(undefined)).toEqual(DEFAULT_PROJECT_META)
    expect(normalizeMeta({ locale: 'he' }).locale).toBe('he')
  })

  it('defaults the department to blank (the server default) and keeps a chosen one', () => {
    expect(normalizeMeta({ groupId: 'g' }).department).toBe('')
    expect(normalizeMeta({ department: 'fin' }).department).toBe('fin')
  })
})

describe('describeSnapshotChange reorder labels', () => {
  const two: FullstackSnapshot = makeSnapshot({
    ...snapshot,
    entities: [
      { name: 'Order', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'total', type: 'BIG_DECIMAL' }],
        relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }, { type: 'MANY_TO_ONE', fieldName: 'agent', targetEntity: 'Agent' }] },
      { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }] },
    ],
  })
  it('names a reorder of entities, fields and relations', () => {
    const entitiesSwapped = makeSnapshot({ ...two, entities: [two.entities[1], two.entities[0]] })
    expect(describeSnapshotChange(two, entitiesSwapped)).toBe('Reordered entities')
    const order = two.entities[0]
    const fieldsSwapped = makeSnapshot({ ...two, entities: [{ ...order, fields: [order.fields[1], order.fields[0]] }, two.entities[1]] })
    expect(describeSnapshotChange(two, fieldsSwapped)).toBe('Reordered fields of Order')
    const relsSwapped = makeSnapshot({ ...two, entities: [{ ...order, relations: [order.relations![1], order.relations![0]] }, two.entities[1]] })
    expect(describeSnapshotChange(two, relsSwapped)).toBe('Reordered relations of Order')
  })
  it('still reports an edit when a row changed, not just moved', () => {
    const order = two.entities[0]
    const edited = makeSnapshot({ ...two, entities: [{ ...order, fields: [order.fields[1], { ...order.fields[0], name: 'key' }] }, two.entities[1]] })
    expect(describeSnapshotChange(two, edited)).toBe('Edited Order')
  })
})

describe('snapshotChangeKey', () => {
  const two: FullstackSnapshot = makeSnapshot({
    ...snapshot,
    entities: [
      { name: 'Order', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'total', type: 'BIG_DECIMAL' }],
        relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }] },
      { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }] },
    ],
  })
  const withEntities = (entities: FullstackSnapshot['entities']) => makeSnapshot({ ...two, entities })

  it('addresses the row that changed so unrelated edits get different keys', () => {
    const order = two.entities[0]
    const totalRequired = withEntities([{ ...order, fields: [order.fields[0], { ...order.fields[1], required: true }] }, two.entities[1]])
    const idUnique = withEntities([{ ...order, fields: [{ ...order.fields[0], unique: true }, order.fields[1]] }, two.entities[1]])
    expect(snapshotChangeKey(two, totalRequired)).toBe('e0.f1')
    expect(snapshotChangeKey(two, idUnique)).toBe('e0.f0')
    expect(snapshotChangeKey(two, withEntities([{ ...order, readOnly: true }, two.entities[1]]))).toBe('e0')
    expect(snapshotChangeKey(two, withEntities([{ ...order, relations: [{ ...order.relations![0], required: true }] }, two.entities[1]]))).toBe('e0.r0')
    expect(snapshotChangeKey(two, withEntities([{ ...order, fields: [order.fields[0]] }, two.entities[1]]))).toBe('e0.fields')
    expect(snapshotChangeKey(two, withEntities([two.entities[1], order]))).toBe('entities')
    expect(snapshotChangeKey(two, withEntities([order]))).toBe('entities')
  })

  it('names the project-level thing that changed', () => {
    expect(snapshotChangeKey(two, { ...two, meta: { ...two.meta, locale: 'he' } })).toBe('meta.locale')
    expect(snapshotChangeKey(two, { ...two, selectedDeps: [] })).toBe('deps')
    expect(snapshotChangeKey(two, { ...two, scaffoldOpts: [] })).toBe('opts')
    expect(snapshotChangeKey(two, { ...two, frontendSet: 'x' })).toBe('sets')
    expect(snapshotChangeKey(two, { ...two, colorPalette: 'y' })).toBe('palette')
    expect(snapshotChangeKey(two, makeSnapshot(two))).toBe('none')
  })
})

describe('snapshot page layout', () => {
  const pages = [{ id: 'home', type: 'dashboard' as const, widgets: [{ kind: 'kpi' as const, entity: 'Order' }] }]

  it('carries a layout, and leaves the key out when there is none so older snapshots still compare equal', () => {
    expect(makeSnapshot({ ...snapshot, pages }).pages).toEqual(pages)
    expect('pages' in makeSnapshot({ ...snapshot, pages: [] })).toBe(false)
    expect(makeSnapshot({ ...snapshot, pages: [] })).toEqual(makeSnapshot(snapshot))
  })

  it('round-trips through export and rejects a non-array layout', () => {
    const result = parseExportedModel(JSON.stringify(toExportedModel({ ...snapshot, pages })))
    expect('snapshot' in result && result.snapshot.pages).toEqual(pages)
    expect(isSnapshot({ ...makeSnapshot(snapshot), pages: {} })).toBe(false)
  })

  it('names a layout change in the undo history', () => {
    const next = makeSnapshot({ ...snapshot, pages })
    expect(describeSnapshotChange(makeSnapshot(snapshot), next)).toBe('Started a page layout')
    expect(snapshotChangeKey(makeSnapshot(snapshot), next)).toBe('pages')
  })
})
