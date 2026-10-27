import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { TeamTemplateError, useTeamTemplates } from './useTeamTemplates'
import type { TeamTemplate } from '../types'

const page: TeamTemplate = {
  id: 3, kind: 'page', name: 'Open queue', description: null, createdBy: 'dana',
  createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z',
  content: { id: 'queue', type: 'entity-list', entity: 'Ticket' },
}

function response(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(response(200, [page, { id: 9, kind: 'layout', name: 'x', content: {} }]))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('useTeamTemplates', () => {
  it('lists the team templates on mount, skipping anything malformed', async () => {
    const { result } = renderHook(() => useTeamTemplates())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.templates).toEqual([page])
    expect(fetchMock.mock.calls[0][0]).toBe('/metadata/fullstack/templates')
    expect(result.current.find('page', ' OPEN QUEUE ')).toBe(page)
    expect(result.current.find('widget', 'Open queue')).toBeUndefined()
  })

  it('shares a new template with POST, and one of a taken name with PUT under the team’s spelling', async () => {
    const { result } = renderHook(() => useTeamTemplates())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const widget: TeamTemplate = { ...page, id: 4, kind: 'widget', name: 'Open count', content: { kind: 'kpi', entity: 'Ticket' } }
    fetchMock.mockResolvedValueOnce(response(201, widget))
    let shared: Awaited<ReturnType<typeof result.current.share>> | undefined
    await act(async () => { shared = await result.current.share({ kind: 'widget', name: 'Open count', content: widget.content }) })
    expect(shared).toEqual({ template: widget, replaced: false })
    let [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect([url, init.method]).toEqual(['/metadata/fullstack/templates', 'POST'])
    expect(JSON.parse(init.body as string)).toEqual({ kind: 'widget', name: 'Open count', content: { kind: 'kpi', entity: 'Ticket' } })

    fetchMock.mockResolvedValueOnce(response(200, { ...page, updatedAt: '2026-10-02T10:00:00Z' }))
    await act(async () => { shared = await result.current.share({ kind: 'page', name: 'open queue', content: page.content }) })
    ;[url, init] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect([url, init.method]).toEqual(['/metadata/fullstack/templates/3', 'PUT'])
    expect(JSON.parse(init.body as string).name).toBe('Open queue')
    expect(shared?.replaced).toBe(true)
    expect(result.current.templates.map(t => t.id)).toEqual([3, 4])
  })

  it('surfaces a failure with its status, and removes a template on delete', async () => {
    const { result } = renderHook(() => useTeamTemplates())
    await waitFor(() => expect(result.current.loading).toBe(false))
    fetchMock.mockResolvedValueOnce(response(400, { error: 'Invalid team template', detail: 'content.kind is required for a widget template' }))
    const err = await result.current.share({ kind: 'widget', name: 'x', content: { kind: 'kpi', entity: 'T' } }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TeamTemplateError)
    expect(err).toMatchObject({ status: 400, message: expect.stringContaining('content.kind') })

    fetchMock.mockResolvedValueOnce({ ok: true, status: 204 } as Response)
    await act(async () => { await result.current.remove(3) })
    expect(fetchMock.mock.calls[fetchMock.mock.calls.length - 1]).toEqual(['/metadata/fullstack/templates/3', { method: 'DELETE' }])
    expect(result.current.templates).toEqual([])
  })

  it('reports a failed listing', async () => {
    fetchMock.mockResolvedValue(response(500, { error: 'boom' }))
    const { result } = renderHook(() => useTeamTemplates())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('boom')
  })
})
