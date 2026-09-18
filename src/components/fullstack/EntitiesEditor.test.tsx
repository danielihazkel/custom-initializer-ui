import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { EntitiesEditor } from './EntitiesEditor'
import { validateEntities } from './validation'
import { withUids } from './uid'
import type { FullstackEntityDef } from '../../types'

const base: FullstackEntityDef[] = withUids([
  {
    name: 'User',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true, generated: true },
      { name: 'email', type: 'STRING', required: true, unique: true, length: 200 },
      { name: 'active', type: 'BOOLEAN' },
    ],
  },
])

/** Renders the editor as a controlled component so a test can read what a click produced. */
function renderEditor(entities: FullstackEntityDef[], over: Partial<Parameters<typeof EntitiesEditor>[0]> = {}) {
  const onChange = vi.fn()
  const errors = validateEntities(entities).entities
  const utils = render(<EntitiesEditor entities={entities} onChange={onChange} errors={errors} {...over} />)
  return { onChange, ...utils }
}

describe('EntitiesEditor — duplicate', () => {
  it('uniquifies a duplicated entity name so duplicating twice never collides', () => {
    const first = renderEditor(base)
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate entity' }))
    const afterOne = first.onChange.mock.calls[0][0] as FullstackEntityDef[]
    expect(afterOne.map(e => e.name)).toEqual(['User', 'UserCopy'])
    expect(afterOne[1].tableName).toBeUndefined()
    first.unmount()

    const second = renderEditor(afterOne)
    fireEvent.click(screen.getAllByRole('button', { name: 'Duplicate entity' })[0])
    const afterTwo = second.onChange.mock.calls[0][0] as FullstackEntityDef[]
    expect(afterTwo.map(e => e.name)).toEqual(['User', 'UserCopy2', 'UserCopy'])
    expect(validateEntities(afterTwo).count).toBe(0)
  })

  it('uniquifies a duplicated field name against the entity\'s fields', () => {
    const withCopy: FullstackEntityDef[] = withUids([{
      ...base[0],
      fields: [...base[0].fields, { name: 'emailCopy', type: 'STRING' }],
    }])
    const { onChange } = renderEditor(withCopy)
    // Duplicate "email" (the second row).
    fireEvent.click(screen.getAllByRole('button', { name: 'Duplicate field' })[1])
    const next = onChange.mock.calls[0][0] as FullstackEntityDef[]
    expect(next[0].fields.map(f => f.name)).toEqual(['id', 'email', 'emailCopy2', 'active', 'emailCopy'])
    expect(validateEntities(next).count).toBe(0)
  })
})

describe('EntitiesEditor — list views', () => {
  it('disables the last remaining view instead of silently ignoring the click', () => {
    const { onChange } = renderEditor(base)
    const group = screen.getByRole('group', { name: 'List views' })
    const table = within(group).getByRole('button', { name: 'Table' })
    expect(table.getAttribute('aria-pressed')).toBe('true')
    expect((table as HTMLButtonElement).disabled).toBe(true)
    expect(table.getAttribute('title')).toBe('At least one view is required')
    fireEvent.click(table)
    expect(onChange).not.toHaveBeenCalled()
    // Adding a second view is still allowed…
    fireEvent.click(within(group).getByRole('button', { name: 'Cards' }))
    expect((onChange.mock.calls[0][0] as FullstackEntityDef[])[0].listViews).toEqual(['table', 'cards'])
  })
})

describe('EntitiesEditor — SELECT view', () => {
  it('lives in Settings; ticking it opens the query as a pending hint, not a red banner', () => {
    // A client-supplied key: a view may not have a *generated* one, and that rule stays red.
    const plainKey: FullstackEntityDef[] = withUids([{ name: 'Report', fields: [{ name: 'code', type: 'STRING', primaryKey: true }, { name: 'total', type: 'LONG' }] }])
    const { onChange } = renderEditor(plainKey)
    fireEvent.click(screen.getByRole('button', { name: /Settings/ }))
    fireEvent.click(screen.getByLabelText('SELECT-backed view'))
    const next = onChange.mock.calls[0][0] as FullstackEntityDef[]
    expect(next[0].viewQuery).toBe('')
    // Re-render with the new state (the parent owns it) and its validation.
    const { container } = renderEditor(next)
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="View SELECT query"]')!
    expect(textarea).toBeTruthy()
    expect(textarea.getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('[data-pending]')).toBeTruthy()
    // The error is counted (badge) but not shown as a red banner.
    expect(container.querySelector('[data-error]')).toBeNull()
    expect(screen.getAllByTitle(/issue.* on this entity/).length).toBeGreaterThan(0)
  })
})

describe('EntitiesEditor — density and field chips', () => {
  it('moves Lock / Search / Filter into the More panel and shows set values as chips', () => {
    const entities: FullstackEntityDef[] = withUids([{
      ...base[0],
      fields: [
        base[0].fields[0],
        { name: 'email', type: 'STRING', required: true, length: 200, readOnly: true, searchable: false },
        { name: 'active', type: 'BOOLEAN', filterable: false },
      ],
    }])
    const { container, onChange } = renderEditor(entities, { density: 'compact' })
    // Compact: no Label column.
    expect(screen.queryByLabelText('Display label')).toBeNull()
    expect(container.querySelectorAll('[data-field-chips]').length).toBe(2)
    expect(container.textContent).toContain('len 200')
    expect(container.textContent).toContain('locked')
    expect(container.textContent).toContain('no search')
    expect(container.textContent).toContain('no filter')
    // A chip opens the More panel, which carries the moved controls.
    fireEvent.click(screen.getByRole('button', { name: 'locked' }))
    const panel = container.querySelector('[data-field-more]')!
    expect(panel).toBeTruthy()
    expect(within(panel as HTMLElement).getByLabelText('Locked after create')).toBeTruthy()
    expect(within(panel as HTMLElement).getByLabelText('Include in search')).toBeTruthy()
    expect(within(panel as HTMLElement).getByLabelText('Display label')).toBeTruthy()
    fireEvent.click(within(panel as HTMLElement).getByLabelText('Locked after create'))
    expect((onChange.mock.calls[0][0] as FullstackEntityDef[])[0].fields[1].readOnly).toBeUndefined()
  })

  it('keeps the Label column in comfortable density', () => {
    renderEditor(base)
    expect(screen.getAllByLabelText('Display label').length).toBe(3)
  })
})

describe('EntitiesEditor — outline filter, lint badge and preview', () => {
  const two: FullstackEntityDef[] = withUids([base[0], { name: 'Order', fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }, { name: 'total', type: 'BIG_DECIMAL' }] }])

  it('renders only the entities in visibleUids and says so when nothing matches', () => {
    const { container, rerender, onChange } = renderEditor(two, { visibleUids: new Set([two[1].uid!]) })
    expect(container.querySelectorAll('[data-entity-index]').length).toBe(1)
    expect(screen.getByDisplayValue('Order')).toBeTruthy()
    rerender(<EntitiesEditor entities={two} onChange={onChange} visibleUids={new Set()} />)
    expect(container.querySelector('[data-no-match]')).toBeTruthy()
  })

  it('shows an amber suggestions badge that asks the parent to open the panel', () => {
    const onShowLint = vi.fn()
    renderEditor(two, { lintCounts: new Map([[two[1].uid!, 2]]), onShowLint })
    fireEvent.click(screen.getByRole('button', { name: '2 suggestions for Order' }))
    expect(onShowLint).toHaveBeenCalledWith(two[1].uid)
  })

  it('opens the UI preview for one entity with the generated labels and RTL direction', () => {
    const { container } = renderEditor(two, { previewCtx: { locale: 'he', rtl: true } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Preview UI' })[0])
    const preview = container.querySelector('[data-ui-preview]')!
    expect(preview).toBeTruthy()
    expect(preview.getAttribute('dir')).toBe('rtl')
    expect(preview.textContent).toContain('User חדש')
    expect(preview.textContent).toContain('Email')
    expect(preview.querySelector('[data-preview-field="email"]')).toBeTruthy()
    expect(preview.querySelector('[data-preview-field="id"]')).toBeNull()
  })
})
