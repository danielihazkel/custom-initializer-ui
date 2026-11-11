import { describe, it, expect, beforeEach } from 'vitest'
import type { ProjectSnapshot } from '../../types'
import { defaultForm } from '../../utils/projectUtils'
import { parseBackendModel, requestOfSnapshot, sameProject, snapshotOfRequest } from './backendModel'
import {
  backendUpdateRequest, readBackendBaseline, updateOffered, writeBackendBaseline, type BackendBaseline,
} from './backendBaseline'

function snapshot(over: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    form: { ...defaultForm(null), groupId: 'com.menora', artifactId: 'club', name: 'club', packageName: 'com.menora.club',
      bootVersion: '3.2.1', javaVersion: '21', packaging: 'jar', department: 'lts' },
    selected: ['web', 'data-jpa', 'h2', 'kafka'],
    selectedOptions: { kafka: ['consumer-example'], rqueue: ['x'] },
    sqlByDep: { h2: { sql: 'CREATE TABLE t (id INT);', subPackage: 'entity', tables: [{ name: 't', generateRepository: false }],
      apiMode: 'INLINE_DTO', generateTests: true } },
    openApiByDep: { web: { spec: 'openapi: 3.0.0', apiSubPackage: 'api', dtoSubPackage: 'dto', clientSubPackage: 'client',
      mode: 'BOTH', baseUrlProperty: 'p', clientKind: 'restClient', copySpec: true } },
    soapByDep: {},
    eventsByDep: { kafka: { spec: 'asyncapi: 3.0.0', subPackage: 'events', payloadSubPackage: 'events.model', groupId: 'billing',
      channels: [{ name: 'orders', produce: true, consume: false }], generateTests: true } },
    multiModuleEnabled: false,
    selectedModules: [],
    ...over,
  }
}

describe('backendModel', () => {
  it('reads back the request a snapshot generates', () => {
    const original = snapshot()
    const request = requestOfSnapshot(original)
    // What Generate sends: the options of a dependency that is not selected are not in it.
    expect(request.opts).toEqual({ kafka: ['consumer-example'] })
    const again = snapshotOfRequest(request)
    expect(sameProject(original, again)).toBe(true)
    expect(again.form.artifactId).toBe('club')
    expect(again.form.department).toBe('lts')
    expect(again.sqlByDep).toEqual(original.sqlByDep)
    expect(again.openApiByDep).toEqual(original.openApiByDep)
    expect(again.eventsByDep).toEqual(original.eventsByDep)
    expect(again.selectedOptions).toEqual({ kafka: ['consumer-example'] })
  })

  it('reads a model file as the generator writes it', () => {
    // The server's spelling: enum constants, every option present, wizard options resolved.
    const file = JSON.stringify({
      format: 'menora-backend-model/1',
      kind: 'backend',
      request: {
        groupId: 'com.menora', artifactId: 'petstore', name: 'petstore', packageName: 'com.menora.petstore',
        bootVersion: '3.5.16', javaVersion: '17', packaging: 'war',
        dependencies: ['web', 'validation', 'openapi', 'postgresql'],
        opts: { postgresql: ['pg-primary'] },
        sqlByDep: { postgresql: 'CREATE TABLE a (id INT);' },
        sqlOptions: { postgresql: { subPackage: 'entity', tables: [], apiMode: 'NONE', generateTests: false } },
        specByDep: { web: 'openapi: 3.0.0' },
        openApiOptions: { web: { mode: 'CLIENT', clientKind: 'REST_CLIENT', copySpec: false } },
        wsdlByDep: { 'web-services': '<wsdl/>' },
        soapOptions: { 'web-services': { mode: 'BOTH' } },
      },
      generator: { catalogHash: 'abc123' },
    })
    const parsed = parseBackendModel(file)
    if ('error' in parsed) throw new Error(parsed.error)
    expect(parsed.catalogHash).toBe('abc123')
    const s = parsed.snapshot
    expect(s.form).toMatchObject({ artifactId: 'petstore', bootVersion: '3.5.16', javaVersion: '17', packaging: 'war', department: '' })
    expect(s.selected).toEqual(['web', 'validation', 'openapi', 'postgresql'])
    expect(s.selectedOptions).toEqual({ postgresql: ['pg-primary'] })
    expect(s.sqlByDep.postgresql).toEqual({ sql: 'CREATE TABLE a (id INT);', subPackage: 'entity', tables: [], apiMode: 'NONE' })
    expect(s.openApiByDep.web).toMatchObject({ mode: 'CLIENT', clientKind: 'restClient', apiSubPackage: 'api' })
    expect(s.openApiByDep.web).not.toHaveProperty('copySpec')
    expect(s.soapByDep['web-services']).toMatchObject({ mode: 'BOTH', contextPath: '/ws' })
    expect(s).not.toHaveProperty('eventsByDep')
    expect(s.multiModuleEnabled).toBe(false)
  })

  it('reads a multi-module model, and sends its modules back', () => {
    const parsed = parseBackendModel(JSON.stringify({
      format: 'menora-backend-model/1', kind: 'multimodule',
      request: { artifactId: 'shop', dependencies: ['kafka'], modules: ['api', 'core'] },
    }))
    if ('error' in parsed) throw new Error(parsed.error)
    expect(parsed.snapshot.multiModuleEnabled).toBe(true)
    expect(parsed.snapshot.selectedModules).toEqual(['api', 'core'])
    expect(requestOfSnapshot(parsed.snapshot).modules).toEqual(['api', 'core'])
    // As on Generate: with a wizard in play the project is not multi-module.
    const withWizard = { ...parsed.snapshot, selected: ['h2'], sqlByDep: snapshot().sqlByDep }
    expect(requestOfSnapshot(withWizard)).not.toHaveProperty('modules')
  })

  it('says why a file is not a backend model', () => {
    expect(parseBackendModel('{nope')).toEqual({ error: 'The file is not JSON.' })
    expect(parseBackendModel('[]')).toEqual({ error: 'The file is not a project model.' })
    expect(parseBackendModel(JSON.stringify({ format: 'menora-fullstack-model/1', entities: [] })))
      .toEqual({ error: 'This is a fullstack project\'s model: import it on the Fullstack tab.' })
    expect(parseBackendModel(JSON.stringify({ format: 'menora-fullstack-request/1', request: {} })))
      .toMatchObject({ error: expect.stringContaining('Fullstack tab') })
    expect(parseBackendModel(JSON.stringify({ format: 'something/9', request: {} })))
      .toMatchObject({ error: expect.stringContaining('Unknown model format "something/9"') })
    expect(parseBackendModel(JSON.stringify({ hello: 1 }))).toMatchObject({ error: expect.stringContaining('names no artifact') })
    // A bare request is taken too.
    expect(parseBackendModel(JSON.stringify({ artifactId: 'x', dependencies: [] }))).toHaveProperty('snapshot')
  })
})

describe('backendBaseline', () => {
  beforeEach(() => localStorage.clear())

  it('offers an update for the same project once its model has changed', () => {
    const base: BackendBaseline = { snapshot: snapshot(), catalogHash: 'h1', source: 'imported', at: 5 }
    expect(updateOffered(null, snapshot())).toBe(false)
    expect(updateOffered(base, snapshot())).toBe(false)
    // A change that does not reach the request (options of a dependency that is not selected) is no change.
    expect(updateOffered(base, snapshot({ selectedOptions: { kafka: ['consumer-example'], other: ['y'] } }))).toBe(false)
    const changed = snapshot({ selected: ['web', 'data-jpa', 'h2', 'kafka', 'validation'] })
    expect(updateOffered(base, changed)).toBe(true)
    // Another artifact is another project.
    expect(updateOffered(base, { ...changed, form: { ...changed.form, artifactId: 'other' } })).toBe(false)

    const body = backendUpdateRequest(base, changed)
    expect(body.baseCatalogHash).toBe('h1')
    expect((body.base as { dependencies: string[] }).dependencies).toEqual(['web', 'data-jpa', 'h2', 'kafka'])
    expect((body.target as { dependencies: string[] }).dependencies).toContain('validation')
    expect(backendUpdateRequest({ ...base, catalogHash: undefined }, changed)).not.toHaveProperty('baseCatalogHash')
  })

  it('keeps the baseline across a reload and survives a corrupt one', () => {
    expect(readBackendBaseline()).toBeNull()
    const base: BackendBaseline = { snapshot: snapshot(), catalogHash: 'h1', source: 'imported', at: 5 }
    expect(writeBackendBaseline(base)).toBe(true)
    expect(readBackendBaseline()).toEqual(base)
    localStorage.setItem('backend:baseline', '{"snapshot": 4}')
    expect(readBackendBaseline()).toBeNull()
    localStorage.setItem('backend:baseline', 'not json')
    expect(readBackendBaseline()).toBeNull()
    writeBackendBaseline(null)
    expect(localStorage.getItem('backend:baseline')).toBeNull()
  })
})
