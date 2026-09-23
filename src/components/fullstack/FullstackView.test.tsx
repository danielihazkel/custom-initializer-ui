import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { FullstackView } from './FullstackView'
import { encodeShare } from './shareLink'
import { DEFAULT_PROJECT_META, makeSnapshot, type FullstackSnapshot } from './snapshot'
import type { ExampleModel, FullstackEntityDef } from '../../types'
import { invalidateFullstackExamples } from '../../hooks/useFullstackExamples'

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

/**
 * The view portals Explore/Generate/Cancel into `#header-frontend-actions` and Reset into
 * `#header-frontend-reset` — slots App.tsx renders in the global header. A standalone render has
 * no header, so the harness provides them; without these the action buttons simply never mount.
 */
function mountHeaderSlots() {
  for (const id of ['header-frontend-actions', 'header-frontend-reset']) {
    const slot = document.createElement('div')
    slot.id = id
    document.body.appendChild(slot)
  }
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  mountHeaderSlots()
  fetchMock = vi.fn((url: string) => Promise.resolve(response(404, { error: `no ${url}` })))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
  for (const id of ['header-frontend-actions', 'header-frontend-reset']) document.getElementById(id)?.remove()
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

describe('FullstackView — collapsible Setup panel', () => {
  it('starts collapsed when a draft already exists, and expands on demand', () => {
    storeDraft(draftEntities)
    render(<FullstackView />)
    // Collapsed: the chip bar stands in for the fields.
    expect(screen.queryByLabelText('Group ID')).toBeNull()
    expect(document.querySelector('[data-setup-chip="coords"]')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Edit project setup' }))
    expect(screen.getByLabelText('Group ID')).toBeTruthy()
  })

  it('starts expanded on a first-ever visit, when there is no model to work on yet', () => {
    render(<FullstackView />)
    expect(screen.getByLabelText('Group ID')).toBeTruthy()
  })

  it('remembers the collapsed/expanded choice across a remount', () => {
    storeDraft(draftEntities)
    const first = render(<FullstackView />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit project setup' }))
    expect(localStorage.getItem('fullstack:setup')).toBe('open')
    first.unmount()

    render(<FullstackView />)
    expect(screen.getByLabelText('Group ID')).toBeTruthy()
  })

  it('a chip reopens the panel at its section', () => {
    storeDraft(draftEntities)
    render(<FullstackView />)
    fireEvent.click(document.querySelector('[data-setup-chip="deps"]') as HTMLElement)
    expect(document.getElementById('fs-deps')).toBeTruthy()
  })

  it('holds itself open while a metadata error would otherwise hide inside it', () => {
    storeDraft(draftEntities)
    render(<FullstackView />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit project setup' }))
    fireEvent.change(screen.getByLabelText('Group ID'), { target: { value: '' } })

    // The collapse control is disabled, so the invalid field cannot be hidden.
    const toggle = screen.getByRole('button', { name: 'Hide project setup' }) as HTMLButtonElement
    expect(toggle.disabled).toBe(true)
    fireEvent.click(toggle)
    expect(screen.getByLabelText('Group ID')).toBeTruthy()
  })
})

describe('FullstackView — editor safety nets', () => {
  const four: FullstackEntityDef[] = ['Invoice', 'Customer', 'Product', 'Shipment']
    .map(name => ({ name, fields: [pk, { name: 'label', type: 'STRING' as const }] }))

  it('keeps the storage-full notice while the entity list is unsaved, even after a smaller key saves', () => {
    storeDraft(draftEntities)
    const real = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'fullstack:entities') throw new Error('QuotaExceededError')
      real.call(this, key, value)
    })
    render(<FullstackView />)
    expect(document.querySelector('[data-storage-full]')).toBeTruthy()
    // Group ID lives in the Setup panel, which is collapsed once a draft exists.
    fireEvent.click(screen.getByRole('button', { name: 'Edit project setup' }))
    fireEvent.change(screen.getByLabelText('Group ID'), { target: { value: 'com.other' } })
    expect(document.querySelector('[data-storage-full]')).toBeTruthy()
  })

  it('adding an entity while the outline filter hides it clears the filter and shows the card', () => {
    storeDraft(four)
    render(<FullstackView />)
    const filter = screen.getByLabelText('Find entity') as HTMLInputElement
    fireEvent.change(filter, { target: { value: 'ship' } })
    expect(entityNames()).toEqual(['Shipment'])
    fireEvent.click(screen.getByRole('button', { name: '+ Add entity' }))
    expect(filter.value).toBe('')
    expect(entityNames()).toEqual(['Invoice', 'Customer', 'Product', 'Shipment', ''])
  })

  it('"issues to fix" reveals an errored card the filter was hiding', () => {
    storeDraft([{ ...four[0], name: 'class' }, ...four.slice(1)])
    render(<FullstackView />)
    fireEvent.change(screen.getByLabelText('Find entity'), { target: { value: 'ship' } })
    expect(entityNames()).toEqual(['Shipment'])
    fireEvent.click(screen.getByRole('button', { name: /issue.* to fix before generating/ }))
    expect(entityNames()[0]).toBe('class')
    expect(screen.getAllByLabelText('Entity name')[0].getAttribute('aria-invalid')).toBe('true')
  })

  it('undo keeps the other cards collapsed', () => {
    storeDraft(four.slice(0, 2))
    render(<FullstackView />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Collapse entity' })[1])
    expect(screen.getAllByRole('button', { name: 'Expand entity' })).toHaveLength(1)
    fireEvent.change(screen.getAllByLabelText('Entity name')[0], { target: { value: 'Bill' } })
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(entityNames()).toEqual(['Invoice', 'Customer'])
    expect(screen.getAllByRole('button', { name: 'Expand entity' })).toHaveLength(1)
  })

  it('offers the other tab\'s draft instead of overwriting silently', () => {
    storeDraft(draftEntities)
    render(<FullstackView />)
    const theirs = [{ name: 'Ledger', fields: [pk] }]
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'fullstack:entities', newValue: JSON.stringify(theirs) }))
    })
    const banner = document.querySelector('[data-external-draft]')
    expect(banner?.textContent).toContain('changed in another browser tab')
    fireEvent.click(screen.getByRole('button', { name: 'Load theirs' }))
    expect(entityNames()).toEqual(['Ledger'])
    expect(document.querySelector('[data-external-draft]')).toBeNull()
  })
})

describe('FullstackView — page layouts', () => {
  const example: ExampleModel = {
    id: 'desk', name: 'Desk', description: 'A support desk', icon: 'support_agent',
    entities: [{ name: 'Ticket', fields: [pk, { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'DONE'] }] }],
    pages: [
      { id: 'home', type: 'dashboard', title: 'Home', widgets: [{ kind: 'kpi', entity: 'Ticket' }, { kind: 'bar', entity: 'Ticket' }] },
      { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ title: 'Open', page: 'open' }, { page: 'all' }] },
      { id: 'open', type: 'entity-list', entity: 'Ticket', hidden: true, presetFilter: { status: 'OPEN' } },
      { id: 'all', type: 'entity-list', entity: 'Ticket', hidden: true },
    ],
    settings: { scaffold: ['csvExport'], dashboardTitle: 'Support' },
  }

  function mockServer() {
    invalidateFullstackExamples()
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/metadata/fullstack/examples') return Promise.resolve(response(200, [example]))
      if (url === '/starter-fullstack.zip' && init?.method === 'POST') return Promise.resolve(response(200, {}))
      return Promise.resolve(response(404, {}))
    })
  }

  async function loadDesk() {
    fireEvent.click(await screen.findByTitle('Replace the current entities with the Desk example'))
    const confirm = screen.queryByRole('button', { name: 'Load' })
    if (confirm) fireEvent.click(confirm)
    return screen.findByRole('region', { name: 'Frontend page layout' })
  }

  it('loads an example with its layout and settings, and sends both on Generate', async () => {
    mockServer()
    render(<FullstackView />)
    // No layout yet: the editor offers to seed one instead of listing pages.
    expect(document.querySelector('[data-seed-layout]')).toBeTruthy()
    const panel = await loadDesk()

    expect(panel.querySelector('[data-page-id="home"]')?.textContent).toContain('1 tile · 1 breakdown chart')
    expect(panel.querySelector('[data-page-id="queue"]')?.textContent).toContain('Open | all')
    expect(panel.querySelector('[data-page-id="open"]')?.textContent).toContain('Tab only')
    expect(panel.querySelector('[data-page-id="open"]')?.textContent).toContain('filtered on status = OPEN')

    fireEvent.click(screen.getByRole('button', { name: 'Generate Fullstack ZIP' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/starter-fullstack.zip', expect.objectContaining({ method: 'POST' })))
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/starter-fullstack.zip' && (init as RequestInit | undefined)?.method === 'POST')!
    const body = JSON.parse((post[1] as RequestInit).body as string)
    expect(body.pages.map((p: { id: string }) => p.id)).toEqual(['home', 'queue', 'open', 'all'])
    expect(body.opts).toEqual({ scaffold: ['csvExport'] })
    expect(body.dashboardTitle).toBe('Support')
  })

  it('follows an entity rename into the layout, and drops the layout on request (undoably)', async () => {
    mockServer()
    render(<FullstackView />)
    const panel = await loadDesk()

    fireEvent.change(screen.getByLabelText('Entity name'), { target: { value: 'Issue' } })
    expect(panel.querySelector('[data-page-layout-problems]')).toBeNull()
    expect(panel.querySelector('[data-page-id="open"]')?.textContent).toContain('Issue list')

    fireEvent.click(screen.getByRole('button', { name: /Use classic layout/ }))
    // The layout is only dropped once the confirmation is accepted.
    expect(document.querySelector('[data-page-id="open"]')).toBeTruthy()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Use classic layout' }))
    expect(document.querySelector('[data-page-id="open"]')).toBeNull()
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    await waitFor(() => expect(document.querySelector('[data-page-id="open"]')).toBeTruthy())
  })

  it('flags a page whose entity was deleted, rather than dropping the page', async () => {
    mockServer()
    render(<FullstackView />)
    const panel = await loadDesk()

    fireEvent.click(screen.getByRole('button', { name: 'Remove entity' }))

    await waitFor(() => {
      const problems = panel.querySelector('[data-page-layout-problems]')
      expect(problems?.textContent).toContain('Page “open” lists “Ticket”, which is no longer an entity')
    })
  })

  it('starts a layout from the entities and sends it on Generate', async () => {
    mockServer()
    render(<FullstackView />)
    fireEvent.change(await screen.findByLabelText('Entity name'), { target: { value: 'Invoice' } })
    fireEvent.click(screen.getByRole('button', { name: /Start from my entities/ }))

    const panel = screen.getByRole('region', { name: 'Frontend page layout' })
    expect([...panel.querySelectorAll('[data-page-id]')].map(el => el.getAttribute('data-page-id')))
      .toEqual(['dashboard', 'invoice'])

    fireEvent.click(screen.getByRole('button', { name: 'Generate Fullstack ZIP' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/starter-fullstack.zip', expect.objectContaining({ method: 'POST' })))
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/starter-fullstack.zip' && (init as RequestInit | undefined)?.method === 'POST')!
    const body = JSON.parse((post[1] as RequestInit).body as string)
    expect(body.pages.map((p: { id: string }) => p.id)).toEqual(['dashboard', 'invoice'])
  })
})
