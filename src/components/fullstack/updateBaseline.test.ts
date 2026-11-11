import { describe, it, expect, beforeEach } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { DEFAULT_PROJECT_META, makeSnapshot, parseExportedModel, requestFromSnapshot, toExportedModel, type FullstackSnapshot } from './snapshot'
import {
  BASELINE_KEY, countsOf, describeCounts, readBaseline, sideOfPath, updateRequest, writeBaseline, type UpdateBaseline,
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
