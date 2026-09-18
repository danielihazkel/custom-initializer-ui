import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ADMIN_UNAUTHORIZED_EVENT, adminFetch, AdminApiError, handle401, invalidateAdminCache, useAdminResource } from './useAdminResource'

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
  invalidateAdminCache()
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
  it('clears the stored token and announces the expiry instead of reloading the page', () => {
    sessionStorage.setItem('adminToken', 'tok-123')
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload },
    })
    const onUnauthorized = vi.fn()
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized)

    try {
      handle401({ status: 401 } as Response)
      expect(sessionStorage.getItem('adminToken')).toBeNull()
      expect(onUnauthorized).toHaveBeenCalledOnce()
      // A reload would land on the Backend tab (the Config view has no URL) and force a re-login.
      expect(reload).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized)
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
  })

  it('drops cached list promises on a 401 so the next login refetches', async () => {
    sessionStorage.setItem('adminToken', 'stale')
    fetchMock.mockResolvedValue(okJson([{ id: 1 }]))
    const { result } = renderHook(() => useAdminResource<{ id: number }>('/admin/dependency-groups'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    handle401({ status: 401 } as Response)

    sessionStorage.setItem('adminToken', 'fresh')
    const second = renderHook(() => useAdminResource<{ id: number }>('/admin/dependency-groups'))
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const headers = (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer fresh')
  })

  it('leaves the token intact on a non-401 response', () => {
    sessionStorage.setItem('adminToken', 'tok-123')
    handle401({ status: 409 } as Response)
    expect(sessionStorage.getItem('adminToken')).toBe('tok-123')
  })
})

describe('useAdminResource', () => {
  it('sends list-query params on the GET only and mutates against the bare path', async () => {
    fetchMock.mockResolvedValue(okJson([{ id: 12, pathTemplate: 'x' }]))
    const { result } = renderHook(() =>
      useAdminResource<{ id: number; pathTemplate: string }>('/admin/entity-template-files', { query: { setId: 5 } }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchMock.mock.calls[0][0]).toBe('/admin/entity-template-files?setId=5')
    expect(result.current.items).toEqual([{ id: 12, pathTemplate: 'x' }])

    await act(async () => { await result.current.update(12, { pathTemplate: 'y' }) })
    const put = fetchMock.mock.calls.find(c => (c[1] as RequestInit | undefined)?.method === 'PUT')!
    expect(put[0]).toBe('/admin/entity-template-files/12')

    await act(async () => { await result.current.remove(12) })
    const del = fetchMock.mock.calls.find(c => (c[1] as RequestInit | undefined)?.method === 'DELETE')!
    expect(del[0]).toBe('/admin/entity-template-files/12')
  })

  it('serves a second mount of the same list from the session cache', async () => {
    fetchMock.mockResolvedValue(okJson([{ id: 1 }]))
    const first = renderHook(() => useAdminResource<{ id: number }>('/admin/dependency-groups'))
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    first.unmount()

    const second = renderHook(() => useAdminResource<{ id: number }>('/admin/dependency-groups'))
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(second.result.current.items).toEqual([{ id: 1 }])
    expect(fetchMock.mock.calls.filter(c => c[0] === '/admin/dependency-groups')).toHaveLength(1)

    act(() => { second.result.current.reload() })
    await waitFor(() => expect(fetchMock.mock.calls.filter(c => c[0] === '/admin/dependency-groups')).toHaveLength(2))
  })

  it('clears a previous error when a reload succeeds', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, headers: { get: () => null }, json: async () => ({}) } as unknown as Response)
    const { result } = renderHook(() => useAdminResource<{ id: number }>('/admin/versions'))
    await waitFor(() => expect(result.current.error).toBe('HTTP 500'))

    fetchMock.mockResolvedValue(okJson([]))
    act(() => { result.current.reload() })
    await waitFor(() => expect(result.current.error).toBeNull())
  })
})
