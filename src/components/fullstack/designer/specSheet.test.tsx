import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../../types'
import { buildLayoutPreview } from '../layoutPreviewModel'
import { buildSpecSheet, pageSettings, specFileName } from './specSheet'
import { buildLayoutSpec, collectAppCss, staticMarkup } from './specSnapshot'

const entities: FullstackEntityDef[] = [
  { name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] },
  {
    name: 'Order',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'], filterable: true },
      { name: 'total', type: 'BIG_DECIMAL' },
    ],
    relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
  },
]

const pages: FullstackPageDef[] = [
  { id: 'desk', type: 'dashboard', title: 'Desk <b>', widgets: [{ kind: 'kpi', entity: 'Order', title: 'Open orders' }, { kind: 'bar', entity: 'Order', groupBy: 'status' }] },
  { id: 'open', type: 'entity-list', entity: 'Order', title: 'Open orders', presetFilter: { status: 'OPEN' }, group: 'Sales', columns: ['status', 'total'] },
  { id: 'customer', type: 'record', entity: 'Customer', hidden: true },
]

const preview = buildLayoutPreview(pages, entities, { locale: 'en', projectOpts: [] })

describe('spec sheet', () => {
  it('names the file after the project', () => {
    expect(specFileName('Order desk!')).toBe('order-desk-layout-spec.html')
    expect(specFileName('  ')).toBe('layout-layout-spec.html')
  })

  it('lists a page’s settings as a reviewer reads them', () => {
    const rows = Object.fromEntries(pageSettings(pages[1], pages, entities))
    expect(rows).toMatchObject({
      Type: 'Entity list',
      Route: '#/open',
      'In the menu': 'Yes, under “Sales”',
      Entity: 'Order',
      Columns: 'status, total',
    })
    expect(rows['Opens filtered on']).toMatch(/^status = /)
    expect(Object.fromEntries(pageSettings(pages[2], pages, entities))['In the menu']).toBe('No — opened from other pages')
  })

  it('is one self-contained page: every page with its route, the navigation, escaped text and print breaks', () => {
    const html = buildSpecSheet({
      project: 'Shop', date: '27 October 2026', frontendSet: 'Tailwind', locale: 'en', pages, entities,
      sections: preview.sections, flowHtml: '<svg data-flow></svg>', canvasHtml: ['<div data-canvas-0></div>', null, null], css: '.x{color:red}',
    })
    expect(html.match(/<html/g)).toHaveLength(1)
    expect(html).toContain('<h1>Shop</h1>')
    for (const [i, page] of pages.entries()) {
      expect(html).toContain(`id="page-${i}"`)
      expect(html).toContain(`#/${page.id}`)
    }
    // User text is text, never markup.
    expect(html).toContain('Desk &lt;b&gt;')
    expect(html).not.toContain('Desk <b>')
    expect(html).toContain('<strong>Sales</strong>')
    expect(html).toContain('Opened from other pages: <a href="#page-2">')
    expect(html).toContain('<div data-canvas-0></div>')
    expect(html).toContain('<svg data-flow></svg>')
    expect(html).toContain('Number tile — “Open orders” · Order')
    expect(html).toContain('break-before: page')
    expect(html).not.toMatch(/https?:\/\//)
  })

  it('snapshots each page’s canvas and the page flow without icon names, and asks the network for nothing', () => {
    const html = buildLayoutSpec({ project: 'Shop', pages, entities, preview, skin: 'tailwind', locale: 'en' }, new Date(2026, 9, 27))
    expect(html).toContain('27 October 2026')
    expect(html.match(/data-layout-preview/g)?.length).toBe(pages.length)
    expect(html).toContain('data-page-flow')
    expect(html).not.toContain('material-symbols-outlined')
    expect(html).not.toContain('data-rename-owner')
    expect(html).not.toMatch(/https?:\/\//)
  })

  it('reads the app’s stylesheet without its fonts, imports or other files', () => {
    const style = document.createElement('style')
    style.textContent = "@font-face { font-family: X; src: url('/x.woff2'); } .card { color: red; background: url('/bg.png'); } .dot { background: url(data:image/png;base64,AA) }"
    document.head.appendChild(style)
    try {
      const css = collectAppCss()
      expect(css).not.toContain('@font-face')
      expect(css).toContain('.card')
      expect(css).not.toContain('/bg.png')
      expect(css).toContain('data:image/png')
    } finally {
      style.remove()
    }
    expect(staticMarkup(<p><span className="material-symbols-outlined">home</span>Hi</p>)).toBe('<p>Hi</p>')
  })
})
