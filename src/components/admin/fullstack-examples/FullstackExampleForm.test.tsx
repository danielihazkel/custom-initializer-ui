import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { EntityTemplateSetSummary } from '../../../types'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { FullstackExampleForm } from './FullstackExampleForm'
import type { ExampleDraft } from './FullstackExamplesTab'
// The designer is a chunk of its own; fetched here, so opening it is not a race against the
// one-second wait of `findBy`.
import './ExampleDesigner'

const entities = [{ name: 'Item', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] }]
const items = JSON.stringify([{ id: 'items', type: 'entity-list', entity: 'Item' }])

const sets: EntityTemplateSetSummary[] = [
  { setKey: 'spring-jpa-crud', name: 'Spring', description: null, kind: 'BACKEND_JAVA', defaultDeps: ['web', 'data-jpa'], designSystem: null, bootVersion: null, javaVersion: null, defaultPaletteId: null },
  { setKey: 'react-tailwind-crud', name: 'React + Tailwind', description: 'The default shell', kind: 'FRONTEND_REACT', defaultDeps: [], designSystem: null, bootVersion: null, javaVersion: null, defaultPaletteId: 'ocean' },
  { setKey: 'react-menora-digital-crud', name: 'Menora Digital', description: 'The brand shell', kind: 'FRONTEND_REACT', defaultDeps: [], designSystem: 'MENORA_DIGITAL', bootVersion: null, javaVersion: null, defaultPaletteId: 'ocean' },
]
const palettes = [
  { id: 'ocean', name: 'Ocean', primary: '#0055aa', secondary: '#ffcc00', isDefault: true, sortOrder: 0 },
  { id: 'forest', name: 'Forest', primary: '#226633', secondary: '#eedd88', isDefault: false, sortOrder: 1 },
]

function draft(patch: Partial<ExampleDraft>): ExampleDraft {
  return {
    exampleId: 'shop', name: 'Shop', description: '', icon: '', enabled: true, sortOrder: 0,
    entitiesText: JSON.stringify(entities), pagesText: '', settingsText: '', ...patch,
  } as ExampleDraft
}

function renderForm(patch: Partial<ExampleDraft>) {
  const onChange = vi.fn()
  render(<FullstackExampleForm data={draft(patch)} errors={{}} onChange={onChange} teamModels={[]} onImportTeamModel={async () => {}} />)
  return onChange
}

let latest: ExampleDraft
const onSave = vi.fn(async () => {})
const onClose = vi.fn()

/** The tab's part: it holds the draft the form edits — here also inside the tab's drawer. */
function Harness({ patch, drawer }: { patch: Partial<ExampleDraft>; drawer?: boolean }) {
  const [data, setData] = useState(() => draft(patch))
  latest = data
  const form = (
    <FullstackExampleForm data={data} errors={{}} onChange={updates => setData(prev => ({ ...prev, ...updates }))}
                          teamModels={[]} onImportTeamModel={async () => {}} />
  )
  return drawer ? <AdminFormDrawer title="Edit Example" isOpen onClose={onClose} onSave={onSave} saving={false}>{form}</AdminFormDrawer> : form
}

const settings = () => (latest.settingsText ? JSON.parse(latest.settingsText) as Record<string, unknown> : {})
const pagesOf = () => (latest.pagesText ? JSON.parse(latest.pagesText) as { id: string; title?: string }[] : [])

async function openDesigner(button: RegExp = /Open designer/) {
  fireEvent.click(screen.getByRole('button', { name: button }))
  return screen.findByRole('dialog', { name: 'Layout designer' })
}

beforeEach(() => {
  onSave.mockClear()
  onClose.mockClear()
  localStorage.clear()
  // The tour opens by itself on a first visit.
  localStorage.setItem('fullstack:designerTour', 'done')
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const body = String(url).includes('entity-template-sets') ? sets
      : String(url).includes('/frontend/metadata') ? { colorPalettes: palettes }
      : []
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => body } as unknown as Response
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('FullstackExampleForm pages', () => {
  it('starts a layout from the entities and writes it back as JSON', () => {
    const onChange = renderForm({})
    fireEvent.click(screen.getByRole('button', { name: /Start from my entities/ }))
    const written = onChange.mock.calls[onChange.mock.calls.length - 1][0].pagesText as string
    expect(JSON.parse(written).map((p: { id: string }) => p.id)).toEqual(['dashboard', 'item'])
  })

  it('shows the stored layout', () => {
    renderForm({ pagesText: items })
    expect(document.querySelector('[data-page-id="items"]')).toBeTruthy()
  })

  it('asks for the JSON editor when the entities are broken', () => {
    renderForm({ entitiesText: '[' })
    expect(document.querySelector('[data-pages-visual-unavailable]')?.textContent).toContain('not valid JSON')
    fireEvent.click(screen.getByRole('radio', { name: 'JSON' }))
    expect(screen.getByLabelText('Pages (JSON)')).toBeTruthy()
  })
})

describe('FullstackExampleForm — the layout designer', () => {
  it('opens full screen on the layout, writes an edit back as JSON, and undoes it', async () => {
    render(<Harness patch={{ pagesText: items }} />)
    const designer = await openDesigner()
    const inspector = within(designer).getByRole('complementary', { name: 'Inspector' })
    fireEvent.change(within(inspector).getByLabelText('Page title'), { target: { value: 'Stock' } })
    expect(pagesOf()[0]).toMatchObject({ title: 'Stock', id: 'stock' })
    // The designer's undo is the form's own stack.
    await waitFor(() => expect((designer.querySelector('[data-designer-undo]') as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(designer.querySelector('[data-designer-undo]')!)
    expect(latest.pagesText).toBe(items)
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true })
    expect(pagesOf()[0]).toMatchObject({ title: 'Stock' })
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(latest.pagesText).toBe(items)
  })

  it('keeps the look in the example’s settings', async () => {
    render(<Harness patch={{ pagesText: items, settingsText: JSON.stringify({ backendTemplateSet: 'spring-jpa-crud-lombok' }) }} />)
    const designer = await openDesigner(/Appearance/)
    expect(designer.querySelector('[data-designer-appearance]')).toBeTruthy()
    // A brand set brings its language and direction, as on the Fullstack tab.
    fireEvent.click(await within(designer).findByRole('radio', { name: /Menora Digital/ }))
    expect(settings()).toEqual({ backendTemplateSet: 'spring-jpa-crud-lombok', frontendTemplateSet: 'react-menora-digital-crud', locale: 'he', scaffold: ['rtl'] })
    expect((designer.querySelector('[data-layout-preview]') as HTMLElement).getAttribute('dir')).toBe('rtl')

    fireEvent.click(within(designer).getByRole('radio', { name: 'Forest' }))
    expect(settings().colorPalette).toBe('forest')
    // Back on the set's own palette is no pick at all.
    fireEvent.click(within(designer).getByRole('radio', { name: 'Ocean' }))
    expect('colorPalette' in settings()).toBe(false)

    fireEvent.click(within(designer).getByLabelText(/right-to-left/i))
    expect('scaffold' in settings()).toBe(false)
    fireEvent.click(within(designer).getByRole('radio', { name: 'English' }))
    expect(settings().locale).toBe('en')
  })

  it('keeps the navigation in the settings too', async () => {
    render(<Harness patch={{ pagesText: items }} />)
    const designer = await openDesigner()
    fireEvent.click(within(designer).getByRole('radio', { name: 'Sitemap' }))
    fireEvent.click(within(designer).getByLabelText('User menu'))
    expect(settings()).toEqual({ nav: { userMenu: true } })
    expect(designer.querySelector('[data-preview-tool="user"]') ?? document.querySelector('[data-nav-tools]')).toBeTruthy()
    fireEvent.click(within(designer).getByLabelText('User menu'))
    expect(latest.settingsText).toBe('')
  })

  it('leaves settings that do not parse alone: no Appearance, no navigation to set', async () => {
    render(<Harness patch={{ pagesText: items, settingsText: '{ "locale": ' }} />)
    expect(screen.queryByRole('button', { name: /Appearance/ })).toBeNull()
    const designer = await openDesigner()
    expect(within(designer).queryByRole('radio', { name: 'Appearance' })).toBeNull()
    fireEvent.click(within(designer).getByRole('radio', { name: 'Sitemap' }))
    expect(designer.querySelector('[data-nav-tools]')).toBeNull()
    expect(latest.settingsText).toBe('{ "locale": ')
  })

  it('offers the generated code of a page, from a request built out of the example', async () => {
    render(<Harness patch={{ pagesText: items, settingsText: JSON.stringify({ locale: 'he', scaffold: ['audit'] }) }} />)
    const designer = await openDesigner()
    const fetchMock = vi.mocked(fetch)
    fireEvent.click(within(designer).getByRole('tab', { name: 'Code' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/starter-fullstack.preview'))).toBe(true))
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url).includes('/starter-fullstack.preview')) as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({
      artifactId: 'shop', name: 'Shop', locale: 'he',
      backendTemplateSet: 'spring-jpa-crud', frontendTemplateSet: 'react-tailwind-crud',
      dependencies: ['web', 'data-jpa'], opts: { scaffold: ['audit'] },
      entities: [{ name: 'Item' }], pages: [{ id: 'items' }],
    })
  })
})

describe('FullstackExampleForm — the designer over the drawer', () => {
  it('takes the keyboard: its own keys work, Escape closes it alone, and the drawer’s keys wait', async () => {
    render(<Harness patch={{ pagesText: items }} drawer />)
    const drawer = screen.getByRole('dialog', { name: 'Edit Example' })
    // The drawer focuses its first field a moment after opening.
    await waitFor(() => expect(document.activeElement).toBe(within(drawer).getByPlaceholderText('blog')))
    const opener = screen.getByRole('button', { name: /Open designer/ })
    opener.focus()
    const designer = await openDesigner()

    // The designer's own keys — it used to give them up whenever a second dialog was open.
    fireEvent.keyDown(document, { key: 'p' })
    expect(designer.querySelector('[data-play-status]')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(designer.querySelector('[data-play-status]')).toBeNull()
    // The drawer's save shortcut is not for a designer lying over it.
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true })
    expect(onSave).not.toHaveBeenCalled()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Layout designer' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Edit Example' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(opener)
    // Still the drawer's lock on the page behind.
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true })
    expect(onSave).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps Tab inside the designer', async () => {
    render(<Harness patch={{ pagesText: items }} drawer />)
    const designer = await openDesigner()
    const stops = Array.from(designer.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'))
    stops[stops.length - 1].focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(designer.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(stops[stops.length - 1])
  })
})
