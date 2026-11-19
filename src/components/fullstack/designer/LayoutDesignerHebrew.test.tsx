import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { FullstackEntityDef, FullstackPageDef } from '../../../types'
import { setLang } from '../../../i18n'
import { validatePages } from '../pageLayout'
import { PagesSection } from './PagesSection'

vi.mock('../../ReadOnlyCodeViewer', () => ({ ReadOnlyCodeViewer: ({ code }: { code: string }) => <pre>{code}</pre> }))

const entities: FullstackEntityDef[] = [
  { name: 'Order', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'status', type: 'ENUM', enumValues: ['OPEN', 'PAID'] }] },
]
const pages: FullstackPageDef[] = [
  { id: 'desk', type: 'dashboard', title: 'Desk', widgets: [{ kind: 'kpi', entity: 'Order' }] },
  { id: 'orders', type: 'entity-list', entity: 'Order' },
]

function Harness() {
  const [layout, setLayout] = useState(pages)
  return (
    <PagesSection
      pages={layout}
      entities={entities}
      validation={validatePages(layout, entities)}
      onChange={setLayout}
      pushUndo={() => {}}
      onClear={() => setLayout([])}
    />
  )
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('fullstack:designerTour', 'done')
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
})

describe('Layout designer in Hebrew', () => {
  it('speaks Hebrew, while the canvas of an English model stays left to right', async () => {
    await setLang('he')
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'פתח את המעצב' }))
    const designer = screen.getByRole('dialog', { name: 'מעצב הפריסה' })
    expect(document.documentElement.dir).toBe('rtl')

    // The header's view switch and the canvas mode are in Hebrew.
    const views = within(designer).getByRole('radiogroup', { name: 'תצוגה' })
    expect(within(views).getByRole('radio', { name: 'עיצוב' }).getAttribute('aria-checked')).toBe('true')
    expect(within(views).getByRole('radio', { name: 'מפת אתר' })).toBeTruthy()
    expect(within(designer).getByRole('radiogroup', { name: 'מצב הקנבס' })).toBeTruthy()

    // The model is English: its canvas reads left to right inside the right-to-left page.
    const canvas = designer.querySelector('[data-layout-preview]') as HTMLElement
    expect(canvas.getAttribute('dir')).toBe('ltr')
  })

  it('follows a switch back to English without closing', async () => {
    await setLang('he')
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'פתח את המעצב' }))
    await act(() => setLang('en'))
    expect(screen.getByRole('dialog', { name: 'Layout designer' })).toBeTruthy()
    expect(document.documentElement.dir).toBe('ltr')
  })
})
