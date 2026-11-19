import { describe, it, expect, beforeEach } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { DEFAULT_PROJECT_META, makeSnapshot, parseExportedModel, requestFromSnapshot, toExportedModel, type FullstackSnapshot } from './snapshot'
import {
  BASELINE_KEY, appliedBaseline, countsOf, describeCounts, describeUpdateBase, readBaseline, requestKey, schemaVersionOf, sideOfPath,
  updateRequest, writeBaseline, type UpdateBaseline,
} from './updateBaseline'

const pk: FullstackEntityDef['fields'][number] = { name: 'id', type: 'LONG', primaryKey: true, generated: true }
const pages: FullstackPageDef[] = [{ id: 'posts', type: 'entity-list', entity: 'Post', idLocked: true } as FullstackPageDef]

const snapshot: FullstackSnapshot = makeSnapshot({
  meta: { ...DEFAULT_PROJECT_META, artifactId: 'press' },
  entities: [{ uid: 'u1', name: 'Post', fields: [{ ...pk, uid: 'u2' }, { uid: 'u3', name: 'title', type: 'STRING' }] }],
  selectedDeps: ['web', 'data-jpa'],
  scaffoldOpts: ['audit'],
  backendSet: 'spring-jpa-crud',
  frontendSet: 'react-tailwind-crud',
  colorPalette: 'ocean',
  pages,
  nav: { style: 'topbar' },
  dismissedWarnings: ['unreachable:posts'],
})

beforeEach(() => localStorage.clear())

describe('requestFromSnapshot', () => {
  it('is the generation request: settings, entities and layout — nothing only the editor knows', () => {
    const request = requestFromSnapshot(snapshot)
    expect(request).toMatchObject({
      artifactId: 'press',
      backendTemplateSet: 'spring-jpa-crud',
      frontendTemplateSet: 'react-tailwind-crud',
      dependencies: ['web', 'data-jpa'],
      opts: { scaffold: ['audit'] },
      colorPalette: 'ocean',
      nav: { style: 'topbar' },
    })
    expect(request.entities[0].fields.map(f => f.name)).toEqual(['id', 'title'])
    expect(JSON.stringify(request)).not.toContain('uid')
    // A locked page id and dismissed warnings are the editor's, not the generator's.
    expect(JSON.stringify(request)).not.toContain('idLocked')
    expect(JSON.stringify(request)).not.toContain('dismissedWarnings')
  })

  it('leaves out what is empty, as the server expects', () => {
    const bare = requestFromSnapshot(makeSnapshot({ ...snapshot, scaffoldOpts: [], pages: [], colorPalette: undefined }))
    expect(bare.opts).toBeUndefined()
    expect(bare.pages).toBeUndefined()
    // Navigation settings mean nothing without pages.
    expect(bare.nav).toBeUndefined()
    expect(bare.colorPalette).toBeUndefined()
  })
})

describe('a project’s model file', () => {
  it('is told from an export by its generator block, which never reaches the model', () => {
    const exported = parseExportedModel(JSON.stringify(toExportedModel(snapshot)))
    expect(exported).toMatchObject({ fromProject: false })
    expect('templatesHash' in exported).toBe(false)

    const shipped = parseExportedModel(JSON.stringify({ ...toExportedModel(snapshot), generator: { templatesHash: 'abc123' } }))
    expect(shipped).toMatchObject({ fromProject: true, templatesHash: 'abc123' })
    expect('snapshot' in shipped && shipped.snapshot).toEqual(snapshot)
    expect(JSON.stringify('snapshot' in shipped && shipped.snapshot)).not.toContain('generator')
  })

  it('is recognised in its request form too', () => {
    const shipped = parseExportedModel(JSON.stringify({
      format: 'menora-fullstack-request/1',
      request: requestFromSnapshot(snapshot),
      generator: { templatesHash: 'def456' },
    }))
    expect(shipped).toMatchObject({ fromProject: true, templatesHash: 'def456' })
    expect('snapshot' in shipped && shipped.snapshot.entities[0].name).toBe('Post')
  })
})

describe('the update baseline', () => {
  const baseline: UpdateBaseline = { snapshot, templatesHash: 'abc123', source: 'imported', at: 1_700_000_000_000 }

  it('survives a reload', () => {
    expect(readBaseline()).toBeNull()
    expect(writeBaseline(baseline)).toBe(true)
    expect(readBaseline()).toEqual(baseline)
    writeBaseline(null)
    expect(localStorage.getItem(BASELINE_KEY)).toBeNull()
  })

  it('is ignored when what is stored is not a model', () => {
    for (const junk of ['{not json', 'null', '{"snapshot":{}}', '{"snapshot":{"meta":{},"entities":"x"}}']) {
      localStorage.setItem(BASELINE_KEY, junk)
      expect(readBaseline()).toBeNull()
    }
  })

  it('becomes the base of an update request, each side with the model for its menora-model.json', () => {
    const current = makeSnapshot({ ...snapshot, entities: [...snapshot.entities, { name: 'Tag', fields: [pk] }] })
    const request = updateRequest(baseline, current)
    expect(request.baseTemplatesHash).toBe('abc123')
    expect(request.base.entities.map(e => e.name)).toEqual(['Post'])
    expect(request.target.entities.map(e => e.name)).toEqual(['Post', 'Tag'])
    expect(request.base.editorModel).toMatchObject({ format: 'menora-fullstack-model/1', dismissedWarnings: ['unreachable:posts'] })
    expect((request.target.editorModel as FullstackSnapshot).entities).toHaveLength(2)
    // Unknown templates: the server's notes simply say nothing about them.
    expect('baseTemplatesHash' in updateRequest({ ...baseline, templatesHash: undefined }, current)).toBe(false)
  })
})

describe('an update’s answer', () => {
  it('counts what it holds from the response headers', () => {
    const headers = new Headers({ 'X-Update-Added': '3', 'X-Update-Changed': '12', 'X-Update-Deleted': '0' })
    expect(countsOf(headers)).toEqual({ added: 3, changed: 12, deleted: 0 })
    expect(describeCounts(countsOf(headers))).toBe('3 added, 12 changed')
    expect(describeCounts(countsOf(new Headers()))).toBe('nothing changed')
    expect(describeCounts({ added: 0, changed: 0, deleted: 2 })).toBe('2 removed')
  })

  it('says which model a problem is in, and where the editor would find it', () => {
    expect(sideOfPath('target.entities[1].fields[0].type')).toEqual({ side: 'target', path: 'entities[1].fields[0].type' })
    expect(sideOfPath('base.pages[2]')).toEqual({ side: 'base', path: 'pages[2]' })
    expect(sideOfPath('base')).toEqual({ side: 'base' })
    expect(sideOfPath('entities[0]')).toEqual({ side: null, path: 'entities[0]' })
    expect(sideOfPath(undefined)).toEqual({ side: null, path: undefined })
  })
})

describe('snapshots: an update starts from the files the project was generated with', () => {
  const id = 'a'.repeat(64)
  const result = 'b'.repeat(64)

  it('reads generator.snapshot from a project model file and sends it as baseSnapshot', () => {
    const file = JSON.stringify({ ...toExportedModel(snapshot), generator: { templatesHash: 'c'.repeat(64), snapshot: id } })
    const parsed = parseExportedModel(file)
    if ('error' in parsed) throw new Error(parsed.error)
    expect(parsed.snapshotId).toBe(id)
    const baseline: UpdateBaseline = { snapshot: parsed.snapshot, snapshotId: parsed.snapshotId, source: 'imported', at: 1 }
    expect(updateRequest(baseline, snapshot)).toMatchObject({ baseSnapshot: id })
    // Anything that is not an id the server writes is not sent.
    const odd = parseExportedModel(JSON.stringify({ ...toExportedModel(snapshot), generator: { snapshot: '../x' } }))
    if ('error' in odd) throw new Error(odd.error)
    expect(odd.snapshotId).toBeUndefined()
  })

  it('keeps the id and a pending update across a reload', () => {
    writeBaseline({ snapshot, snapshotId: id, pendingUpdate: { snapshotId: result, request: requestKey(snapshot) }, source: 'generated', at: 5 })
    const back = readBaseline()!
    expect(back.snapshotId).toBe(id)
    expect(back.pendingUpdate).toEqual({ snapshotId: result, request: requestKey(snapshot) })
    localStorage.setItem(BASELINE_KEY, JSON.stringify({ snapshot, snapshotId: 'nope', source: 'generated', at: 1 }))
    expect(readBaseline()!.snapshotId).toBeUndefined()
  })

  it('marks an update applied with its result only for the model it was made for', () => {
    const baseline: UpdateBaseline = {
      snapshot, snapshotId: id, pendingUpdate: { snapshotId: result, request: requestKey(snapshot) }, source: 'generated', at: 1,
    }
    expect(appliedBaseline(baseline, snapshot).snapshotId).toBe(result)
    const edited = makeSnapshot({ ...snapshot, meta: { ...snapshot.meta, description: 'edited since' } })
    const applied = appliedBaseline(baseline, edited)
    expect(applied.snapshotId).toBeUndefined()
    expect(applied.pendingUpdate).toBeUndefined()
    expect(applied.snapshot).toBe(edited)
  })

  it('carries the schema version a project has into its update, and the result version once applied', () => {
    const file = JSON.stringify({ ...toExportedModel(snapshot), generator: { snapshot: id, schemaVersion: 3 } })
    const parsed = parseExportedModel(file)
    if ('error' in parsed) throw new Error(parsed.error)
    expect(parsed.schemaVersion).toBe(3)
    const old: UpdateBaseline = { snapshot, source: 'imported', at: 1, schemaVersion: 1,
      pendingUpdate: { snapshotId: result, request: requestKey(snapshot), schemaVersion: 3 } }
    expect(updateRequest(old, snapshot)).toMatchObject({ baseSchemaVersion: 1 })
    // A model file from before versions: nothing sent, the server reads it as unknown.
    expect(updateRequest({ snapshot, source: 'imported', at: 1 }, snapshot)).not.toHaveProperty('baseSchemaVersion')
    expect(appliedBaseline(old, snapshot).schemaVersion).toBe(3)
    expect(schemaVersionOf('3')).toBe(3)
    expect(schemaVersionOf('x')).toBeUndefined()
    expect(schemaVersionOf(0)).toBeUndefined()
  })

  it('says when an update started from the kept files', () => {
    expect(describeUpdateBase(new Headers({ 'X-Update-Base': 'snapshot' }))).toContain('generator’s fixes')
    expect(describeUpdateBase(new Headers({ 'X-Update-Base': 'regenerated' }))).toBe('')
  })
})
