import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { adminFetch, AdminApiError, handle401 } from './useAdminResource'

function okJson(value: unknown, contentLength: string | null = null): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string) => (h === 'content-length' ? contentLength : null) },
    json: async () => value,
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  sessionStorage.clear()
  fetchMock = vi.fn().mockResolvedValue(okJson({ ok: true }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('adminFetch', () => {
  it('attaches the bearer token from sessionStorage', async () => {
    sessionStorage.setItem('adminToken', 'tok-123')
    await adminFetch('GET', '/admin/dependency-groups')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok-123')
  })

  it('throws AdminApiError carrying status and parsed body on a non-ok response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      headers: { get: () => null },
      json: async () => ({ error: 'Duplicate or constraint violation' }),
    } as unknown as Response)

    const err = await adminFetch('POST', '/admin/dependency-groups', { name: 'x' })
      .then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(AdminApiError)
    expect((err as AdminApiError).status).toBe(409)
    expect((err as AdminApiError).body).toEqual({ error: 'Duplicate or constraint violation' })
  })

  it('returns null on a 204 No Content response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: { get: () => '0' },
      json: async () => { throw new Error('no body') },
    } as unknown as Response)

    await expect(adminFetch('DELETE', '/admin/dependency-groups/1')).resolves.toBeNull()
  })
})

describe('handle401', () => {
  it('clears the stored token and reloads on a 401', () => {
    sessionStorage.setItem('adminToken', 'tok-123')
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload },
    })

    try {
      handle401({ status: 401 } as Response)
      expect(sessionStorage.getItem('adminToken')).toBeNull()
      expect(reload).toHaveBeenCalledOnce()
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
  })

  it('leaves the token intact on a non-401 response', () => {
    sessionStorage.setItem('adminToken', 'tok-123')
    handle401({ status: 409 } as Response)
    expect(sessionStorage.getItem('adminToken')).toBe('tok-123')
  })
})
