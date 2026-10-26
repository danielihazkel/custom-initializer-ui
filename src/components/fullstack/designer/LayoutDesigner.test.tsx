import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { FullstackEntityDef, FullstackNav, FullstackPageDef } from '../../../types'
import { validatePages } from '../pageLayout'
import { PagesSection } from './PagesSection'

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
function Harness({ initial }: { initial: FullstackPageDef[] }) {
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

beforeEach(() => {
  pushUndo.mockClear()
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
