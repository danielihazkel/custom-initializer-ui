import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useProjectPreview } from './useProjectPreview'
import type { ProjectFormValues } from '../types'

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
}

function okJson(value: unknown): Response {
  return { ok: true, status: 200, json: async () => value } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(okJson({ tree: [] }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useProjectPreview.fetchPreview', () => {
  it('builds a GET /starter.preview URL with form params, dependencies and opts', async () => {
    const { result } = renderHook(() => useProjectPreview())
    await act(async () => {
      await result.current.fetchPreview(form, ['web', 'kafka'], { kafka: ['consumer-example'] })
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.pathname).toBe('/starter.preview')
    expect(url.searchParams.get('type')).toBe('maven-project')
    expect(url.searchParams.get('bootVersion')).toBe('3.2.1')
    expect(url.searchParams.get('dependencies')).toBe('web,kafka')
    expect(url.searchParams.get('opts-kafka')).toBe('consumer-example')
  })

  it('targets the multimodule endpoint with a modules param when enabled', async () => {
    const { result } = renderHook(() => useProjectPreview())
    await act(async () => {
      await result.current.fetchPreview(form, [], {}, { enabled: true, modules: ['api', 'core'] })
    })

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.pathname).toBe('/starter-multimodule.preview')
    expect(url.searchParams.get('modules')).toBe('api,core')
  })

  it('POSTs to /starter-wizard.preview when a wizard payload is active', async () => {
    const { result } = renderHook(() => useProjectPreview())
    const sqlByDep = {
      'data-jpa': { sql: 'CREATE TABLE t (id INT);', subPackage: 'domain', tables: [] },
    }
    await act(async () => {
      await result.current.fetchPreview(form, ['data-jpa'], {}, undefined, sqlByDep)
    })

    expect(fetchMock.mock.calls[0][0]).toBe('/starter-wizard.preview')
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST')
  })

  it('routes a non-ok response into error via readErrorBody', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'SqlParseException', detail: 'bad sql' }),
    } as unknown as Response)

    const { result } = renderHook(() => useProjectPreview())
    await act(async () => {
      await result.current.fetchPreview(form, ['web'], {})
    })

    expect(result.current.error?.message).toBe('bad sql')
    expect(result.current.error?.kind).toBe('SqlParseException')
    expect(result.current.preview).toBeNull()
  })
})
