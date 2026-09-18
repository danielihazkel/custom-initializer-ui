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
