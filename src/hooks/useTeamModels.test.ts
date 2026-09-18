import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { TeamModelError, useTeamModels } from './useTeamModels'
import { DEFAULT_PROJECT_META, EXPORT_FORMAT, type FullstackSnapshot } from '../components/fullstack/snapshot'
import type { TeamModelSummary } from '../types'

const summary: TeamModelSummary = {
  id: 7, name: 'Billing', description: 'Invoices and payments', entityCount: 2,
  createdBy: 'dana', createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-02T10:00:00Z',
}
const snapshot: FullstackSnapshot = {
  meta: { ...DEFAULT_PROJECT_META, artifactId: 'billing' },
  entities: [{ name: 'Invoice', fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }] }],
  selectedDeps: ['web'], scaffoldOpts: [], backendSet: 'spring-jpa-crud', frontendSet: 'react-tailwind-crud',
}

function response(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(response(200, [summary]))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('useTeamModels', () => {
  it('lists the team models on mount', async () => {
    const { result } = renderHook(() => useTeamModels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.models).toEqual([summary])
    expect(fetchMock.mock.calls[0][0]).toBe('/metadata/fullstack/models')
  })

  it('saves with the export-file shape and prepends the returned summary', async () => {
    const { result } = renderHook(() => useTeamModels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const created = { ...summary, id: 8, name: 'Shop' }
    fetchMock.mockResolvedValueOnce(response(201, created))
    await act(async () => { await result.current.save('Shop', '  ', snapshot) })
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toBe('/metadata/fullstack/models')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.name).toBe('Shop')
    expect(body.description).toBeUndefined()
    expect(body.snapshot.format).toBe(EXPORT_FORMAT)
    expect(body.snapshot.entities[0].name).toBe('Invoice')
    expect(result.current.models.map(m => m.id)).toEqual([8, 7])
  })

  it('surfaces a name clash as a TeamModelError with status 409', async () => {
    const { result } = renderHook(() => useTeamModels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    fetchMock.mockResolvedValueOnce(response(409, { error: 'Name already in use', detail: "A team model named 'Billing' already exists" }))
    const err = await result.current.save('billing', '', snapshot).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TeamModelError)
    expect(err).toMatchObject({ status: 409, message: expect.stringContaining('already exists') })
  })

  it('loads a model back as a plain snapshot, and rejects a malformed one', async () => {
    const { result } = renderHook(() => useTeamModels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    fetchMock.mockResolvedValueOnce(response(200, { ...summary, snapshot: { format: EXPORT_FORMAT, exportedAt: 'x', ...snapshot } }))
    const loaded = await result.current.load(7)
    expect(loaded).toEqual(snapshot)
    expect(loaded).not.toHaveProperty('format')
    fetchMock.mockResolvedValueOnce(response(200, { ...summary, snapshot: { entities: 'nope' } }))
    await expect(result.current.load(7)).rejects.toMatchObject({ status: 422 })
  })

  it('removes a model from the list on delete', async () => {
    const { result } = renderHook(() => useTeamModels())
    await waitFor(() => expect(result.current.models).toHaveLength(1))
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204 } as Response)
    await act(async () => { await result.current.remove(7) })
    expect(fetchMock.mock.calls[1]).toEqual(['/metadata/fullstack/models/7', { method: 'DELETE' }])
    expect(result.current.models).toEqual([])
  })

  it('reports a failed listing instead of swallowing it', async () => {
    fetchMock.mockResolvedValue(response(500, { error: 'boom' }))
    const { result } = renderHook(() => useTeamModels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('boom')
  })
})
