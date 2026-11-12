import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIVE_DEBOUNCE_MS, useLiveProjectTree } from './useLiveProjectTree'
import { clearLivePreviews, livePreviewFor, LIVE_CACHE_SIZE, rememberLivePreview } from '../utils/livePreviewCache'
import { FileDock, describeChange } from '../components/backend/FileDock'
import type { ProjectRequest } from '../utils/projectUtils'
import type { PreviewResponse, TreeNode } from '../types'

const req = (deps: string): ProjectRequest => ({ url: `/starter.preview?dependencies=${deps}`, init: {}, kind: 'plain', key: `/starter.preview?dependencies=${deps}` })

const file = (path: string): TreeNode => ({ name: path.split('/').pop()!, path, type: 'file', children: [] })
const preview = (...paths: string[]): PreviewResponse => ({ files: paths.map(path => ({ path, content: path })), tree: paths.map(file) })

let fetchMock: ReturnType<typeof vi.fn>
let visibility: 'visible' | 'hidden'

/** Lets the debounce pass and the mocked response land. */
async function settle(ms = LIVE_DEBOUNCE_MS) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

beforeEach(() => {
  vi.useFakeTimers()
  clearLivePreviews()
  visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => (String(url).includes('kafka') ? preview('pom.xml', 'KafkaConfig.java') : preview('pom.xml')),
  }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useLiveProjectTree', () => {
  it('asks nothing while the dock is closed', async () => {
    renderHook(() => useLiveProjectTree(req('web'), false))
    await settle(5000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('asks once after the last change, marked as a live preview', async () => {
    const { result, rerender } = renderHook(({ deps }) => useLiveProjectTree(req(deps), true), { initialProps: { deps: 'web' } })
    expect(result.current.loading).toBe(true)
    // Three quick changes: only the last is asked for.
    await settle(200)
    rerender({ deps: 'web,jpa' })
    await settle(200)
    rerender({ deps: 'web,kafka' })
    expect(fetchMock).not.toHaveBeenCalled()
    await settle()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/starter.preview?dependencies=web,kafka')
    expect(fetchMock.mock.calls[0][1].headers['X-Preview-Intent']).toBe('live')
    expect(result.current.loading).toBe(false)
    expect(result.current.current?.preview.files).toHaveLength(2)
    expect(result.current.previous).toBeNull()
  })

  it('answers a setup it has seen from memory, and keeps what was shown before', async () => {
    const { result, rerender } = renderHook(({ deps }) => useLiveProjectTree(req(deps), true), { initialProps: { deps: 'web' } })
    await settle()
    rerender({ deps: 'web,kafka' })
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.previous?.preview.files).toHaveLength(1)
    expect(result.current.current?.preview.files).toHaveLength(2)

    // Back to the first setup: no request, and at once.
    rerender({ deps: 'web' })
    expect(result.current.current?.key).toBe(req('web').key)
    expect(result.current.loading).toBe(false)
    await settle(5000)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // Refresh asks again whatever is remembered.
    act(() => result.current.refresh())
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('waits while the tab is hidden and catches up when it shows', async () => {
    visibility = 'hidden'
    const { rerender } = renderHook(({ deps }) => useLiveProjectTree(req(deps), true), { initialProps: { deps: 'web' } })
    rerender({ deps: 'web,kafka' })
    await settle(5000)
    expect(fetchMock).not.toHaveBeenCalled()

    visibility = 'visible'
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('kafka')
  })

  it('asks nothing for a setup that cannot generate, and reports a refusal', async () => {
    const { result, rerender } = renderHook(({ r }) => useLiveProjectTree(r, true), { initialProps: { r: null as ProjectRequest | null } })
    await settle(2000)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)

    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: 'Invalid SQL', detail: 'near "TABEL"' }) })
    rerender({ r: req('postgresql') })
    await settle()
    expect(result.current.error).toBe('Invalid SQL: near "TABEL"')
    expect(result.current.loading).toBe(false)
  })
})

describe('the live preview cache', () => {
  it('keeps the newest few', () => {
    for (let i = 0; i < LIVE_CACHE_SIZE + 2; i++) rememberLivePreview(`k${i}`, preview(`f${i}`))
    expect(livePreviewFor('k0')).toBeUndefined()
    expect(livePreviewFor('k1')).toBeUndefined()
    expect(livePreviewFor('k2')).toBeDefined()
    // Using one again makes it the newest.
    rememberLivePreview('k2', preview('f2'))
    rememberLivePreview('extra', preview('x'))
    expect(livePreviewFor('k2')).toBeDefined()
    expect(livePreviewFor('k3')).toBeUndefined()
  })
})

describe('describeChange', () => {
  const name = (id: string) => ({ kafka: 'Kafka', web: 'Spring Web' }[id] ?? id)

  it('puts a change down to the one dependency that was added or removed', () => {
    expect(describeChange(['web'], ['web', 'kafka'], { added: 4, modified: 2, removed: 0 }, name)).toBe('Kafka adds 4 files, changes 2.')
    expect(describeChange(['web', 'kafka'], ['web'], { added: 0, modified: 2, removed: 4 }, name)).toBe('Without Kafka: changes 2, drops 4.')
    expect(describeChange([], ['web'], { added: 1, modified: 0, removed: 0 }, name)).toBe('Spring Web adds 1 file.')
  })

  it('just counts when several things changed, or none of them was a dependency', () => {
    expect(describeChange([], ['web', 'kafka'], { added: 5, modified: 1, removed: 0 }, name)).toBe('5 files added, 1 changed.')
    expect(describeChange(['web'], ['web'], { added: 0, modified: 3, removed: 0 }, name)).toBe('3 changed.')
    expect(describeChange(['web'], ['web'], { added: 0, modified: 0, removed: 0 }, name)).toBe('Same files as before.')
  })
})

describe('FileDock', () => {
  const props = { onOpenChange: vi.fn(), selected: ['web'], depName: (id: string) => id, onOpenFile: vi.fn() }

  it('is a button that asks nothing while closed, and a tree once opened', async () => {
    const { rerender } = render(<FileDock {...props} open={false} request={req('web')} />)
    await settle(2000)
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Project files/ }))
    expect(props.onOpenChange).toHaveBeenCalledWith(true)

    rerender(<FileDock {...props} open request={req('web')} />)
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-file-count]')?.textContent).toBe('1')
    expect(screen.getByRole('tree')).toBeTruthy()
  })

  it('says what a dependency added, marks the new file, and opens a clicked file', async () => {
    const { rerender } = render(<FileDock {...props} open request={req('web')} />)
    await settle()
    rerender(<FileDock {...props} selected={['web', 'kafka']} depName={() => 'Kafka'} open request={req('web,kafka')} />)
    await settle()
    expect(document.querySelector('[data-dock-summary]')?.textContent).toBe('Kafka adds 1 file.')
    const added = screen.getByText('KafkaConfig.java').closest('[role="treeitem"]')!
    expect(added.className).toContain('tree-flash')

    fireEvent.click(screen.getByText('KafkaConfig.java'))
    expect(props.onOpenFile).toHaveBeenCalledWith('KafkaConfig.java', expect.objectContaining({ files: expect.any(Array) }))
  })

  it('says why there is nothing to show when the form cannot generate', async () => {
    render(<FileDock {...props} open request={null} invalidReason="Artifact is required" />)
    await settle(2000)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(document.querySelector('[data-dock-invalid]')?.textContent).toContain('Artifact is required')
  })
})
