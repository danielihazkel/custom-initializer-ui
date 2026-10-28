import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { EntityTemplateSetSummary, FullstackEntityDef, FullstackNav, FullstackPageDef, FullstackStarterRequest } from '../../../types'
import type { FeColorPalette } from '../../../hooks/useFrontendMetadata'
import { validatePages } from '../pageLayout'
import { PagesSection } from './PagesSection'
import { pickedAfterClick } from './PageStrip'
import { nextZoom } from './CanvasFrame'
import type { DesignIntent } from '../../../designRuntime/PreviewFrame'

// CodeMirror does not run in jsdom; the Code tab's viewer is a plain block here.
vi.mock('../../ReadOnlyCodeViewer', () => ({ ReadOnlyCodeViewer: ({ code }: { code: string }) => <pre data-code-viewer>{code}</pre> }))

// The canvas runs the generated app in a sandboxed frame, which jsdom cannot: a stand-in records
// what the designer hands it, and plays the runtime's design-mode gestures back to it (the
// runtime's own tests and runtime-check.mjs cover the gestures themselves).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CanvasProps = Record<string, any>
const canvas = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }))
vi.mock('./AppCanvas', () => ({
  APP_VIEWPORT: { desktop: 1280, tablet: 820, mobile: 390 },
  AppCanvas: (props: Record<string, unknown>) => {
    canvas.props.push(props)
    return <div data-designer-canvas data-test-canvas={props.design ? 'design' : 'app'} />
  },
}))
// No runtime frame starts in jsdom: the spec sheet's snapshots fail at once (and the sheet says so).
vi.mock('../../../designRuntime/capture', async original => ({
  ...(await original<typeof import('../../../designRuntime/capture')>()),
  captureScreens: async () => { throw new Error('no preview runtime here') },
}))
/** The props of the canvas drawn last. */
const lastCanvas = () => canvas.props[canvas.props.length - 1] as CanvasProps
/** The element a toolbar's menu anchors to (the runtime reports the toolbar's rect). */
let anchor: HTMLButtonElement
/** A gesture of the runtime's editing layer, as the frame reports it. */
function gesture(intent: DesignIntent) {
  act(() => lastCanvas().design.onIntent(intent, () => anchor))
}
const rect = { x: 0, y: 0, w: 112, h: 26 }

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
function Harness({ initial, history, code }: { initial: FullstackPageDef[]; history?: Parameters<typeof PagesSection>[0]['history']; code?: boolean }) {
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
      codeRequest={code ? () => ({ entities, pages } as FullstackStarterRequest) : undefined}
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
  canvas.props.length = 0
  anchor = document.body.appendChild(Object.assign(document.createElement('button'), { textContent: 'toolbar' }))
  pushUndo.mockClear()
  localStorage.clear()
  // The tour opens by itself on a first visit; its own tests clear this.
  localStorage.setItem('fullstack:designerTour', 'done')
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
})
afterEach(() => {
  vi.unstubAllGlobals()
  anchor.remove()
})

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

  it('drops a library widget onto the dashboard where the app’s editing layer says it lands', () => {
    render(<Harness initial={desk} code />)
    const designer = openDesigner()
    const card = within(designer).getByRole('button', { name: 'Add trend over time' })
    const dt = dataTransfer()
    fireEvent.dragStart(card, { dataTransfer: dt })
    // The runtime is told what is held, to draw where it lands.
    expect(lastCanvas().design.state.drag).toEqual({ span: 2 })
    // The library's dragend arrives before the runtime's drop message.
    fireEvent.dragEnd(card, { dataTransfer: dt })
    gesture({ type: 'drop', at: 2 })
    expect(latest[0].widgets?.map(w => w.kind)).toEqual(['kpi', 'bar', 'line'])
    expect(lastCanvas().design.state.drag).toBeNull()

    fireEvent.dragStart(within(designer).getByRole('button', { name: 'Add text note' }), { dataTransfer: dt })
    gesture({ type: 'drop', at: 1 })
    expect(latest[0].widgets?.map(w => w.kind)).toEqual(['kpi', 'text', 'bar', 'line'])
    expect(within(inspector(designer)).getByText('Widget 2')).toBeTruthy()
  })

  it('selects a widget on the canvas, and removes it with an undo entry', () => {
    render(<Harness initial={desk} code />)
    const designer = openDesigner()
    gesture({ type: 'pick', control: 'widget.1' })
    const panel = inspector(designer)
    expect(within(panel).getByText('Widget 2')).toBeTruthy()
    // The runtime rings what is selected.
    expect(lastCanvas().design.state.selected).toBe('widget.1')
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
    render(<Harness initial={desk} code />)
    const designer = openDesigner()
    gesture({ type: 'pick', control: 'widget.0' })
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

  it('runs the app at the width of the device picked, on the page selected', () => {
    render(<Harness initial={desk} code />)
    const designer = openDesigner()
    expect(lastCanvas()).toMatchObject({ device: 'desktop', hash: '#/desk' })
    expect(lastCanvas().request).toMatchObject({ pages: desk })
    fireEvent.click(within(designer).getByRole('radio', { name: 'Mobile' }))
    expect(lastCanvas().device).toBe('mobile')
    fireEvent.click(chip(designer, 'orders'))
    expect(lastCanvas()).toMatchObject({ hash: '#/orders' })
    expect(lastCanvas().design.state.pageType).toBe('entity-list')
  })

  it('moves and resizes a widget dragged on the canvas, keeping it selected', () => {
    render(<Harness initial={desk} code />)
    const designer = openDesigner()
    gesture({ type: 'pick', control: 'widget.0' })
    gesture({ type: 'reorder', from: 0, to: 1 })
    expect(latest[0].widgets?.map(w => w.kind)).toEqual(['bar', 'kpi'])
    expect(within(inspector(designer)).getByText('Widget 2')).toBeTruthy()
    gesture({ type: 'resize', index: 1, span: 3 })
    expect(latest[0].widgets?.[1].span).toBe(3)
  })

  it('duplicates a widget from its toolbar or with Ctrl+D, and switches its kind from a menu', () => {
    render(<Harness initial={desk} code />)
    const designer = openDesigner()
    gesture({ type: 'tool', action: 'duplicate', index: 0, rect })
    expect(latest[0].widgets?.map(w => w.kind)).toEqual(['kpi', 'kpi', 'bar'])
    // The copy is selected, so Ctrl+D copies it again.
    expect(within(inspector(designer)).getByText('Widget 2')).toBeTruthy()
    fireEvent.keyDown(designer, { key: 'd', ctrlKey: true })
    expect(latest[0].widgets?.map(w => w.kind)).toEqual(['kpi', 'kpi', 'kpi', 'bar'])
    expect(within(inspector(designer)).getByText('Widget 3')).toBeTruthy()

    gesture({ type: 'tool', action: 'kind', index: 3, rect })
    const menu = within(designer).getByRole('menu', { name: 'Kind of widget 4' })
    expect((within(menu).getByRole('menuitem', { name: /Breakdown chart \(now\)/ }) as HTMLButtonElement).disabled).toBe(true)
    // Activity reads audited rows; the audit option is off here.
    expect((within(menu).getByRole('menuitem', { name: 'Recent activity' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Donut chart' }))
    expect(latest[0].widgets?.[3]).toMatchObject({ kind: 'donut', entity: 'Order', groupBy: 'status' })
    expect(within(designer).queryByRole('menu')).toBeNull()
    expect(within(inspector(designer)).getByText('Widget 4')).toBeTruthy()
  })

  it('renames the page, its description and a widget from the canvas; a blank title goes back to the default', () => {
    render(<Harness initial={desk} code />)
    openDesigner()
    // The runtime starts a rename from the page's words.
    expect(lastCanvas().design.state.texts).toMatchObject({ title: 'Desk' })
    gesture({ type: 'rename', control: 'title', value: 'Front desk' })
    // A dashboard keeps its id.
    expect(latest[0]).toMatchObject({ id: 'desk', title: 'Front desk' })
    expect(pushUndo).toHaveBeenCalledWith('Renamed “Desk” to “Front desk”')
    expect(lastCanvas().design.state.texts.title).toBe('Front desk')
    gesture({ type: 'rename', control: 'description', value: 'Today at a glance' })
    expect(latest[0].description).toBe('Today at a glance')
    expect(lastCanvas().design.state.texts.description).toBe('Today at a glance')

    gesture({ type: 'rename', control: 'widget.1.title', value: 'Mix' })
    expect(latest[0].widgets?.[1].title).toBe('Mix')
    gesture({ type: 'rename', control: 'widget.1.title', value: '  ' })
    expect(latest[0].widgets?.[1].title).toBeUndefined()
  })

  it('renames a tab and a wizard step in place, writing the dealt steps out', () => {
    render(<Harness code initial={[
      ...desk,
      { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'orders' }, { page: 'customers' }] },
      { id: 'new-order', type: 'wizard', entity: 'Order' },
    ]} />)
    const designer = openDesigner()
    fireEvent.click(chip(designer, 'queue'))
    expect(lastCanvas().design.state.texts['tabs.0.title']).toBeTruthy()
    gesture({ type: 'rename', control: 'tabs.0.title', value: 'Open' })
    expect(latest[3].tabs).toEqual([{ page: 'orders', title: 'Open' }, { page: 'customers' }])
    expect(lastCanvas().design.state.texts['tabs.0.title']).toBe('Open')

    fireEvent.click(chip(designer, 'new-order'))
    gesture({ type: 'rename', control: 'steps.0.title', value: 'Basics' })
    expect(latest[4].steps?.[0].title).toBe('Basics')
    expect(latest[4].steps?.length).toBeGreaterThan(0)
    // The review is not a step to rename: the words stop before it.
    const steps = Object.keys(lastCanvas().design.state.texts).filter(k => k.startsWith('steps.'))
    expect(steps).toHaveLength(latest[4].steps!.length)
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
          dashboardTitle: meta.dashboardTitle,
          dashboardOverview: meta.dashboardOverview,
        }}
        codeRequest={() => ({ entities, pages, frontendTemplateSet: frontendSet, colorPalette: effective, dashboardTitle: meta.dashboardTitle } as FullstackStarterRequest)}
        appearance={{
          frontendSets: sets, frontendSet, setFrontendSet, currentFrontendSet: current,
          setsLoading: false, setsError: null, loadTemplateSets: () => {},
          designKits: [], designKit: null, pickDesignKit: () => {}, clearDesignKit: () => {},
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

  it('switches the shell, colours, language and direction, with the generated app following', () => {
    render(<AppearanceHarness initial={desk} />)
    const designer = openAppearance()
    expect(designer.querySelector('[data-test-canvas]')).toBeTruthy()
    expect(lastCanvas().request).toMatchObject({ frontendTemplateSet: 'react-tailwind-crud', colorPalette: 'ocean' })

    fireEvent.click(within(designer).getByRole('radio', { name: /Menora Digital/ }))
    expect(designer.querySelector('[data-appearance-caption]')?.textContent).toContain('Menora Digital')
    expect(lastCanvas().request).toMatchObject({ frontendTemplateSet: 'react-menora-digital-crud' })

    fireEvent.click(within(designer).getByRole('radio', { name: 'Forest' }))
    expect(designer.querySelector('[data-appearance-caption]')?.textContent).toContain('Forest palette')
    expect(lastCanvas().request).toMatchObject({ colorPalette: 'forest' })

    fireEvent.click(within(designer).getByLabelText(/right-to-left/i))
    expect(designer.querySelector('[data-appearance-caption]')?.textContent).toContain('right-to-left')
    // A page with a layout has no classic heading to set.
    expect(document.getElementById('fs-dashboardTitle')).toBeNull()
    expect(designer.querySelector('[data-dashboard-meta-note]')).toBeTruthy()
    // The app's menu moves the designer to the page it opens.
    act(() => lastCanvas().onRoute('#/orders'))
    expect(lastCanvas().hash).toBe('#/orders')
  })

  it('runs the classic shell without pages, with the heading as it is typed', () => {
    render(<AppearanceHarness initial={[]} />)
    const designer = openAppearance()
    fireEvent.change(document.getElementById('fs-dashboardTitle')!, { target: { value: 'Support desk' } })
    expect(lastCanvas().request).toMatchObject({ pages: [], dashboardTitle: 'Support desk' })
    expect(lastCanvas().hash).toBeUndefined()
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

  it('hands the canvas its problems to ring, waits to generate until they are fixed, and fixes them all in one step', () => {
    render(<Harness code initial={[
      { id: 'desk', type: 'dashboard', widgets: [{ kind: 'kpi', entity: 'Product' }, { kind: 'kpi', entity: 'Order' }, { kind: 'kpi', entity: 'Invoice' }] },
      { id: 'customers', type: 'entity-list', entity: 'Customer' },
    ]} />)
    const designer = openDesigner()
    const ringed = () => Object.keys(lastCanvas().design.state.problems)
    expect(ringed().some(k => k.startsWith('widget.0'))).toBe(true)
    expect(ringed().some(k => k.startsWith('widget.1'))).toBe(false)
    expect(ringed().some(k => k.startsWith('widget.2'))).toBe(true)
    // A layout with problems is not sent to the generator.
    expect(lastCanvas().request).toBeNull()

    fireEvent.click(designer.querySelector('[data-designer-issues-toggle]')!)
    fireEvent.click(designer.querySelector('[data-page-fix-all]')!)
    expect(latest[0].widgets).toEqual([{ kind: 'kpi', entity: 'Order' }])
    expect(pushUndo).toHaveBeenCalledTimes(1)
    expect(pushUndo).toHaveBeenCalledWith('Applied 2 fixes')
    expect(ringed()).toEqual([])
    expect(lastCanvas().request).toMatchObject({ pages: latest })
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
    render(<Harness initial={desk} code />)
    let designer = openDesigner()
    expect(lastCanvas().zoom).toBe(1.35)
    fireEvent.click(within(designer).getByRole('button', { name: 'Zoom in' }))
    expect(lastCanvas().zoom).toBe(1.6)
    fireEvent.click(within(designer).getByRole('radio', { name: 'Tablet' }))
    expect(lastCanvas().device).toBe('tablet')

    fireEvent.click(designer.querySelector('[data-toggle-library]')!)
    expect(designer.querySelector('[data-designer-library]')).toBeNull()
    fireEvent.click(designer.querySelector('[data-toggle-inspector]')!)
    expect(within(designer).queryByRole('complementary', { name: 'Inspector' })).toBeNull()
    // Clicking a part of the canvas brings the settings back to edit it.
    gesture({ type: 'pick', control: 'widget.0' })
    expect(within(inspector(designer)).getByText('Widget 1')).toBeTruthy()

    // Closed and opened again: the zoom and the hidden library stay; `/` brings the library back.
    fireEvent.click(within(designer).getByRole('button', { name: 'Done' }))
    designer = openDesigner()
    expect(lastCanvas().zoom).toBe(1.6)
    expect(designer.querySelector('[data-designer-library]')).toBeNull()
    fireEvent.keyDown(designer, { key: '/' })
    expect(document.activeElement).toBe(within(designer).getByLabelText('Search the library'))
  })

  it('runs the app empty, loading or failed, remembering the choice', () => {
    render(<Harness initial={desk} code />)
    let designer = openDesigner()
    expect(lastCanvas().dataState).toBe('data')
    fireEvent.click(within(designer).getByRole('radio', { name: 'Empty' }))
    expect(lastCanvas().dataState).toBe('empty')
    fireEvent.click(within(designer).getByRole('radio', { name: 'Error' }))
    expect(lastCanvas().dataState).toBe('error')
    fireEvent.click(within(designer).getByRole('radio', { name: 'Loading' }))
    expect(lastCanvas().dataState).toBe('loading')

    // Closed and opened again, the canvas still shows the loading state.
    fireEvent.click(within(designer).getByRole('button', { name: 'Done' }))
    designer = openDesigner()
    expect(within(designer).getByRole('radio', { name: 'Loading' }).getAttribute('aria-checked')).toBe('true')
    expect(lastCanvas().dataState).toBe('loading')
  })
})

describe('Layout designer — widget suggestions', () => {
  it('suggests ready-made widgets for the picked entity, by click or by drag', () => {
    render(<Harness initial={desk} code />)
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
    gesture({ type: 'drop', at: 1 })
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

describe('Layout designer — widget clipboard', () => {
  const two: FullstackPageDef[] = [...desk, { id: 'board', type: 'dashboard', title: 'Board', widgets: [{ kind: 'text', entity: '', text: 'Hi' }] }]
  const notice = (designer: HTMLElement) => designer.querySelector('[data-pages-notice]')?.textContent ?? ''
  beforeEach(() => sessionStorage.clear())

  it('copies a widget with Ctrl+C and pastes it on another dashboard with Ctrl+V, after the selected one', () => {
    render(<Harness initial={two} code />)
    const designer = openDesigner()
    gesture({ type: 'pick', control: 'widget.1' })
    fireEvent.keyDown(designer, { key: 'c', ctrlKey: true })
    expect(notice(designer)).toContain('Copied “Breakdown chart · Order”')

    fireEvent.click(chip(designer, 'board'))
    gesture({ type: 'pick', control: 'widget.0' })
    fireEvent.keyDown(designer, { key: 'v', ctrlKey: true })
    expect(latest[3].widgets?.map(w => w.kind)).toEqual(['text', 'bar'])
    expect(pushUndo).toHaveBeenLastCalledWith('Pasted “Breakdown chart · Order” into “Board”')
    expect(within(inspector(designer)).getByText('Widget 2')).toBeTruthy()
    // The copy outlives the designer: the library offers it again.
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.keyDown(document, { key: 'Escape' })
    const again = openDesigner()
    expect(again.querySelector('[data-library-clipboard]')?.textContent).toContain('Copied from Desk')
  })

  it('cuts with Ctrl+X, copies a whole dashboard with nothing selected, and refuses a page that is not a dashboard', () => {
    render(<Harness initial={two} code />)
    const designer = openDesigner()
    fireEvent.keyDown(designer, { key: 'c', ctrlKey: true })
    expect(notice(designer)).toContain('Copied 2 widgets')
    expect(designer.querySelector('[data-library-clipboard]')?.textContent).toContain('2 widgets')

    gesture({ type: 'pick', control: 'widget.0' })
    fireEvent.keyDown(designer, { key: 'x', ctrlKey: true })
    expect(latest[0].widgets?.map(w => w.kind)).toEqual(['bar'])
    expect(notice(designer)).toContain('Cut “Number tile · Order”')
    fireEvent.click(chip(designer, 'orders'))
    fireEvent.keyDown(designer, { key: 'v', ctrlKey: true })
    expect(notice(designer)).toContain('Widgets go on a dashboard')
    expect(latest[1].widgets).toBeUndefined()
  })

  it('moves a widget to another dashboard, and keeps one as a saved widget in the library', () => {
    render(<Harness initial={two} code />)
    const designer = openDesigner()
    gesture({ type: 'pick', control: 'widget.0' })
    fireEvent.click(within(inspector(designer)).getByRole('button', { name: 'Save as widget' }))
    expect(notice(designer)).toContain('Saved “Number tile · Order”')

    fireEvent.click(within(inspector(designer)).getByRole('button', { name: 'Move to…' }))
    fireEvent.click(within(designer).getByRole('menuitem', { name: /Board/ }))
    expect(latest[0].widgets?.map(w => w.kind)).toEqual(['bar'])
    expect(latest[3].widgets?.map(w => w.kind)).toEqual(['text', 'kpi'])
    expect(pushUndo).toHaveBeenLastCalledWith('Moved “Number tile · Order” from “Desk” to “Board”')
    expect(inspector(designer).getAttribute('data-page-key')).toBeTruthy()
    expect(within(inspector(designer)).getByText('Widget 2')).toBeTruthy()

    fireEvent.click(within(designer).getByRole('button', { name: 'Add Number tile · Order' }))
    expect(latest[3].widgets?.map(w => w.kind)).toEqual(['text', 'kpi', 'kpi'])
    fireEvent.click(within(designer).getByRole('button', { name: 'Forget Number tile · Order' }))
    expect(designer.querySelector('[data-my-widgets]')).toBeNull()
  })
})

describe('Layout designer — team templates', () => {
  const two: FullstackPageDef[] = [...desk, { id: 'board', type: 'dashboard', title: 'Board', widgets: [{ kind: 'text', entity: '', text: 'Hi' }] }]
  const stamp = { description: null, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z' }
  const shared = [
    { ...stamp, id: 1, kind: 'page', name: 'Paid orders', createdBy: 'dana', content: { id: 'paid', type: 'entity-list', title: 'Paid orders', entity: 'Order', presetFilter: { status: 'PAID' } } },
    { ...stamp, id: 2, kind: 'widget', name: 'Open count', createdBy: 'dana', content: { kind: 'kpi', entity: 'Order', title: 'Open count' } },
    { ...stamp, id: 3, kind: 'widget', name: 'Invoices', createdBy: null, content: { kind: 'kpi', entity: 'Invoice' } },
  ]
  const json = (status: number, body: unknown) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  let calls: { url: string; method: string; body?: unknown }[] = []
  beforeEach(() => {
    calls = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : undefined })
      if (method === 'GET') return json(200, shared)
      if (method === 'DELETE') return json(204, null)
      const body = JSON.parse(init!.body as string)
      return json(method === 'POST' ? 201 : 200, { ...stamp, id: 50, createdBy: 'me', ...body })
    }))
  })
  const library = (designer: HTMLElement) => within(designer).getByRole('complementary', { name: 'Library' })
  const notice = (designer: HTMLElement) => designer.querySelector('[data-pages-notice]')?.textContent ?? ''

  it('adds a shared page and a shared widget, refusing one whose entity this model lacks', async () => {
    render(<Harness initial={two} code />)
    const designer = openDesigner()
    const widgets = await waitFor(() => {
      const el = designer.querySelector('[data-team-widgets]')
      if (!el) throw new Error('not listed yet')
      return el as HTMLElement
    })
    expect(within(widgets).getByRole('button', { name: 'Add Invoices' }).getAttribute('disabled')).not.toBeNull()
    fireEvent.click(within(widgets).getByRole('button', { name: 'Add Open count' }))
    expect(latest[0].widgets?.[2]).toEqual({ kind: 'kpi', entity: 'Order', title: 'Open count' })

    fireEvent.click(within(library(designer)).getByRole('tab', { name: 'pages' }))
    fireEvent.click(within(library(designer)).getByRole('button', { name: 'Add the team template Paid orders' }))
    expect(latest).toHaveLength(5)
    expect(latest[4]).toMatchObject({ type: 'entity-list', entity: 'Order', presetFilter: { status: 'PAID' } })
    expect(latest[4].id).toBe('paid-orders')
  })

  it('shares a page and a widget, updating the team’s one of the same name, and deletes on a second click', async () => {
    render(<Harness initial={two} code />)
    const designer = openDesigner()
    await waitFor(() => expect(designer.querySelector('[data-team-widgets]')).toBeTruthy())

    fireEvent.click(within(inspector(designer)).getByRole('button', { name: 'Share Desk with the team' }))
    await waitFor(() => expect(notice(designer)).toContain('Shared “Desk” for the team'))
    expect(calls[calls.length - 1]).toMatchObject({ url: '/metadata/fullstack/templates', method: 'POST', body: { kind: 'page', name: 'Desk', content: { id: 'desk', type: 'dashboard' } } })

    // A widget titled like a team widget replaces it.
    gesture({ type: 'pick', control: 'widget.0' })
    fireEvent.change(within(inspector(designer)).getByLabelText('Widget title'), { target: { value: 'open count' } })
    fireEvent.click(within(inspector(designer)).getByRole('button', { name: 'Update for team' }))
    await waitFor(() => expect(notice(designer)).toContain('Updated “Open count” for the team'))
    expect(calls[calls.length - 1]).toMatchObject({ url: '/metadata/fullstack/templates/2', method: 'PUT', body: { name: 'Open count', content: { kind: 'kpi', title: 'open count' } } })

    const remove = within(library(designer)).getByRole('button', { name: 'Delete the team template “Invoices”' })
    fireEvent.click(remove)
    expect(calls.some(c => c.method === 'DELETE')).toBe(false)
    fireEvent.click(within(library(designer)).getByRole('button', { name: 'Delete “Invoices” for everyone' }))
    await waitFor(() => expect(within(library(designer)).queryByRole('button', { name: 'Add Invoices' })).toBeNull())
    expect(calls[calls.length - 1]).toEqual({ url: '/metadata/fullstack/templates/3', method: 'DELETE', body: undefined })
  })

  it('says when the team’s templates did not load', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(500, { error: 'boom' })))
    render(<Harness initial={two} code />)
    const designer = openDesigner()
    fireEvent.click(within(library(designer)).getByRole('tab', { name: 'pages' }))
    await waitFor(() => expect(designer.querySelector('[data-team-error]')?.textContent).toContain('boom'))
  })
})

describe('Layout designer — Code tab', () => {
  const coded: FullstackPageDef[] = [...desk, { id: 'queue', type: 'tabs', title: 'Queue', tabs: [{ page: 'orders' }, { page: 'customers' }] }]
  const previewOf = (paths: string[]) => ({ files: paths.map(path => ({ path, content: `// generated ${path}` })), tree: [] })
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const files = previewOf([
    'frontend/src/app/App.tsx',
    'frontend/src/app/route.ts',
    'frontend/src/app/screens/DeskScreen.tsx',
    'frontend/src/app/screens/OrdersScreen.tsx',
    'frontend/src/app/screens/CustomersScreen.tsx',
    'frontend/src/app/screens/QueueScreen.tsx',
    'frontend/src/pages/order/ui/OrderPage.tsx',
  ])
  // Opening the designer also lists the team's templates; only the preview calls count here.
  const previewCalls = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls.filter(c => c[0] === '/starter-fullstack.preview')
  const openCode = (designer: HTMLElement) => fireEvent.click(within(inspector(designer)).getByRole('tab', { name: 'Code' }))

  it('is offered only when the editor can build a request', () => {
    render(<Harness initial={coded} />)
    expect(within(inspector(openDesigner())).queryByRole('tab', { name: 'Code' })).toBeNull()
  })

  it('shows the selected page’s generated screen, then what it embeds and the shell', async () => {
    const fetchMock = vi.fn(async () => ok(files))
    vi.stubGlobal('fetch', fetchMock)
    render(<Harness initial={coded} code />)
    const designer = openDesigner()
    fireEvent.click(chip(designer, 'queue'))
    openCode(designer)
    const viewer = await waitFor(() => {
      const el = designer.querySelector('[data-page-code-path]')
      if (!el) throw new Error('no code yet')
      return el as HTMLElement
    })
    expect(previewCalls(fetchMock)).toHaveLength(1)
    const [url, init] = previewCalls(fetchMock)[0] as unknown as [string, RequestInit]
    expect(url).toBe('/starter-fullstack.preview')
    expect(JSON.parse(init.body as string).pages[3].id).toBe('queue')
    expect(viewer.getAttribute('data-page-code-path')).toBe('frontend/src/app/screens/QueueScreen.tsx')
    expect(viewer.textContent).toContain('// generated frontend/src/app/screens/QueueScreen.tsx')
    const tabs = within(within(designer).getByRole('tablist', { name: 'Generated files' })).getAllByRole('tab')
    expect(tabs.map(t => t.textContent)).toEqual(['QueueScreen.tsx', 'OrdersScreen.tsx', 'CustomersScreen.tsx', 'App.tsx', 'route.ts'])

    // Another file; then another page — its own screen opens, from the same answer.
    fireEvent.click(tabs[3])
    expect(designer.querySelector('[data-page-code-path]')?.getAttribute('data-page-code-path')).toBe('frontend/src/app/App.tsx')
    fireEvent.click(chip(designer, 'orders'))
    expect(designer.querySelector('[data-page-code-path]')?.getAttribute('data-page-code-path')).toBe('frontend/src/app/screens/OrdersScreen.tsx')
    expect(previewCalls(fetchMock)).toHaveLength(1)

    // An edit asks again once the typing stops.
    fireEvent.click(within(inspector(designer)).getByRole('tab', { name: 'Basics' }))
    fireEvent.change(within(inspector(designer)).getByLabelText('Page title'), { target: { value: 'All orders' } })
    openCode(designer)
    await waitFor(() => expect(previewCalls(fetchMock)).toHaveLength(2), { timeout: 2000 })
  })

  it('says what the generator turned down, and tries again on request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'Bad request', detail: 'Page “desk”: no widgets' }), { status: 400, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    render(<Harness initial={coded} code />)
    const designer = openDesigner()
    openCode(designer)
    const alert = await waitFor(() => {
      const el = designer.querySelector('[data-page-code-error]')
      if (!el) throw new Error('no error yet')
      return el as HTMLElement
    })
    expect(alert.textContent).toContain('Page “desk”: no widgets')
    fetchMock.mockImplementation(async () => ok(files))
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(designer.querySelector('[data-page-code-path]')?.getAttribute('data-page-code-path')).toBe('frontend/src/app/screens/DeskScreen.tsx'))
    expect(designer.querySelector('[data-page-code-error]')).toBeNull()
  })

  it('waits for the layout’s problems to be fixed before asking', async () => {
    const fetchMock = vi.fn(async () => ok(files))
    vi.stubGlobal('fetch', fetchMock)
    render(<Harness initial={[...coded, { id: 'empty', type: 'dashboard', widgets: [] }]} code />)
    const designer = openDesigner()
    openCode(designer)
    expect(designer.querySelector('[data-page-code-status]')?.textContent).toMatch(/Fix the \d+ problems? first/)
    await new Promise(r => setTimeout(r, 20))
    expect(previewCalls(fetchMock)).toHaveLength(0)
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

  it('embeds a page as a tab: a library card or a strip chip dropped on the tab strip', () => {
    render(<Harness initial={parted} code />)
    const designer = openDesigner()
    fireEvent.click(chip(designer, 'queue'))
    expect(within(designer).getByRole('tab', { name: 'parts' })).toBeTruthy()
    expect(part(designer, 'tab:orders').getAttribute('disabled')).not.toBeNull()

    let dt = dataTransfer()
    fireEvent.dragStart(part(designer, 'tab:desk'), { dataTransfer: dt })
    // The runtime is told which kind of part is held, to show where it lands among the tabs.
    expect(lastCanvas().design.state.drag).toEqual({ span: 0, slot: 'tab' })
    gesture({ type: 'drop', at: 2 })
    expect(latest[3].tabs).toEqual([{ page: 'orders' }, { page: 'customers' }, { page: 'desk' }])
    expect(pushUndo).toHaveBeenLastCalledWith('Added “Desk” as a tab of “Queue”')

    // A page chip dragged from the strip onto the tab strip goes in where it lands.
    dt = dataTransfer()
    fireEvent.dragStart(chip(designer, 'sales'), { dataTransfer: dt })
    expect(lastCanvas().design.state.drag).toEqual({ span: 0, slot: 'tab' })
    gesture({ type: 'drop', at: 1 })
    fireEvent.dragEnd(chip(designer, 'sales'))
    expect(latest[3].tabs?.map(t => t.page)).toEqual(['orders', 'sales', 'customers', 'desk'])
    expect(lastCanvas().design.state.drag).toBeNull()
  })

  it('adds a related list and a header number to a record page', () => {
    render(<Harness initial={parted} code />)
    const designer = openDesigner()
    fireEvent.click(chip(designer, 'customer'))
    fireEvent.click(part(designer, 'child-tab:Order'))
    expect(latest[4].childTabs).toEqual(['Order'])
    expect(part(designer, 'child-tab:Order').getAttribute('title')).toBe('Already a tab here')

    const dt = dataTransfer()
    fireEvent.dragStart(part(designer, 'header-stat:Order'), { dataTransfer: dt })
    expect(lastCanvas().design.state.drag).toEqual({ span: 0, slot: 'header-stat' })
    gesture({ type: 'drop', at: 0 })
    expect(latest[4].headerStats).toEqual([{ child: 'Order' }])
    expect(lastCanvas().design.state.texts['headerStats.0.title']).toBeTruthy()
  })

  it('adds a report chart where it was dropped', () => {
    render(<Harness initial={parted} code />)
    const designer = openDesigner()
    fireEvent.click(chip(designer, 'sales'))
    const dt = dataTransfer()
    fireEvent.dragStart(part(designer, 'chart:placedOn'), { dataTransfer: dt })
    expect(lastCanvas().design.state.drag).toEqual({ span: 0, slot: 'chart' })
    gesture({ type: 'drop', at: 1 })
    expect(latest[5].charts).toEqual([{}, { groupBy: 'placedOn' }])
  })

  it('moves a wizard field onto another step, or into a new one from its picker', () => {
    render(<Harness initial={parted} code />)
    const designer = openDesigner()
    fireEvent.click(chip(designer, 'new-order'))
    const dt = dataTransfer()
    fireEvent.dragStart(part(designer, 'step-field:placedOn'), { dataTransfer: dt })
    expect(lastCanvas().design.state.drag).toEqual({ span: 0, slot: 'step-field' })
    // Dropped onto the first step.
    gesture({ type: 'drop', at: 0 })
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
  const trail = (designer: HTMLElement) => (designer.querySelector('[data-play-trail]') as HTMLElement).textContent

  it('walks the generated app: the page it opens follows, Back and the trail return', () => {
    render(<Harness initial={walkable} code />)
    const designer = openDesigner()
    fireEvent.click(within(designer).getByRole('radio', { name: 'Play' }))
    expect(designer.querySelector('[data-play-status]')).toBeTruthy()
    // The app takes its own clicks while playing: no editing layer.
    expect(lastCanvas().design).toBeUndefined()
    expect(lastCanvas().request).toMatchObject({ pages: walkable })

    // A chart drilling into its list: the app's route moves the designer there.
    act(() => lastCanvas().onRoute('#/orders?status=OPEN'))
    expect(within(inspector(designer)).getByRole('heading', { name: /Order/ })).toBeTruthy()
    // A row opening its record page.
    act(() => lastCanvas().onRoute('#/order/3'))
    expect(trail(designer)).toMatch(/Desk.*Order.*Order/)

    fireEvent.click(designer.querySelector('[data-play-back]')!)
    expect(lastCanvas().hash).toBe('#/orders')
    // A crumb goes back further, dropping what came after it.
    fireEvent.click(within(designer.querySelector('[data-play-trail]') as HTMLElement).getByRole('button', { name: 'Desk' }))
    expect(lastCanvas().hash).toBe('#/desk')
    expect(designer.querySelector('[data-play-back]')?.hasAttribute('disabled')).toBe(true)
  })

  it('plays from P, and Escape goes back to editing on the page the walk ended on', () => {
    render(<Harness initial={walkable} code />)
    const designer = openDesigner()
    fireEvent.keyDown(designer, { key: 'p' })
    // The app's menu works as in the app.
    act(() => lastCanvas().onRoute('#/customers'))
    expect(trail(designer)).toMatch(/Customer/)
    // A route that names no page of the layout leaves the walk where it is.
    act(() => lastCanvas().onRoute('#/nowhere'))
    expect(trail(designer)).toMatch(/Customer$/)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(designer.querySelector('[data-play-status]')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Layout designer' })).toBeTruthy()
    // Editing picks up on the page the walk ended on, with the editing layer back.
    expect(within(inspector(designer)).getByRole('heading', { name: /Customer/ })).toBeTruthy()
    expect(lastCanvas().design.state.pageType).toBe('entity-list')
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

describe('Layout designer — tour', () => {
  const tour = () => screen.queryByRole('dialog', { name: /^Designer tour/ })

  it('opens by itself on a first visit, steps with Next, Back and the arrows, and Skip ends it for good', () => {
    localStorage.removeItem('fullstack:designerTour')
    render(<Harness initial={desk} />)
    let designer = openDesigner()
    expect(tour()?.getAttribute('aria-label')).toBe('Designer tour — The library')
    expect(document.activeElement).toBe(within(tour()!).getByRole('button', { name: 'Next' }))
    fireEvent.click(within(tour()!).getByRole('button', { name: 'Next' }))
    expect(tour()?.getAttribute('aria-label')).toBe('Designer tour — Your pages')
    fireEvent.keyDown(tour()!, { key: 'ArrowRight' })
    expect(tour()?.getAttribute('aria-label')).toBe('Designer tour — The canvas')
    fireEvent.click(within(tour()!).getByRole('button', { name: 'Back' }))
    expect(tour()?.getAttribute('aria-label')).toBe('Designer tour — Your pages')
    // Its keys stay on the card: Escape skips the tour, not the designer.
    fireEvent.keyDown(tour()!, { key: 'Escape' })
    expect(tour()).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Layout designer' })).toBeTruthy()
    expect(localStorage.getItem('fullstack:designerTour')).toBe('done')

    fireEvent.click(within(designer).getByRole('button', { name: 'Done' }))
    designer = openDesigner()
    expect(tour()).toBeNull()
  })

  it('runs again from the help menu, skipping a folded pane, and ends with Done on the last step', () => {
    render(<Harness initial={desk} />)
    const designer = openDesigner()
    expect(tour()).toBeNull()
    fireEvent.click(designer.querySelector('[data-toggle-library]')!)
    fireEvent.click(within(designer).getByRole('button', { name: 'Help' }))
    fireEvent.click(within(designer).getByRole('menuitem', { name: 'Take the tour' }))
    expect(tour()?.getAttribute('aria-label')).toBe('Designer tour — Your pages')
    const steps = 5
    expect(within(tour()!).getByText(`Tour · 1 of ${steps}`)).toBeTruthy()
    for (let i = 1; i < steps; i++) fireEvent.click(within(tour()!).getByRole('button', { name: 'Next' }))
    expect(tour()?.getAttribute('aria-label')).toBe('Designer tour — Problems and tips')
    // Tab stays on the card.
    const done = within(tour()!).getByRole('button', { name: 'Done' })
    done.focus()
    fireEvent.keyDown(done, { key: 'Tab' })
    expect(tour()!.contains(document.activeElement)).toBe(true)
    fireEvent.click(within(tour()!).getByRole('button', { name: 'Done' }))
    expect(tour()).toBeNull()
  })
})

describe('Layout designer — spec sheet', () => {
  it('downloads the layout as an HTML spec named after the project, each page as the app draws it', async () => {
    const created: Blob[] = []
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL: (b: Blob) => { created.push(b); return 'blob:spec' }, revokeObjectURL: vi.fn() }))
    // The generator answers; the runtime is not here, so the pages go unpictured and the sheet says so.
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.startsWith('/starter-fullstack.preview')
      ? new Response(JSON.stringify({ files: [{ path: 'menora-model.json', content: '{"entities":[]}' }, { path: 'frontend/src/main.tsx', content: 'export {}' }] }), { status: 200 })
      : new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    try {
      render(<Harness initial={desk} code />)
      const designer = openDesigner()
      fireEvent.click(within(designer).getByRole('button', { name: 'Export the layout as a spec sheet' }))
      await waitFor(() => expect(click).toHaveBeenCalledTimes(1), { timeout: 4000 })
      expect(created).toHaveLength(1)
      const html = await created[0].text()
      expect(html).toContain('<title>Layout — page layout</title>')
      expect(html.match(/class="page"/g)).toHaveLength(desk.length)
      expect(within(designer).getByText(/Downloaded layout-layout-spec\.html/)).toBeTruthy()
    } finally {
      click.mockRestore()
    }
  })
})

