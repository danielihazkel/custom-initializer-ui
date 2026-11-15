import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildProjectRequest, triggerDownload, wizardDepIds } from './projectUtils'
import { curlFor } from './curl'
import type { ProjectFormValues, SqlByDep } from '../types'

const form: ProjectFormValues = {
  groupId: 'com.menora',
  artifactId: 'demo',
  name: 'demo',
  description: 'Demo project',
  packageName: 'com.menora.demo',
  bootVersion: '3.2.1',
  language: 'java',
  type: 'maven-project',
  packaging: 'jar',
  javaVersion: '21',
  department: '',
}

const sql: SqlByDep = {
  postgresql: { sql: "CREATE TABLE it's (id BIGINT);", subPackage: 'entity', tables: [{ name: 'its', generateRepository: true }] },
}

const query = (url: string) => new URL(url, 'http://localhost').searchParams

describe('buildProjectRequest', () => {
  it('is a GET to /starter.<target> with the form, the dependencies and their options', () => {
    const zip = buildProjectRequest('zip', form, ['web', 'kafka'], { kafka: ['consumer-example'], redis: ['x'] })
    expect(zip.kind).toBe('plain')
    expect(zip.url.startsWith('/starter.zip?')).toBe(true)
    expect(zip.init).toEqual({})
    expect(query(zip.url).get('dependencies')).toBe('web,kafka')
    expect(query(zip.url).get('opts-kafka')).toBe('consumer-example')
    // An option of a dependency that is not selected is not sent.
    expect(query(zip.url).has('opts-redis')).toBe(false)
    expect(query(zip.url).has('department')).toBe(false)

    const preview = buildProjectRequest('preview', form, ['web', 'kafka'], { kafka: ['consumer-example'] })
    expect(preview.url).toBe(zip.url.replace('/starter.zip', '/starter.preview'))
  })

  it('goes to the multi-module endpoint only when modules are ticked', () => {
    const on = buildProjectRequest('zip', form, ['web'], {}, { enabled: true, modules: ['api', 'core'] })
    expect(on.kind).toBe('multimodule')
    expect(on.url.startsWith('/starter-multimodule.zip?')).toBe(true)
    expect(query(on.url).get('modules')).toBe('api,core')
    expect(buildProjectRequest('zip', form, ['web'], {}, { enabled: true, modules: [] }).kind).toBe('plain')
  })

  it('is one POST to the wizard endpoint when a selected dependency carries a wizard payload', () => {
    const req = buildProjectRequest('preview', form, ['postgresql'], {}, undefined, sql)
    expect(req.kind).toBe('wizard')
    expect(req.url).toBe('/starter-wizard.preview')
    expect(req.init.method).toBe('POST')
    expect(JSON.parse(req.init.body as string).sqlByDep).toEqual({ postgresql: sql.postgresql.sql })

    // The payload of a dependency that was deselected does not count.
    expect(buildProjectRequest('zip', form, ['web'], {}, undefined, sql).kind).toBe('plain')
  })

  it('a wizard wins over ticked modules, and wizardDepIds names what made it so', () => {
    // The wizard endpoint writes one module: the ticked ones are not sent. The module
    // selector warns about it from the same list (ModuleSelector `wizardDeps`).
    const req = buildProjectRequest('zip', form, ['web', 'postgresql'], {}, { enabled: true, modules: ['api', 'core'] }, sql)
    expect(req.kind).toBe('wizard')
    expect(JSON.parse(req.init.body as string)).not.toHaveProperty('modules')

    expect(wizardDepIds(['web', 'postgresql'], sql)).toEqual(['postgresql'])
    // In the order the dependencies are selected, each once, over all four wizards.
    expect(wizardDepIds(['kafka', 'web', 'postgresql'], sql,
      { web: { spec: 'openapi: 3.0.0' } as never }, undefined, { kafka: { spec: 'asyncapi: 3.0.0' } as never }))
      .toEqual(['kafka', 'web', 'postgresql'])
    // Not selected any more, or none set up: nothing overrides the modules.
    expect(wizardDepIds(['web'], sql)).toEqual([])
    expect(wizardDepIds(['web', 'postgresql'])).toEqual([])
  })

  it('gives the same key to the same project and another to a different one', () => {
    const a = buildProjectRequest('preview', form, ['web'], {})
    expect(buildProjectRequest('preview', { ...form }, ['web'], {}).key).toBe(a.key)
    expect(buildProjectRequest('preview', form, ['web', 'kafka'], {}).key).not.toBe(a.key)
    expect(buildProjectRequest('preview', { ...form, javaVersion: '17' }, ['web'], {}).key).not.toBe(a.key)
    const w = buildProjectRequest('preview', form, ['postgresql'], {}, undefined, sql)
    const w2 = buildProjectRequest('preview', form, ['postgresql'], {}, undefined, { postgresql: { ...sql.postgresql, sql: 'CREATE TABLE b (id INT);' } })
    expect(w2.key).not.toBe(w.key)
  })
})

describe('triggerDownload', () => {
  let clicks = 0
  beforeEach(() => {
    clicks = 0
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { clicks += 1 })
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }))
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('fetches the ZIP and hands it to the browser, for a plain project too', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob(['zip']) })
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal
    await triggerDownload(form, ['web'], {}, undefined, undefined, undefined, undefined, undefined, signal)
    expect(String(fetchMock.mock.calls[0][0]).startsWith('/starter.zip?')).toBe(true)
    expect(fetchMock.mock.calls[0][1].signal).toBe(signal)
    expect(clicks).toBe(1)
  })

  it('rejects with the server’s words instead of saving an error as a .zip', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400, json: async () => ({ error: 'Invalid request', detail: "Unknown Spring Boot version '9.9.9'" }),
    }))
    await expect(triggerDownload(form, ['web'], {})).rejects.toThrow("Invalid request: Unknown Spring Boot version '9.9.9'")
    expect(clicks).toBe(0)
  })
})

describe('curlFor', () => {
  it('writes a GET as one quoted URL', () => {
    const req = buildProjectRequest('zip', form, ['web'], {})
    expect(curlFor(req, 'http://init.menora.local', 'demo.zip')).toBe(`curl -o demo.zip 'http://init.menora.local${req.url}'`)
  })

  it('writes a wizard POST with its body, single quotes escaped for the shell', () => {
    const req = buildProjectRequest('zip', form, ['postgresql'], {}, undefined, sql)
    const curl = curlFor(req, 'http://init.menora.local', 'demo.zip')
    expect(curl.startsWith("curl -o demo.zip -X POST -H 'Content-Type: application/json' -d '")).toBe(true)
    expect(curl.endsWith(" 'http://init.menora.local/starter-wizard.zip'")).toBe(true)
    // it's → it'\''s
    expect(curl).toContain("it'\\''s")
  })
})
