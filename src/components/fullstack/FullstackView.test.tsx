import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FullstackView } from './FullstackView'
import { encodeShare } from './shareLink'
import { DEFAULT_PROJECT_META, makeSnapshot, type FullstackSnapshot } from './snapshot'
import type { FullstackEntityDef } from '../../types'

// The presets strip animates its save prompt; the view under test only needs it to render.
vi.mock('framer-motion', () => ({
  motion: { div: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    blob: async () => new Blob(['zip']),
  } as unknown as Response
}

const pk: FullstackEntityDef['fields'][number] = { name: 'id', type: 'LONG', primaryKey: true, generated: true }
const draftEntities: FullstackEntityDef[] = [{ name: 'Invoice', fields: [pk, { name: 'number', type: 'STRING', required: true }] }]
const linkModel: FullstackSnapshot = makeSnapshot({
  meta: { ...DEFAULT_PROJECT_META, artifactId: 'shared-shop' },
  entities: [{ name: 'Shipment', fields: [pk, { name: 'ref', type: 'STRING' }] }],
  selectedDeps: ['web'], scaffoldOpts: [], backendSet: 'spring-jpa-crud', frontendSet: 'react-tailwind-crud',
})

/** Stores an edited (unsaved) draft the way the view persists it. */
function storeDraft(entities: FullstackEntityDef[]) {
  localStorage.setItem('fullstack:meta', JSON.stringify(DEFAULT_PROJECT_META))
  localStorage.setItem('fullstack:entities', JSON.stringify(entities))
  localStorage.setItem('fullstack:deps', JSON.stringify(['web']))
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  fetchMock = vi.fn((url: string) => Promise.resolve(response(404, { error: `no ${url}` })))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

const entityNames = () => screen.getAllByLabelText('Entity name').map(i => (i as HTMLInputElement).value)

describe('FullstackView — share link over a draft', () => {
  it('opens the link straight away when the draft is the stock model', () => {
    window.history.replaceState({}, '', `/?fs=${encodeShare(linkModel)}`)
    render(<FullstackView />)
    expect(entityNames()).toEqual(['Shipment'])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps an unsaved draft and asks before replacing it', () => {
    storeDraft(draftEntities)
    window.history.replaceState({}, '', `/?fs=${encodeShare(linkModel)}`)
    render(<FullstackView />)
    expect(entityNames()).toEqual(['Invoice'])
    const dialog = screen.getByRole('dialog', { name: 'Open the shared model?' })
    expect(dialog.textContent).toContain('shared-shop')
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(entityNames()).toEqual(['Invoice'])
    expect(new URLSearchParams(window.location.search).get('fs')).toBeNull()
  })

  it('replaces the draft on confirm, undoably', () => {
    storeDraft(draftEntities)
    window.history.replaceState({}, '', `/?fs=${encodeShare(linkModel)}`)
    render(<FullstackView />)
    fireEvent.click(screen.getByRole('button', { name: 'Replace my draft' }))
    expect(entityNames()).toEqual(['Shipment'])
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(entityNames()).toEqual(['Invoice'])
  })

  it('does not ask when the draft is already a preset', () => {
    storeDraft(draftEntities)
    const stored = makeSnapshot({ meta: DEFAULT_PROJECT_META, entities: draftEntities, selectedDeps: ['web'], scaffoldOpts: [], backendSet: 'spring-jpa-crud', frontendSet: 'react-tailwind-crud' })
    localStorage.setItem('fullstackProjectPresets', JSON.stringify([{ id: 'p1', name: 'Billing', createdAt: 1, snapshot: stored }]))
    window.history.replaceState({}, '', `/?fs=${encodeShare(linkModel)}`)
    render(<FullstackView />)
    expect(entityNames()).toEqual(['Shipment'])
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('FullstackView — generate and shortcuts', () => {
  it('shows the Next steps card after a successful download and flags it once the model changes', async () => {
    storeDraft(draftEntities)
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      Promise.resolve(url === '/starter-fullstack.zip' && init?.method === 'POST' ? response(200, {}) : response(404, {})))
    render(<FullstackView />)
    fireEvent.click(screen.getByRole('button', { name: 'Generate Fullstack ZIP' }))
    const card = await screen.findByRole('region', { name: 'Next steps' })
    expect(card.textContent).toContain('demo.zip is downloaded — 1 entity')
    expect(card.textContent).toContain('/api/invoices')
    expect(card.querySelector('[data-next-steps-stale]')).toBeNull()
    fireEvent.change(screen.getByLabelText('Entity name'), { target: { value: 'Bill' } })
    expect(card.querySelector('[data-next-steps-stale]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss next steps' }))
    expect(screen.queryByRole('region', { name: 'Next steps' })).toBeNull()
  })

  it('shows no card when the download fails', async () => {
    storeDraft(draftEntities)
    fetchMock.mockImplementation(() => Promise.resolve(response(500, { detail: 'boom' })))
    render(<FullstackView />)
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/starter-fullstack.zip', expect.objectContaining({ method: 'POST' })))
    await screen.findByText(/Generation failed: boom/)
    expect(screen.queryByRole('region', { name: 'Next steps' })).toBeNull()
  })

  it('opens the save prompt on Ctrl+S even while typing, and the cheat sheet on ?', () => {
    storeDraft(draftEntities)
    render(<FullstackView />)
    const nameInput = screen.getByLabelText('Entity name')
    nameInput.focus()
    const save = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })
    act(() => { nameInput.dispatchEvent(save) })
    expect(save.defaultPrevented).toBe(true)
    expect(screen.getByLabelText('Preset name')).toBeTruthy()

    // `?` inside a field types a question mark; outside it opens the list.
    fireEvent.keyDown(nameInput, { key: '?' })
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull()
    fireEvent.keyDown(document.body, { key: '?' })
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull()
  })
})
