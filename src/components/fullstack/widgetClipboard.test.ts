import { describe, it, expect, beforeEach } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef, FullstackWidgetDef } from '../../types'
import { MAX_WIDGETS, validatePages } from './pageLayout'
import {
  deleteWidgetTemplate, fitWidget, pasteWidgets, readClipboard, readWidgetTemplates, saveWidgetTemplate, widgetName, writeClipboard,
} from './widgetClipboard'

const entities: FullstackEntityDef[] = [
  {
    name: 'Order',
    fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] }],
  },
]
const kpi: FullstackWidgetDef = { kind: 'kpi', entity: 'Order', title: 'Open orders', presetFilter: { status: 'OPEN' } }
const bar: FullstackWidgetDef = { kind: 'bar', entity: 'Order', groupBy: 'status' }
const pages: FullstackPageDef[] = [
  { id: 'desk', type: 'dashboard', title: 'Desk', widgets: [kpi, bar] },
  { id: 'orders', type: 'entity-list', entity: 'Order' },
  { id: 'board', type: 'dashboard', title: 'Board', widgets: [{ kind: 'text', entity: '', text: 'Hi' }] },
]

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

describe('widget clipboard storage', () => {
  it('keeps a copy for the browser session and saved widgets for good', () => {
    expect(readClipboard()).toBeNull()
    expect(writeClipboard({ widgets: [kpi], from: 'Desk' })).toBe(true)
    expect(readClipboard()).toEqual({ widgets: [kpi], from: 'Desk' })
    sessionStorage.setItem('fullstack:widgetClipboard', JSON.stringify({ widgets: [{ kind: 'nope' }], from: 'x' }))
    expect(readClipboard()).toBeNull()

    saveWidgetTemplate('Open orders', kpi)
    saveWidgetTemplate('Open orders', { ...kpi, span: 2 })
    expect(readWidgetTemplates()).toEqual([{ name: 'Open orders', widget: { ...kpi, span: 2 } }])
    deleteWidgetTemplate('Open orders')
    expect(readWidgetTemplates()).toEqual([])
  })

  it('names a widget by its title, else its kind and entity', () => {
    expect(widgetName(kpi)).toBe('Open orders')
    expect(widgetName(bar)).toBe('Breakdown chart · Order')
    expect(widgetName({ kind: 'text', entity: '', text: 'x' })).toBe('Text note')
  })
})

describe('fitWidget', () => {
  it('refuses an entity the model no longer has, and drops links to pages that are gone', () => {
    expect(fitWidget({ ...kpi, entity: 'Invoice' }, pages, entities)).toEqual({ reason: 'There is no Invoice entity in this model' })
    expect(fitWidget({ ...bar, drillTo: 'gone' }, pages, entities)).toEqual({ widget: bar, dropped: ['its drill-down to “gone”'] })
    const links: FullstackWidgetDef = { kind: 'links', entity: '', pages: ['orders', 'gone'] }
    expect(fitWidget(links, pages, entities)).toEqual({ widget: { ...links, pages: ['orders'] }, dropped: ['1 link to pages that are gone'] })
    expect('reason' in fitWidget({ ...links, pages: ['gone'] }, pages, entities)).toBe(true)
  })
})

describe('pasteWidgets', () => {
  it('pastes after a widget, as one labelled change the validator accepts', () => {
    const pasted = pasteWidgets(pages, 2, { widgets: [kpi, bar], from: 'Desk' }, entities, 0)
    if ('reason' in pasted) throw new Error(pasted.reason)
    expect(pasted.widgets.map(w => w.kind)).toEqual(['kpi', 'bar', 'text'])
    expect(pasted.label).toBe('Pasted 2 widgets into “Board”')
    const next = pages.map((p, i) => (i === 2 ? { ...p, widgets: pasted.widgets } : p))
    expect(validatePages(next, entities).issues).toEqual([])
  })

  it('says why nothing went in, and what was left out when some did', () => {
    expect(pasteWidgets(pages, 1, { widgets: [kpi], from: 'Desk' }, entities)).toEqual({ reason: 'Widgets go on a dashboard — pick one, then paste' })
    const full: FullstackPageDef = { ...pages[2], widgets: Array.from({ length: MAX_WIDGETS - 1 }, () => bar) }
    const pasted = pasteWidgets([pages[0], pages[1], full], 2, { widgets: [kpi, { ...bar, entity: 'Invoice' }, bar], from: 'Desk' }, entities)
    if ('reason' in pasted) throw new Error(pasted.reason)
    expect(pasted.added).toBe(1)
    expect(pasted.label).toBe('Pasted “Open orders” into “Board”')
    expect(pasted.skipped).toEqual([
      'Breakdown chart · Invoice: There is no Invoice entity in this model',
      `Breakdown chart · Order: no room under the ${MAX_WIDGETS}-widget cap`,
    ])
  })
})
