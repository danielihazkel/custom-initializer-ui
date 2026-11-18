import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PresetPicker } from './PresetPicker'
import type { ProjectSnapshot, TeamPresetSummary } from '../types'

const snapshot: ProjectSnapshot = {
  form: { groupId: 'com.menora', artifactId: 'shop' } as ProjectSnapshot['form'],
  selected: ['web', 'data-jpa'],
  selectedOptions: {},
  sqlByDep: { 'data-jpa': { sql: 'CREATE TABLE t (id INT);' } as never },
  openApiByDep: {},
  soapByDep: {},
  multiModuleEnabled: true,
  selectedModules: ['api'],
}

const summary: TeamPresetSummary = {
  id: 7, name: 'Orders service', description: null, coordinates: 'com.menora:orders',
  dependencyCount: 2, moduleCount: 1, createdBy: 'dana',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
}

let calls: { url: string; init?: RequestInit }[]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

beforeEach(() => {
  calls = []
  // What the server holds: one preset, and whatever the test saves.
  const stored: TeamPresetSummary[] = [summary]
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    if (url === '/metadata/backend/presets' && (!init || !init.method || init.method === 'GET')) return json(stored)
    if (url === '/metadata/backend/presets/7' && init?.method === 'DELETE') return new Response(null, { status: 204 })
    if (url === '/metadata/backend/presets/7') return json({ ...summary, snapshot })
    if (url === '/metadata/backend/presets' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { name: string }
      if (body.name === 'Taken') return json({ error: 'Name already in use', detail: "A team preset named 'Taken' already exists" }, 409)
      const saved = { ...summary, id: 8, name: body.name }
      stored.unshift(saved)
      return json(saved, 201)
    }
    return json({}, 404)
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderPicker(onLoad = vi.fn(), onSave = vi.fn()) {
  render(
    <PresetPicker presets={[]} recents={[]} currentSnapshot={snapshot} onLoad={onLoad} onSave={onSave}
      onDeletePreset={vi.fn()} onDeleteRecent={vi.fn()} />,
  )
  return { onLoad, onSave }
}

describe('PresetPicker — team presets', () => {
  it('lists the team presets and loads one by its snapshot', async () => {
    const { onLoad } = renderPicker()
    fireEvent.click(await screen.findByRole('tab', { name: /Team/ }))
    expect(await screen.findByText('com.menora:orders')).toBeTruthy()
    expect(screen.getByText('by dana')).toBeTruthy()

    fireEvent.click(screen.getByText('Orders service'))
    await waitFor(() => expect(onLoad).toHaveBeenCalledWith(snapshot))
  })

  it('saves for the team on the server, and says when the name is taken', async () => {
    const { onSave } = renderPicker()
    await screen.findByRole('tab', { name: /Team/ })
    fireEvent.click(screen.getByText('Save current as preset…'))
    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Taken' } })
    fireEvent.click(screen.getByLabelText('For the team'))
    fireEvent.click(screen.getByText('Save'))
    expect((await screen.findByRole('alert')).textContent).toContain("'Taken' already exists")

    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Shop baseline' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(screen.getByText('Shop baseline')).toBeTruthy())
    const post = calls.find(c => c.init?.method === 'POST' && JSON.parse(String(c.init.body)).name === 'Shop baseline')
    // The whole setup goes to the server, wizard documents and modules included.
    expect(JSON.parse(String(post?.init?.body)).snapshot).toEqual(snapshot)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('asks before deleting a team preset for everyone', async () => {
    renderPicker()
    fireEvent.click(await screen.findByRole('tab', { name: /Team/ }))
    fireEvent.click(await screen.findByLabelText('Delete Orders service'))
    expect(screen.getByText('It is gone for the whole team.')).toBeTruthy()
    fireEvent.click(screen.getByText('Keep'))
    expect(calls.some(c => c.init?.method === 'DELETE')).toBe(false)

    fireEvent.click(screen.getByLabelText('Delete Orders service'))
    fireEvent.click(screen.getByText('Delete'))
    await waitFor(() => expect(screen.queryByText('Orders service')).toBeNull())
    expect(calls.some(c => c.url === '/metadata/backend/presets/7' && c.init?.method === 'DELETE')).toBe(true)
  })
})
