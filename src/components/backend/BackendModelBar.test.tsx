import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useState } from 'react'
import type { ProjectSnapshot, Toast } from '../../types'
import { defaultForm } from '../../utils/projectUtils'
import { BackendModelBar } from './BackendModelBar'
import { useBackendUpdate } from './useBackendUpdate'

const start: ProjectSnapshot = {
  form: { ...defaultForm(null), artifactId: 'club', packageName: 'com.menora.club' },
  selected: ['web'],
  selectedOptions: {},
  sqlByDep: {},
  openApiByDep: {},
  soapByDep: {},
  multiModuleEnabled: false,
  selectedModules: [],
}

const MODEL = JSON.stringify({
  format: 'menora-backend-model/1',
  kind: 'backend',
  request: { artifactId: 'club', packageName: 'com.menora.club', dependencies: ['web', 'kafka'] },
  generator: { catalogHash: 'cafe' },
})

let toasts: Toast[]
const last = (): Toast | undefined => toasts[toasts.length - 1]

/** The bar over a snapshot the test can change, as App.tsx holds it. */
function Harness({ initial }: { initial: ProjectSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial)
  const update = useBackendUpdate(snapshot, setSnapshot, t => { toasts.push(t) })
  return (
    <div>
      <BackendModelBar update={update} />
      <output data-testid="deps">{snapshot.selected.join(',')}</output>
      <button onClick={() => setSnapshot(s => ({ ...s, selected: [...s.selected, 'validation'] }))}>add validation</button>
      <button onClick={() => update.rememberGenerated(snapshot)}>generated</button>
    </div>
  )
}

function importFile(text: string) {
  const input = screen.getByLabelText("A project's menora-model.json") as HTMLInputElement
  const file = new File([text], 'menora-model.json', { type: 'application/json' })
  fireEvent.change(input, { target: { files: [file] } })
}

beforeEach(() => {
  localStorage.clear()
  toasts = []
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BackendModelBar', () => {
  it('opens a project from its model file and offers an update once the model changes', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'X-Update-Added': '3', 'X-Update-Changed': '2', 'X-Update-Deleted': '0' }),
      blob: async () => new Blob(['zip']),
    }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }))
    render(<Harness initial={start} />)
    // Nothing to update yet.
    expect(screen.queryByLabelText('Update an existing project')).toBeNull()

    importFile(MODEL)
    await waitFor(() => expect(screen.getByTestId('deps').textContent).toBe('web,kafka'))
    expect(last()).toMatchObject({ type: 'success', message: expect.stringContaining('Opened club') })
    // Just opened: the model is the project's.
    expect(screen.queryByLabelText('Update an existing project')).toBeNull()

    fireEvent.click(screen.getByText('add validation'))
    const panel = await screen.findByLabelText('Update an existing project')
    expect(panel.textContent).toContain('club')
    expect(panel.textContent).toContain('imported')

    fireEvent.click(screen.getByText('Download update'))
    await waitFor(() => expect(last()?.message).toContain('Update downloaded (3 added, 2 changed)'))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }]
    expect(url).toBe('/starter.patch')
    const body = JSON.parse(init.body)
    expect(body.base.dependencies).toEqual(['web', 'kafka'])
    expect(body.target.dependencies).toEqual(['web', 'kafka', 'validation'])
    // The hash the project's own model file carried.
    expect(body.baseCatalogHash).toBe('cafe')

    // Applied: the panel goes until the model changes again.
    fireEvent.click(screen.getByText('Mark as applied'))
    await waitFor(() => expect(screen.queryByLabelText('Update an existing project')).toBeNull())
    expect(JSON.parse(localStorage.getItem('backend:baseline')!).snapshot.selected).toEqual(['web', 'kafka', 'validation'])
  })

  it('remembers a generated project, and forgets it on request', async () => {
    render(<Harness initial={start} />)
    fireEvent.click(screen.getByText('generated'))
    fireEvent.click(screen.getByText('add validation'))
    const panel = await screen.findByLabelText('Update an existing project')
    expect(panel.textContent).toContain('generated')
    fireEvent.click(screen.getByText('Forget'))
    await waitFor(() => expect(screen.queryByLabelText('Update an existing project')).toBeNull())
    expect(localStorage.getItem('backend:baseline')).toBeNull()
  })

  it('says why a file is not opened, and why an update is refused', async () => {
    render(<Harness initial={start} />)
    importFile(JSON.stringify({ format: 'menora-fullstack-model/1', entities: [] }))
    await waitFor(() => expect(last()).toMatchObject({ type: 'error', message: expect.stringContaining('Fullstack tab') }))
    // Nothing was applied.
    expect(screen.getByTestId('deps').textContent).toBe('web')

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 400,
      json: async () => ({ error: 'Invalid model', side: 'base', detail: "bootVersion: '2.7.0' is not offered" }),
    })))
    fireEvent.click(screen.getByText('generated'))
    fireEvent.click(screen.getByText('add validation'))
    fireEvent.click(await screen.findByText('Download update'))
    await waitFor(() => expect(last()?.message)
      .toBe("The model the project was generated from is no longer accepted: bootVersion: '2.7.0' is not offered"))
  })
})
