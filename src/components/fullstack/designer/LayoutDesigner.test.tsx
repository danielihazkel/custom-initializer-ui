import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { EntityTemplateSetSummary, FullstackEntityDef, FullstackNav, FullstackPageDef } from '../../../types'
import type { FeColorPalette } from '../../../hooks/useFrontendMetadata'
import { validatePages } from '../pageLayout'
import { PagesSection } from './PagesSection'
import { pickedAfterClick } from './PageStrip'
import { nextZoom } from './CanvasFrame'

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Order',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] },
      { name: 'total', type: 'BIG_DECIMAL' },
      { name: 'placedOn', type: 'LOCAL_DATE' },
    ],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
  },
]

const desk: FullstackPageDef[] = [
  { id: 'desk', type: 'dashboard', title: 'Desk', widgets: [{ kind: 'kpi', entity: 'Order' }, { kind: 'bar', entity: 'Order', groupBy: 'status' }] },
  { id: 'orders', type: 'entity-list', entity: 'Order' },
  { id: 'customers', type: 'entity-list', entity: 'Customer', group: 'Sales' },
]

const pushUndo = vi.fn()
let latest: FullstackPageDef[] = []
let latestNav: FullstackNav | undefined

/** The section is controlled; the harness holds the layout the way FullstackView does. */
function Harness({ initial, history }: { initial: FullstackPageDef[]; history?: Parameters<typeof PagesSection>[0]['history'] }) {
  const [pages, setPages] = useState(initial)
  const [nav, setNav] = useState<FullstackNav | undefined>(undefined)
  latest = pages
  latestNav = nav
  return (
    <PagesSection
      pages={pages}
      entities={entities}
      validation={validatePages(pages, entities)}
      onChange={setPages}
      pushUndo={pushUndo}
      onClear={() => setPages([])}
      nav={nav}
      onNavChange={setNav}
      history={history}
    />
  )
}

/** A dataTransfer good enough for jsdom's drag events. */
function dataTransfer() {
  const data: Record<string, string> = {}
  return { setData: (k: string, v: string) => { data[k] = v }, getData: (k: string) => data[k] ?? '', effectAllowed: '', dropEffect: '' }
}

function openDesigner() {
  fireEvent.click(screen.getByRole('button', { name: /Open designer/ }))
  return screen.getByRole('dialog', { name: 'Layout designer' })
}
const inspector = (designer: HTMLElement) => within(designer).getByRole('complementary', { name: 'Inspector' })
const chip = (designer: HTMLElement, id: string) =>
  (designer.querySelector(`[data-strip-page="${id}"]`) as HTMLElement).querySelector('button') as HTMLElement

beforeEach(() => {
  pushUndo.mockClear()
  localStorage.clear()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
})
afterEach(() => vi.unstubAllGlobals())

describe('Layout designer', () => {
  it('opens from the Pages card on the start page, and Escape closes it back to the button', () => {
    render(<Harness initial={desk} />)
    const card = screen.getByRole('region', { name: 'Frontend page layout' })
    expect(card.querySelector('[data-page-id="desk"]')?.getAttribute('title')).toContain('1 number tile · 1 breakdown chart')
    const opener = screen.getByRole('button', { name: /Open designer/ })
    opener.focus()
    const designer = openDesigner()
    expect(within(inspector(designer)).getByRole('heading', { name: 'Desk' })).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Layout designer' })).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
  })

  it('opens on the page whose chip was clicked, and edits it in the inspector', () => {
    render(<Harness initial={desk} />)
    fireEvent.click(document.querySelector('[data-page-id="customers"]')!)
    const designer = screen.getByRole('dialog', { name: 'Layout designer' })
    fireEvent.change(within(inspector(designer)).getByLabelText('Page title'), { target: { value: 'Clients' } })
    expect(latest[2]).toMatchObject({ title: 'Clients', id: 'clients' })
    // The strip selects another page; the inspector follows.
    fireEvent.click(within(designer.querySelector('[data-page-strip]') as HTMLElement).getByRole('button', { name: /^Desk/ }))
    expect(within(inspector(designer)).getByRole('heading', { name: 'Desk' })).toBeTruthy()
  })

  it('adds a widget from the library with a click and selects it', () => {
    render(<Harness initial={desk} />)
    const designer = openDesigner()
    fireEvent.click(within(designer).getByRole('button', { name: 'Add donut chart' }))
    expect(latest[0].widgets).toHaveLength(3)
    expect(latest[0].widgets?.[2]).toMatchObject({ kind: 'donut', entity: 'Order' })
    const panel = inspector(designer)
    expect(panel.getAttribute('data-inspector')).toBe('widget')
    expect(within(panel).getByText('Widget 3')).toBeTruthy()
    // Back to the page from the breadcrumb.
    fireEvent.click(within(panel).getByRole('button', { name: 'Desk' }))
    expect(inspector(designer).getAttribute('data-inspector')).toBe('page')
  })

  it('drops a library widget onto the dashboard where it lands', () => {
    render(<Harness initial={desk} />)
    const designer = openDesigner()
    const card = within(designer).getByRole('button', { name: 'Add trend over time' })
    const dt = dataTransfer()
    fireEvent.dragStart(card, { dataTransfer: dt })
    const end = designer.querySelector('[data-preview-drop-end]')!
    expect(end).toBeTruthy()
    fireEvent.dragOver(end, { dataTransfer: dt })
    fireEvent.drop(end, { dataTransfer: dt })
    expect(latest[0].widgets?.map(w => w.kind)).toEqual(['kpi', 'bar', 'line'])
    expect(designer.querySelector('[data-preview-drop-end]')).toBeNull()

    // Over a widget, the half under the pointer decides: here, after the first one.
    fireEvent.dragStart(within(designer).getByRole('button', { name: 'Add text note' }), { dataTransfer: dt })
    const first = designer.querySelector('[data-preview-widget-slot="0"]')!
    fireEvent.dragOver(first, { dataTransfer: dt })
    fireEvent.drop(first, { dataTransfer: dt })
    expect(latest[0].widgets?.map(w => w.kind)).toEqual(['kpi', 'text', 'bar', 'line'])
    expect(within(inspector(designer)).getByText('Widget 2')).toBeTruthy()
  })

  it('selects a widget on the canvas, and removes it with an undo entry', () => {
    render(<Harness initial={desk} />)
    const designer = openDesigner()
    fireEvent.click(within(designer).getByRole('button', { name: 'Edit widget 2' }))
    const panel = inspector(designer)
    expect(within(panel).getByText('Widget 2')).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: /Remove widget$/ }))
    expect(latest[0].widgets?.map(w => w.kind)).toEqual(['kpi'])
    expect(pushUndo).toHaveBeenCalledWith(expect.stringContaining('Removed widget 2'))
    expect(inspector(designer).getAttribute('data-inspector')).toBe('page')
  })

  it('adds a page from the library, asking which entity when several fit', () => {
    render(<Harness initial={desk} />)
    const designer = openDesigner()
    fireEvent.click(within(designer).getByRole('tab', { name: 'pages' }))
    // A board needs an enum lane: only Order fits, so it goes straight in.
    fireEvent.click(designer.querySelector('[data-library-page-type="board"]')!)
    expect(latest[3]).toMatchObject({ type: 'board', entity: 'Order' })
    expect(within(inspector(designer)).getByRole('heading', { name: /Order/ })).toBeTruthy()
    // A record page fits either entity: the designer asks.
    fireEvent.click(designer.querySelector('[data-library-page-type="record"]')!)
    const form = designer.querySelector('[data-entity-form]') as HTMLElement
    fireEvent.click(within(form).getByRole('radio', { name: 'Customer' }))
    fireEvent.click(within(form).getByRole('button', { name: /Add record page/ }))
    expect(latest[4]).toMatchObject({ type: 'record', entity: 'Customer' })
  })

  it('drops a page type into the page strip at the place it lands', () => {
    render(<Harness initial={desk} />)
    const designer = openDesigner()
    fireEvent.click(within(designer).getByRole('tab', { name: 'pages' }))
    const dt = dataTransfer()
    fireEvent.dragStart(designer.querySelector('[data-library-page-type="calendar"]')!, { dataTransfer: dt })
    const target = designer.querySelector('[data-strip-page="orders"]')!
    fireEvent.dragOver(target, { dataTransfer: dt })
    fireEvent.drop(target, { dataTransfer: dt })
    expect(latest.map(p => p.type)).toEqual(['dashboard', 'entity-list', 'calendar', 'entity-list'])
  })

  it('lists the problems with their fixes, and a jump opens the page at the control', () => {
    render(<Harness initial={[
      { id: 'desk', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Order' }, { kind: 'kpi', entity: 'Product' }] },
      { id: 'c', type: 'master-detail', parent: 'Customer', child: 'Order' },
    ]} />)
    fireEvent.click(document.querySelector('[data-pages-issues]')!)
    const designer = screen.getByRole('dialog', { name: 'Layout designer' })
    const problems = () => designer.querySelector('[data-page-layout-problems]') as HTMLElement
    // A jump to a widget's problem selects that widget.
    fireEvent.click(within(problems()).getByRole('button', { name: 'Jump to' }))
    expect(designer.querySelector('[data-designer-issues]')).toBeNull()
    expect(within(inspector(designer)).getByText('Widget 2')).toBeTruthy()

    fireEvent.click(designer.querySelector('[data-designer-issues-toggle]')!)
    fireEvent.click(within(problems()).getByRole('button', { name: 'Fix: Remove widget 2' }))
    expect(latest[0].widgets).toEqual([{ kind: 'kpi', entity: 'Order' }])
    expect(pushUndo).toHaveBeenCalledWith('Remove widget 2')
    expect(problems()).toBeNull()
  })

  it('moves pages and sets the navigation style in the sitemap', () => {
    render(<Harness initial={desk} />)
    const designer = openDesigner()
    fireEvent.click(within(designer).getByRole('radio', { name: 'Sitemap' }))
    const sitemap = designer.querySelector('[data-designer-sitemap]') as HTMLElement
    fireEvent.change(within(sitemap).getByLabelText('Rename the Sales group'), { target: { value: 'Clients' } })
    fireEvent.blur(within(sitemap).getByLabelText('Rename the Sales group'))
    expect(latest[2].group).toBe('Clients')
    fireEvent.click(within(sitemap).getByRole('radio', { name: 'Top bar' }))
    expect(latestNav).toEqual({ style: 'topbar' })
    // A page opened from the sitemap goes back to the design view on it.
    fireEvent.click(within(sitemap.querySelector('[data-sitemap-page="orders"]') as HTMLElement).getByTitle('Open it in the design view'))
    expect(designer.querySelector('[data-designer-sitemap]')).toBeNull()
    expect(within(inspector(designer)).getByRole('heading', { name: /Order/ })).toBeTruthy()
  })

  it('moves, resizes and removes the selected widget from the keyboard', () => {
    render(<Harness initial={desk} />)
    const designer = openDesigner()
    fireEvent.click(within(designer).getByRole('button', { name: 'Edit widget 1' }))
    fireEvent.keyDown(designer, { key: 'ArrowRight', altKey: true })
    expect(latest[0].widgets?.map(w => w.kind)).toEqual(['bar', 'kpi'])
    // The selection follows the widget.
    expect(within(inspector(designer)).getByText('Widget 2')).toBeTruthy()
    fireEvent.keyDown(designer, { key: 'ArrowRight', altKey: true, shiftKey: true })
    expect(latest[0].widgets?.[1].span).toBe(2)
    fireEvent.keyDown(designer, { key: 'Delete' })
    expect(latest[0].widgets?.map(w => w.kind)).toEqual(['bar'])
    // `/` searches the library.
    fireEvent.keyDown(designer, { key: '/' })
    expect(document.activeElement).toBe(within(designer).getByLabelText('Search the library'))
  })

  it('previews the page at phone width, one widget per row', () => {
    render(<Harness initial={desk} />)
    const designer = openDesigner()
    const grid = () => designer.querySelector('[data-preview-widget-slot="0"]')!.parentElement!
    expect(grid().className).toContain('grid-cols-4')
    fireEvent.click(within(designer).getByRole('radio', { name: 'Mobile' }))
    expect(grid().className).toContain('grid-cols-1')
    expect(designer.querySelector('[data-preview-topbar]')).toBeTruthy()
  })

  it('starts a layout from the entities on an empty card and opens the designer', () => {
    render(<Harness initial={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /Start from my entities/ }))
    expect(latest.length).toBeGreaterThan(0)
    expect(screen.getByRole('dialog', { name: 'Layout designer' })).toBeTruthy()
  })
})

describe('Layout designer — Appearance', () => {
  const sets: EntityTemplateSetSummary[] = [
    { setKey: 'react-tailwind-crud', name: 'React + Tailwind', description: 'The default shell', kind: 'FRONTEND_REACT', defaultDeps: [], designSystem: null, bootVersion: null, javaVersion: null, defaultPaletteId: 'ocean' },
    { setKey: 'react-menora-digital-crud', name: 'Menora Digital', description: 'The brand shell', kind: 'FRONTEND_REACT', defaultDeps: [], designSystem: 'MENORA_DIGITAL', bootVersion: null, javaVersion: null, defaultPaletteId: 'ocean' },
  ]
  const palettes: FeColorPalette[] = [
    { id: 'ocean', name: 'Ocean', primary: '#0055aa', secondary: '#ffcc00', isDefault: true, sortOrder: 0 },
    { id: 'forest', name: 'Forest', primary: '#226633', secondary: '#eedd88', isDefault: false, sortOrder: 1 },
  ]

  /** FullstackView's part: it owns the look and derives the preview settings from it. */
  function AppearanceHarness({ initial }: { initial: FullstackPageDef[] }) {
    const [pages, setPages] = useState(initial)
    const [frontendSet, setFrontendSet] = useState('react-tailwind-crud')
    const [colorPalette, setColorPalette] = useState('')
    const [meta, setMeta] = useState({ locale: 'en' as 'en' | 'he', dashboardTitle: '', dashboardOverview: '' })
    const [rtl, setRtl] = useState(false)
    const current = sets.find(s => s.setKey === frontendSet)
    const effective = colorPalette || 'ocean'
    latest = pages
    return (
      <PagesSection
        pages={pages}
        entities={entities}
        validation={validatePages(pages, entities)}
        onChange={setPages}
        pushUndo={pushUndo}
        onClear={() => setPages([])}
        previewSettings={{
          locale: meta.locale,
          projectOpts: rtl ? ['rtl'] : [],
          skin: current?.designSystem === 'MENORA_DIGITAL' ? 'menora' : 'tailwind',
          palette: palettes.find(p => p.id === effective),
          dashboardTitle: meta.dashboardTitle,
          dashboardOverview: meta.dashboardOverview,
        }}
        appearance={{
          frontendSets: sets, frontendSet, setFrontendSet, currentFrontendSet: current,
          setsLoading: false, setsError: null, loadTemplateSets: () => {},
          palettes, feError: null, reloadFe: () => {},
          effectivePalette: effective, setDefaultPalette: 'ocean', colorPalette, setColorPalette,
          locale: meta.locale, dashboardTitle: meta.dashboardTitle, dashboardOverview: meta.dashboardOverview,
          artifactId: 'demo', updateMeta: u => setMeta(m => ({ ...m, ...u })),
          rtl, toggleRtl: () => setRtl(r => !r),
        }}
      />
    )
  }

  function openAppearance() {
    fireEvent.click(screen.getByRole('button', { name: /Appearance/ }))
    const designer = screen.getByRole('dialog', { name: 'Layout designer' })
    expect(designer.querySelector('[data-designer-appearance]')).toBeTruthy()
    return designer
  }

  it('switches the shell, colours, language and direction, with the preview following', () => {
    render(<AppearanceHarness initial={desk} />)
    const designer = openAppearance()
    const preview = () => designer.querySelector('[data-layout-preview]') as HTMLElement
    expect(preview().querySelector('[data-preview-shell]')).toBeTruthy()

    fireEvent.click(within(designer).getByRole('radio', { name: /Menora Digital/ }))
    expect(preview().querySelector('[data-preview-shell]')).toBeNull()
    expect(designer.querySelector('[data-appearance-caption]')?.textContent).toContain('Menora Digital')

    fireEvent.click(within(designer).getByRole('radio', { name: 'Forest' }))
    expect(designer.querySelector('[data-appearance-caption]')?.textContent).toContain('Forest palette')

    fireEvent.click(within(designer).getByLabelText(/right-to-left/i))
    expect(preview().getAttribute('dir')).toBe('rtl')
    // A page with a layout has no classic heading to set.
    expect(document.getElementById('fs-dashboardTitle')).toBeNull()
    expect(designer.querySelector('[data-dashboard-meta-note]')).toBeTruthy()
    // Clicking a part of the preview goes to the design view to edit it.
    fireEvent.click(within(preview()).getByRole('button', { name: 'Edit widget 1' }))
    expect(designer.querySelector('[data-designer-appearance]')).toBeNull()
    expect(within(inspector(designer)).getByText('Widget 1')).toBeTruthy()
  })

  it('previews the classic shell without pages, with the heading as it is typed', () => {
    render(<AppearanceHarness initial={[]} />)
    const designer = openAppearance()
    fireEvent.change(document.getElementById('fs-dashboardTitle')!, { target: { value: 'Support desk' } })
    expect(designer.querySelector('[data-layout-preview]')?.textContent).toContain('Support desk')
    expect(within(designer).getByText(/Classic layout — the app you get without pages/)).toBeTruthy()
  })
})

describe('Layout designer — pages, problems and the canvas', () => {
  it('asks which pages a new tabs page holds before adding it', () => {
    render(<Harness initial={desk} />)
    const designer = openDesigner()
    fireEvent.click(within(designer).getByRole('tab', { name: 'pages' }))
    fireEvent.click(designer.querySelector('[data-library-page-type="tabs"]')!)
    expect(latest).toHaveLength(3)
    const form = designer.querySelector('[data-tabs-form]') as HTMLElement
    // It opens with the first two pages that can be tabs; Desk joins them as the third.
    expect((within(form).getByLabelText('Tab: Order') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(within(form).getByLabelText('Tab: Desk'))
    fireEvent.change(within(form).getByLabelText('Tabs page title'), { target: { value: 'Sales' } })
    fireEvent.click(within(form).getByLabelText('Hide these pages from the navigation'))
    fireEvent.click(within(form).getByRole('button', { name: 'Add tabs page' }))
    expect(latest[3]).toMatchObject({ type: 'tabs', title: 'Sales', tabs: [{ page: 'orders' }, { page: 'customers' }, { page: 'desk' }] })
    expect(latest.some(p => p.hidden)).toBe(false)
    expect(designer.querySelector('[data-tabs-form]')).toBeNull()
  })

  it('picks several pages with Ctrl-click and acts on them at once', () => {
    render(<Harness initial={desk} />)
    const designer = openDesigner()
    fireEvent.click(chip(designer, 'orders'))
    fireEvent.click(chip(designer, 'customers'), { ctrlKey: true })
    const bar = designer.querySelector('[data-bulk-pages]') as HTMLElement
    expect(within(bar).getByText('2 picked')).toBeTruthy()
    fireEvent.click(within(bar).getByRole('button', { name: 'Hide from nav' }))
    expect(latest.filter(p => p.hidden).map(p => p.id)).toEqual(['orders', 'customers'])
    expect(pushUndo).toHaveBeenCalledWith('Hid 2 pages from the navigation')
    // Escape drops the picks before it closes anything.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(designer.querySelector('[data-bulk-pages]')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Layout designer' })).toBeTruthy()
  })

  it('moves, removes and opens a chip menu for a page from its chip', () => {
    render(<Harness initial={desk} />)
    const designer = openDesigner()
    fireEvent.keyDown(chip(designer, 'orders'), { key: 'ArrowRight', altKey: true })
    expect(latest.map(p => p.id)).toEqual(['desk', 'customers', 'orders'])

    fireEvent.contextMenu(chip(designer, 'orders'))
    const menu = within(designer).getByRole('menu', { name: /actions/ })
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Make it the start page' }))
    expect(latest.map(p => p.id)).toEqual(['orders', 'desk', 'customers'])
    expect(within(designer).queryByRole('menu')).toBeNull()

    fireEvent.keyDown(chip(designer, 'customers'), { key: 'Delete' })
    expect(latest.map(p => p.id)).toEqual(['orders', 'desk'])
    expect(pushUndo).toHaveBeenCalledWith('Removed the “Customer” page')
  })

  it('rings the parts of the canvas with a problem, and fixes them all in one step', () => {
    render(<Harness initial={[
      { id: 'desk', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Product' }, { kind: 'kpi', entity: 'Order' }, { kind: 'kpi', entity: 'Invoice' }] },
      { id: 'customers', type: 'entity-list', entity: 'Customer' },
    ]} />)
    const designer = openDesigner()
    expect(designer.querySelector('[data-preview-widget-slot="0"] [data-preview-problem]')).toBeTruthy()
    expect(designer.querySelector('[data-preview-widget-slot="1"] [data-preview-problem]')).toBeNull()
    expect(within(designer).getByRole('button', { name: /Edit widget 3 \(problem:/ })).toBeTruthy()

    fireEvent.click(designer.querySelector('[data-designer-issues-toggle]')!)
    fireEvent.click(designer.querySelector('[data-page-fix-all]')!)
    expect(latest[0].widgets).toEqual([{ kind: 'kpi', entity: 'Order' }])
    expect(pushUndo).toHaveBeenCalledTimes(1)
    expect(pushUndo).toHaveBeenCalledWith('Applied 2 fixes')
    expect(designer.querySelector('[data-preview-problem]')).toBeNull()
  })

  it('jumps several steps back from the history list', () => {
    const onJump = vi.fn()
    render(<Harness initial={desk} history={{
      undoLabel: 'Undo: Renamed', redoLabel: 'Redo: Moved', onUndo: () => {}, onRedo: () => {},
      undoEntries: ['Added a page', 'Renamed'], redoEntries: ['Moved'], onJump,
    }} />)
    const designer = openDesigner()
    fireEvent.click(designer.querySelector('[data-designer-history]')!)
    const menu = within(designer).getByRole('menu', { name: 'History' })
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent)).toEqual([
      'redoRedo to: Moved', 'undoUndo: Renamed', 'undoUndo 2 back to before: Added a page',
    ])
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Undo 2 back/ }))
    expect(onJump).toHaveBeenCalledWith(-2)
    expect(within(designer).queryByRole('menu')).toBeNull()
  })

  it('zooms the canvas, offers a tablet width and hides the side panes, remembering them', () => {
    render(<Harness initial={desk} />)
    let designer = openDesigner()
    const frame = () => designer.querySelector('[data-canvas-device]') as HTMLElement
    expect(frame().style.zoom).toBe('1.35')
    fireEvent.click(within(designer).getByRole('button', { name: 'Zoom in' }))
    expect(frame().style.zoom).toBe('1.6')
    fireEvent.click(within(designer).getByRole('radio', { name: 'Tablet' }))
    expect(frame().getAttribute('data-canvas-device')).toBe('tablet')

    fireEvent.click(designer.querySelector('[data-toggle-library]')!)
    expect(designer.querySelector('[data-designer-library]')).toBeNull()
    fireEvent.click(designer.querySelector('[data-toggle-inspector]')!)
    expect(within(designer).queryByRole('complementary', { name: 'Inspector' })).toBeNull()
    // Clicking a part of the canvas brings the settings back to edit it.
    fireEvent.click(within(designer).getByRole('button', { name: 'Edit widget 1' }))
    expect(within(inspector(designer)).getByText('Widget 1')).toBeTruthy()

    // Closed and opened again: the zoom and the hidden library stay; `/` brings the library back.
    fireEvent.click(within(designer).getByRole('button', { name: 'Done' }))
    designer = openDesigner()
    expect(frame().style.zoom).toBe('1.6')
    expect(designer.querySelector('[data-designer-library]')).toBeNull()
    fireEvent.keyDown(designer, { key: '/' })
    expect(document.activeElement).toBe(within(designer).getByLabelText('Search the library'))
  })
})

describe('Layout designer — widget suggestions', () => {
  it('suggests ready-made widgets for the picked entity, by click or by drag', () => {
    render(<Harness initial={desk} />)
    const designer = openDesigner()
    const list = () => designer.querySelector('[data-widget-suggestions]') as HTMLElement
    // Desk already counts orders and breaks them down by status: neither is offered again.
    const keys = () => Array.from(list().querySelectorAll('[data-widget-suggestion]')).map(b => b.getAttribute('data-widget-suggestion'))
    expect(keys()).toEqual(['sum:total', 'line:placedOn', 'top:customer', 'recent'])

    fireEvent.click(list().querySelector('[data-widget-suggestion="sum:total"]')!)
    expect(latest[0].widgets?.[2]).toEqual({ kind: 'kpi', entity: 'Order', agg: 'sum', field: 'total' })
    expect(within(inspector(designer)).getByText('Widget 3')).toBeTruthy()
    expect(keys()).not.toContain('sum:total')

    const dt = dataTransfer()
    fireEvent.dragStart(list().querySelector('[data-widget-suggestion="line:placedOn"]')!, { dataTransfer: dt })
    const first = designer.querySelector('[data-preview-widget-slot="0"]')!
    fireEvent.dragOver(first, { dataTransfer: dt })
    fireEvent.drop(first, { dataTransfer: dt })
    expect(latest[0].widgets?.[1]).toEqual({ kind: 'line', entity: 'Order', groupBy: 'placedOn', bucket: 'month' })

    // Another entity, other suggestions.
    fireEvent.change(within(designer).getByLabelText('New widget entity'), { target: { value: 'Customer' } })
    expect(keys()).toEqual(['count', 'recent'])
  })
})

describe('Layout designer — page flow', () => {
  it('maps where each page leads, flags what nothing reaches, and opens a page to edit it', () => {
    render(<Harness initial={[
      ...desk,
      { id: 'order', type: 'record', entity: 'Order', hidden: true },
      { id: 'help', type: 'content', title: 'Help', body: 'Hi', hidden: true },
    ]} />)
    const designer = openDesigner()
    fireEvent.click(within(designer).getByRole('radio', { name: 'Sitemap' }))
    fireEvent.click(within(designer).getByRole('radio', { name: 'Page flow' }))
    const map = designer.querySelector('[data-page-flow]') as HTMLElement
    expect(map.querySelector('[data-flow-node="order"]')?.getAttribute('data-flow-depth')).toBe('2')
    expect(map.querySelector('[data-flow-edge="1>3"]')?.getAttribute('data-flow-kinds')).toBe('row')
    expect(map.querySelector('[data-flow-edge="3>1"]')?.getAttribute('data-flow-kinds')).toBe('back')
    expect(map.querySelector('[data-flow-unreachable]')?.textContent).toContain('Help')
    expect(map.querySelector('[data-flow-node="help"]')?.getAttribute('data-flow-depth')).toBe('none')

    // Pointing at a page lights its links and dims the rest.
    fireEvent.mouseEnter(map.querySelector('[data-flow-node="orders"]')!)
    expect(map.querySelector('[data-flow-edge="1>3"]')?.getAttribute('opacity')).toBe('0.9')
    expect(map.querySelector('[data-flow-edge="-1>2"]')?.getAttribute('opacity')).toBe('0.08')
    // The menu links can be hidden.
    fireEvent.click(within(map).getByLabelText('Menu links'))
    expect(map.querySelector('[data-flow-edge="-1>0"]')).toBeNull()

    fireEvent.click(map.querySelector('[data-flow-node="order"]')!)
    expect(designer.querySelector('[data-designer-sitemap]')).toBeNull()
    expect(within(inspector(designer)).getByRole('heading', { name: /Order/ })).toBeTruthy()
  })
})

describe('Layout designer — page parts', () => {
  const parted: FullstackPageDef[] = [
    ...desk,
    { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'orders' }, { page: 'customers' }] },
    { id: 'customer', type: 'record', entity: 'Customer', hidden: true, childTabs: [], headerStats: [] },
    { id: 'sales', type: 'report', entity: 'Order' },
    { id: 'new-order', type: 'wizard', entity: 'Order', steps: [{ fields: ['id', 'status', 'total'] }, { fields: ['placedOn', 'customer'] }] },
  ]
  const part = (designer: HTMLElement, key: string) => designer.querySelector(`[data-library-part="${key}"]`) as HTMLElement
  const preview = (designer: HTMLElement) => designer.querySelector('[data-layout-preview]') as HTMLElement

  it('embeds a page as a tab: a library card or a strip chip dropped on the tab strip', () => {
    render(<Harness initial={parted} />)
    const designer = openDesigner()
    fireEvent.click(chip(designer, 'queue'))
    expect(within(designer).getByRole('tab', { name: 'parts' })).toBeTruthy()
    expect(part(designer, 'tab:orders').getAttribute('disabled')).not.toBeNull()

    let dt = dataTransfer()
    fireEvent.dragStart(part(designer, 'tab:desk'), { dataTransfer: dt })
    const end = preview(designer).querySelector('[data-preview-part-drop]') as HTMLElement
    fireEvent.dragOver(end, { dataTransfer: dt })
    expect(end.className).toContain('border-primary')
    fireEvent.drop(end, { dataTransfer: dt })
    expect(latest[3].tabs).toEqual([{ page: 'orders' }, { page: 'customers' }, { page: 'desk' }])
    expect(pushUndo).toHaveBeenLastCalledWith('Added “Desk” as a tab of “Queue”')

    // A page chip dragged from the strip onto a tab goes in beside it.
    dt = dataTransfer()
    fireEvent.dragStart(chip(designer, 'sales'), { dataTransfer: dt })
    const firstTab = within(preview(designer)).getAllByRole('tab')[0]
    fireEvent.dragOver(firstTab, { dataTransfer: dt })
    fireEvent.drop(firstTab, { dataTransfer: dt })
    fireEvent.dragEnd(chip(designer, 'sales'))
    expect(latest[3].tabs?.map(t => t.page)).toEqual(['orders', 'sales', 'customers', 'desk'])
    expect(preview(designer).querySelector('[data-preview-part-drop]')).toBeNull()
  })

  it('adds a related list and a header number to a record page', () => {
    render(<Harness initial={parted} />)
    const designer = openDesigner()
    fireEvent.click(chip(designer, 'customer'))
    fireEvent.click(part(designer, 'child-tab:Order'))
    expect(latest[4].childTabs).toEqual(['Order'])
    expect(part(designer, 'child-tab:Order').getAttribute('title')).toBe('Already a tab here')

    const dt = dataTransfer()
    fireEvent.dragStart(part(designer, 'header-stat:Order'), { dataTransfer: dt })
    const end = preview(designer).querySelector('[data-preview-part-drop]') as HTMLElement
    expect(end.textContent).toContain('number above the tabs')
    fireEvent.dragOver(end, { dataTransfer: dt })
    fireEvent.drop(end, { dataTransfer: dt })
    expect(latest[4].headerStats).toEqual([{ child: 'Order' }])
    expect(preview(designer).querySelector('[data-preview-stats]')?.textContent).toContain('Order')
  })

  it('adds a report chart where it was dropped', () => {
    render(<Harness initial={parted} />)
    const designer = openDesigner()
    fireEvent.click(chip(designer, 'sales'))
    const dt = dataTransfer()
    fireEvent.dragStart(part(designer, 'chart:placedOn'), { dataTransfer: dt })
    const end = preview(designer).querySelector('[data-preview-part-drop="1"]') as HTMLElement
    fireEvent.dragOver(end, { dataTransfer: dt })
    fireEvent.drop(end, { dataTransfer: dt })
    expect(latest[5].charts).toEqual([{}, { groupBy: 'placedOn' }])
    expect(preview(designer).querySelector('[data-preview-chart="1"]')).toBeTruthy()
  })

  it('moves a wizard field onto another step, or into a new one from its picker', () => {
    render(<Harness initial={parted} />)
    const designer = openDesigner()
    fireEvent.click(chip(designer, 'new-order'))
    const dt = dataTransfer()
    fireEvent.dragStart(part(designer, 'step-field:placedOn'), { dataTransfer: dt })
    const first = preview(designer).querySelector('[data-preview-step-drop="0"]') as HTMLElement
    fireEvent.dragOver(first, { dataTransfer: dt })
    fireEvent.drop(first, { dataTransfer: dt })
    expect(latest[6].steps).toEqual([{ fields: ['id', 'status', 'total', 'placedOn'] }, { fields: ['customer'] }])
    expect(pushUndo).toHaveBeenLastCalledWith('Moved Placed on to step 1 of “Order”')

    fireEvent.change(within(designer).getByLabelText('Step for Total'), { target: { value: '2' } })
    expect(latest[6].steps).toEqual([{ fields: ['id', 'status', 'placedOn'] }, { fields: ['customer'] }, { fields: ['total'] }])
  })
})

describe('Layout designer — Play mode', () => {
  const walkable: FullstackPageDef[] = [
    ...desk,
    { id: 'order', type: 'record', entity: 'Order', hidden: true },
  ]
  const screenType = (designer: HTMLElement) => designer.querySelector('[data-preview-screen]')?.getAttribute('data-preview-screen')
  const trail = (designer: HTMLElement) => (designer.querySelector('[data-play-trail]') as HTMLElement).textContent

  it('walks the app: a chart drills into its list, a row opens its page, Back returns', () => {
    render(<Harness initial={walkable} />)
    const designer = openDesigner()
    fireEvent.click(within(designer).getByRole('radio', { name: 'Play' }))
    expect(designer.querySelector('[data-play-status]')).toBeTruthy()
    // Nothing on the canvas opens an editor while playing.
    expect(within(designer.querySelector('[data-layout-preview]') as HTMLElement).queryByRole('button', { name: /^Edit / })).toBeNull()

    fireEvent.click(designer.querySelector('[data-preview-widget="1"]')!)
    expect(screenType(designer)).toBe('entity-list')
    expect(within(inspector(designer)).getByRole('heading', { name: /Order/ })).toBeTruthy()

    fireEvent.click(designer.querySelector('tr[data-play-link]')!)
    expect(screenType(designer)).toBe('record')
    expect(trail(designer)).toMatch(/Desk.*Order.*Order/)

    fireEvent.click(designer.querySelector('[data-play-back]')!)
    expect(screenType(designer)).toBe('entity-list')
    // A crumb goes back further, dropping what came after it.
    fireEvent.click(within(designer.querySelector('[data-play-trail]') as HTMLElement).getByRole('button', { name: 'Desk' }))
    expect(screenType(designer)).toBe('dashboard')
    expect(designer.querySelector('[data-play-back]')?.hasAttribute('disabled')).toBe(true)
  })

  it('says where a click lands when it opens no page, and Escape goes back to editing', () => {
    render(<Harness initial={walkable} />)
    const designer = openDesigner()
    fireEvent.keyDown(designer, { key: 'p' })
    // The menu works as in the app.
    fireEvent.click(designer.querySelector('[data-preview-nav="2"]')!)
    expect(trail(designer)).toMatch(/Customer/)
    fireEvent.click(designer.querySelector('tr[data-play-link]')!)
    expect(designer.querySelector('[data-play-status]')?.textContent).toMatch(/quick-look drawer/)
    expect(screenType(designer)).toBe('entity-list')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(designer.querySelector('[data-play-status]')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Layout designer' })).toBeTruthy()
    // Editing picks up on the page the walk ended on.
    expect(within(inspector(designer)).getByRole('heading', { name: /Customer/ })).toBeTruthy()
    expect(within(designer).getByRole('button', { name: 'Edit the page title' })).toBeTruthy()
  })
})

describe('designer helpers', () => {
  const ids = ['a', 'b', 'c', 'd'].map(id => ({ id, type: 'entity-list' as const, entity: 'Order' }))
  it('picks with Ctrl (the open page joins the first pick) and with Shift (a run)', () => {
    expect(pickedAfterClick(ids, [], 0, 2, 'toggle')).toEqual(['a', 'c'])
    expect(pickedAfterClick(ids, ['a', 'c'], 0, 2, 'toggle')).toEqual(['a'])
    expect(pickedAfterClick(ids, [], 1, 1, 'toggle')).toEqual(['b'])
    expect(pickedAfterClick(ids, ['d'], 2, 0, 'range')).toEqual(['d', 'a', 'b', 'c'])
  })
  it('steps the zoom through its levels and stops at the ends', () => {
    expect(nextZoom(1.35, 1)).toBe(1.6)
    expect(nextZoom(1.35, -1)).toBe(1.15)
    expect(nextZoom(1.9, 1)).toBe(1.9)
    expect(nextZoom(0.8, -1)).toBe(0.8)
    expect(nextZoom(1.25, 1)).toBe(1.35)
  })
})
