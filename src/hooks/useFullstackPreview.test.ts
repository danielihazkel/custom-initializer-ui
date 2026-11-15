import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useFullstackPreview } from './useFullstackPreview'

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('useFullstackPreview.cancel', () => {
  it('aborts the in-flight request and clears the loading state without an error', async () => {
    // A request that only settles when its signal is aborted — like a slow server.
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    }))
    const { result } = renderHook(() => useFullstackPreview())
    let pending!: Promise<void>
    act(() => { pending = result.current.fetchPreview({ entities: [] }) })
    expect(result.current.loading).toBe(true)
    act(() => result.current.cancel())
    await act(async () => { await pending })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true)
  })

  it('ignores a response that arrives after cancel', async () => {
    let resolve!: (r: Response) => void
    fetchMock.mockImplementation(() => new Promise<Response>(r => { resolve = r }))
    const { result } = renderHook(() => useFullstackPreview())
    let pending!: Promise<void>
    act(() => { pending = result.current.fetchPreview({ entities: [] }) })
    act(() => result.current.cancel())
    resolve({ ok: true, status: 200, json: async () => ({ files: [], tree: [] }) } as unknown as Response)
    await act(async () => { await pending })
    expect(result.current.preview).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})

describe('useFullstackPreview.fetchComparison', () => {
  const ok = (files: string[]) => ({ ok: true, status: 200, json: async () => ({ files: files.map(path => ({ path, content: '' })), tree: [] }) }) as unknown as Response
  const bad = (body: unknown) => ({ ok: false, status: 400, headers: { get: () => 'application/json' }, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response
  const nameOf = (init: RequestInit) => (JSON.parse(String(init.body)) as { artifactId: string }).artifactId

  it('shows the new generation with the old one as what it is compared with — in one step', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => Promise.resolve(ok([`${nameOf(init)}/README.md`])))
    const { result } = renderHook(() => useFullstackPreview())
    await act(async () => { await result.current.fetchComparison({ artifactId: 'old', entities: [] }, { artifactId: 'new', entities: [] }) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.previousPreview?.files[0].path).toBe('old/README.md')
    expect(result.current.preview?.files[0].path).toBe('new/README.md')
    expect(result.current.loading).toBe(false)
  })

  it('reports a problem in the new model with its path, and one in the old model by name', async () => {
    const rejecting = (side: string) => (_url: string, init: RequestInit) => Promise.resolve(
      nameOf(init) === side ? bad({ detail: 'Unknown field type', path: 'entities[0].fields[1]' }) : ok([]))
    const { result } = renderHook(() => useFullstackPreview())

    fetchMock.mockImplementation(rejecting('new'))
    await act(async () => { await result.current.fetchComparison({ artifactId: 'old', entities: [] }, { artifactId: 'new', entities: [] }) })
    expect(result.current.error).toMatchObject({ message: 'Unknown field type', path: 'entities[0].fields[1]' })
    expect(result.current.preview).toBeNull()

    fetchMock.mockImplementation(rejecting('old'))
    await act(async () => { await result.current.fetchComparison({ artifactId: 'old', entities: [] }, { artifactId: 'new', entities: [] }) })
    expect(result.current.error?.message).toBe('The model the project was generated from is no longer accepted: Unknown field type')
    expect(result.current.error?.path).toBeUndefined()
  })
})
