import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { LayoutPreview } from './LayoutPreview'
import { buildLayoutPreview } from './layoutPreviewModel'

const entities: FullstackEntityDef[] = [
  {
    name: 'Order',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true },
      { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'], enumLabels: { OPEN: 'פתוח', PAID: 'שולם' } },
      { name: 'total', type: 'BIG_DECIMAL' },
      { name: 'placedOn', type: 'LOCAL_DATE', filterable: true },
    ],
  },
]

const pages: FullstackPageDef[] = [
  { id: 'desk', type: 'dashboard', widgets: [{ kind: 'links', entity: '', pages: ['orders', 'load'] }, { kind: 'activity', entity: '' }] },
  { id: 'orders', type: 'entity-list', entity: 'Order', columns: ['status', 'total', 'placedOn'] },
  { id: 'load', type: 'import', entity: 'Order' },
  { id: 'schedule', type: 'calendar', entity: 'Order', dateField: 'placedOn', modes: ['month', 'agenda'] },
]

function draw(selected: number, opts: { locale: 'en' | 'he'; skin: 'tailwind' | 'menora' }) {
  const preview = buildLayoutPreview(pages, entities, { locale: opts.locale, projectOpts: ['csvExport', 'audit'] })
  return render(<LayoutPreview preview={preview} selected={selected} onSelect={() => {}} onEdit={() => {}} skin={opts.skin} />).container
}

describe('LayoutPreview — the app’s language', () => {
  it('words the import steps, the export button, the calendar views and the activity times in Hebrew', () => {
    const he = { locale: 'he' as const, skin: 'tailwind' as const }
    const load = draw(2, he).textContent ?? ''
    expect(load).toContain('ייבוא')
    expect(load).toContain('1 · בחירת קובץ')
    expect(load).toContain('גררו לכאן קובץ CSV של')
    expect(load).toContain('עמודות:')
    expect(load).not.toContain('Drop a CSV')
    expect(draw(1, he).textContent).toContain('ייצוא')
    const schedule = draw(3, he).textContent ?? ''
    expect(schedule).toContain('חודש')
    expect(schedule).toContain('סדר יום')
    expect(draw(0, he).textContent).toMatch(/לפני 7 דקות/)
    // English stays English.
    expect(draw(0, { locale: 'en', skin: 'tailwind' }).textContent).toContain('7 minutes ago')
    expect(draw(2, { locale: 'en', skin: 'tailwind' }).textContent).toContain('1 · Choose a file')
  })
})

describe('LayoutPreview — the Menora skin', () => {
  it('draws enum values as lavender chips, numbers to the end, link tiles as yellow discs, in Assistant', () => {
    const menora = { locale: 'he' as const, skin: 'menora' as const }
    const list = draw(1, menora)
    const chips = Array.from(list.querySelectorAll('[data-preview-chip-cell]')).map(c => c.textContent)
    expect(chips.length).toBeGreaterThan(0)
    expect(chips.every(c => c === 'פתוח' || c === 'שולם')).toBe(true)
    const totals = list.querySelectorAll('tbody tr td:nth-child(2)')
    expect(Array.from(totals).every(td => td.className.includes('text-end'))).toBe(true)
    expect((list.querySelector('[data-layout-preview]') as HTMLElement).style.fontFamily).toContain('Assistant')

    const desk = draw(0, menora)
    expect(desk.querySelectorAll('[data-preview-action-disc]')).toHaveLength(2)

    // The tailwind skin keeps plain cells and tiles.
    const plain = draw(1, { locale: 'en', skin: 'tailwind' })
    expect(plain.querySelector('[data-preview-chip-cell]')).toBeNull()
    expect((plain.querySelector('[data-layout-preview]') as HTMLElement).style.fontFamily).toBe('')
    expect(draw(0, { locale: 'en', skin: 'tailwind' }).querySelector('[data-preview-action-disc]')).toBeNull()
  })
})
