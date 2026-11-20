import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { notYours, teamHeaders } from './teamAuth'
import TeamPresetsPanel from '../components/TeamPresetsPanel'
import { useTeamModels } from '../hooks/useTeamModels'
import { saveTeamPreset } from '../hooks/useTeamPresets'
import { DEFAULT_PROJECT_META, type FullstackSnapshot } from '../components/fullstack/snapshot'
import type { TeamModelSummary, TeamPresetSummary } from '../types'

// What the team shares is changed or deleted only by whoever saved it, or by a signed-in admin.
// The server decides (`canEdit` on every row); the screens say so before the click.

const stamp = { description: null, createdAt: '2026-11-20T08:00:00Z', updatedAt: '2026-11-20T08:00:00Z' }
const mine: TeamPresetSummary = { ...stamp, id: 1, name: 'Mine', coordinates: 'com.menora:mine', dependencyCount: 1, moduleCount: 0, createdBy: 'me', canEdit: true }
const danas: TeamPresetSummary = { ...stamp, id: 2, name: 'Dana’s', coordinates: 'com.menora:danas', dependencyCount: 2, moduleCount: 0, createdBy: 'dana', canEdit: false }
// A server from before the rule says nothing: every row was everyone's.
const older: TeamPresetSummary = { ...stamp, id: 3, name: 'Older', coordinates: null, dependencyCount: 0, moduleCount: 0, createdBy: 'eli' }

const model: FullstackSnapshot = {
  meta: { ...DEFAULT_PROJECT_META, artifactId: 'shop' },
  entities: [{ name: 'Order', fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }] }],
  selectedDeps: ['web'], scaffoldOpts: [], backendSet: 'spring-jpa-crud', frontendSet: 'react-tailwind-crud',
}

let calls: { url: string; method: string; headers: Record<string, string> }[]

function json(body: unknown, status = 200) {
  return new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

beforeEach(() => {
  calls = []
  sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push({ url, method, headers: { ...(init?.headers as Record<string, string> | undefined) } })
    if (method === 'DELETE') return json(null, 204)
    if (url === '/metadata/backend/presets' && method === 'GET') return json([mine, danas, older])
    if (url === '/metadata/fullstack/models' && method === 'GET') return json([])
    if (method === 'PUT') {
      return json({ error: 'Not yours to change', detail: 'Saved by dana — only they or a signed-in admin can change or delete it' }, 403)
    }
    return json({ ...mine, id: 9 }, 201)
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

describe('team data: whose it is to change', () => {
  it('names the creator of a row that is not the caller’s, and nothing for one that is', () => {
    expect(notYours(mine)).toBeUndefined()
    expect(notYours(older)).toBeUndefined()
    expect(notYours(danas)).toBe('Saved by dana — only they or a signed-in admin can change or delete it')
    expect(notYours({ canEdit: false, createdBy: null })).toBe('Only whoever saved it or a signed-in admin can change or delete it')
  })

  it('sends the admin’s token with a team call when one is signed in on this browser', () => {
    expect(teamHeaders()).toEqual({})
    expect(teamHeaders(true)).toEqual({ 'Content-Type': 'application/json' })
    sessionStorage.setItem('adminToken', 'tok')
    expect(teamHeaders()).toEqual({ Authorization: 'Bearer tok' })
    expect(teamHeaders(true)).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' })
  })

  it('keeps Delete off a team preset somebody else saved, and says whose it is', async () => {
    render(<TeamPresetsPanel visible reloadKey={0} onLoad={vi.fn()} onCount={vi.fn()} />)
    const theirs = await screen.findByLabelText('Delete Dana’s') as HTMLButtonElement
    expect(theirs.disabled).toBe(true)
    expect(theirs.title).toBe('Saved by dana — only they or a signed-in admin can change or delete it')
    fireEvent.click(theirs)
    expect(screen.queryByText('It is gone for the whole team.')).toBeNull()

    // The caller's own, and a row of a server that does not say: deletable, after asking.
    expect((screen.getByLabelText('Delete Older') as HTMLButtonElement).disabled).toBe(false)
    const own = screen.getByLabelText('Delete Mine') as HTMLButtonElement
    expect(own.disabled).toBe(false)
    fireEvent.click(own)
    fireEvent.click(screen.getByText('Delete'))
    await waitFor(() => expect(calls.some(c => c.method === 'DELETE' && c.url === '/metadata/backend/presets/1')).toBe(true))
  })

  it('asks as the admin everywhere once one is signed in: listing, saving, changing, deleting', async () => {
    sessionStorage.setItem('adminToken', 'tok')
    const { result } = renderHook(() => useTeamModels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.save('Shop', '', model) })
    await act(async () => { await result.current.remove(4) })
    await saveTeamPreset('Shop', { form: {}, selected: [] } as never)
    render(<TeamPresetsPanel visible reloadKey={0} onLoad={vi.fn()} onCount={vi.fn()} />)
    await screen.findByLabelText('Delete Mine')

    expect(calls.length).toBeGreaterThanOrEqual(5)
    for (const call of calls) expect(call.headers.Authorization, `${call.method} ${call.url}`).toBe('Bearer tok')
  })

  it('shows the server’s words when a change is refused all the same', async () => {
    // The list was read before somebody else took the name over, or the token has expired since.
    const { result } = renderHook(() => useTeamModels())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const danasModel: TeamModelSummary = { ...stamp, id: 5, name: 'Shop', entityCount: 2, createdBy: 'dana' }
    await expect(result.current.update(danasModel.id, 'Shop', '', model))
      .rejects.toMatchObject({ status: 403, message: 'Saved by dana — only they or a signed-in admin can change or delete it' })
  })
})
