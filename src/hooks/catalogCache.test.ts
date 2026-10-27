import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchCatalog, invalidateCatalog } from './catalogCache'
import { adminFetch } from './useAdminResource'

function response(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('catalogCache', () => {
  it('fetches a list once and shares it', async () => {
    fetchMock.mockResolvedValue(response(200, ['a']))
    const [one, two] = await Promise.all([fetchCatalog('/metadata/x'), fetchCatalog('/metadata/x')])
    expect(one).toEqual(['a'])
    expect(two).toBe(one)
    await fetchCatalog('/metadata/x')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not keep a failed load', async () => {
    fetchMock.mockResolvedValueOnce(response(500, null)).mockResolvedValueOnce(response(200, ['b']))
    await expect(fetchCatalog('/metadata/y')).rejects.toThrow('HTTP 500')
    expect(await fetchCatalog('/metadata/y')).toEqual(['b'])
  })

  it('asks again after an admin write', async () => {
    fetchMock.mockResolvedValue(response(200, ['c']))
    await fetchCatalog('/metadata/z')
    await adminFetch('PUT', '/admin/starter-templates/1', { name: 'x' })
    await fetchCatalog('/metadata/z')
    expect(fetchMock.mock.calls.filter(([url]) => url === '/metadata/z')).toHaveLength(2)

    invalidateCatalog()
    await fetchCatalog('/metadata/z')
    expect(fetchMock.mock.calls.filter(([url]) => url === '/metadata/z')).toHaveLength(3)
  })
})
