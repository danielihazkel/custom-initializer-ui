import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
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

describe('EntitiesEditor — overrides panel', () => {
  it('names the project-only flags with their project value and links to Options', () => {
    const onGoToOptions = vi.fn()
    renderEditor(base, { projectOpts: ['openapi', 'audit'], onGoToOptions })
    fireEvent.click(screen.getByRole('button', { name: /Overrides/ }))
    const note = document.querySelector('[data-project-only-opts]')!
    expect(note.textContent).toContain('OpenAPI annotations (on)')
    expect(note.textContent).toContain('Demo data (off)')
    // The overridable flags keep their select; the project-only ones have none.
    expect(screen.getByRole('combobox', { name: 'Audit timestamps override' })).toBeTruthy()
    expect(screen.queryByRole('combobox', { name: /OpenAPI/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Go to Options' }))
    expect(onGoToOptions).toHaveBeenCalledTimes(1)
  })
})

describe('EntitiesEditor — removals and type changes are undoable from the notice', () => {
  it('offers an Undo that puts the removed field back at its index with the same uid', () => {
    const onNotice = vi.fn()
    const { onChange } = renderEditor(base, { onNotice })
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove field' })[1]) // email
    const afterRemove = onChange.mock.calls[0][0] as FullstackEntityDef[]
    expect(afterRemove[0].fields.map(f => f.name)).toEqual(['id', 'active'])
    expect(onNotice).toHaveBeenCalledWith('Removed field email from User', expect.objectContaining({ label: 'Undo' }))
    ;(onNotice.mock.calls[0][1] as { onClick: () => void }).onClick()
    const restored = onChange.mock.calls[1][0] as FullstackEntityDef[]
    expect(restored[0].fields.map(f => f.name)).toEqual(['id', 'email', 'active'])
    expect(restored[0].fields[1].uid).toBe(base[0].fields[1].uid)
  })

  // The Undo closures re-insert into the list as it is when clicked, so these run the editor
  // with real state rather than a mock onChange.
  function Stateful({ initial, onNotice }: { initial: FullstackEntityDef[]; onNotice: (m: string, a?: { label: string; onClick: () => void }) => void }) {
    const [entities, setEntities] = useState(initial)
    return <EntitiesEditor entities={entities} onChange={setEntities} errors={validateEntities(entities).entities} onNotice={onNotice} />
  }

  it('offers an Undo on entity removal and names what a type change cleared', () => {
    const onNotice = vi.fn()
    render(<Stateful initial={base} onNotice={onNotice} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove entity' }))
    expect(screen.queryAllByLabelText('Entity name')).toHaveLength(0)
    expect(onNotice).toHaveBeenCalledWith('Removed entity User', expect.objectContaining({ label: 'Undo' }))
    act(() => { (onNotice.mock.calls[0][1] as { onClick: () => void }).onClick() })
    expect((screen.getByLabelText('Entity name') as HTMLInputElement).value).toBe('User')

    onNotice.mockClear()
    fireEvent.change(screen.getAllByLabelText('Field type')[1], { target: { value: 'LONG' } }) // email: STRING len 200
    expect((screen.getAllByLabelText('Field type')[1] as HTMLSelectElement).value).toBe('LONG')
    expect(onNotice).toHaveBeenCalledWith('Changed email to LONG — cleared length 200', expect.objectContaining({ label: 'Undo' }))
    act(() => { (onNotice.mock.calls[0][1] as { onClick: () => void }).onClick() })
    expect((screen.getAllByLabelText('Field type')[1] as HTMLSelectElement).value).toBe('STRING')
  })

  it('creates a join entity after the owner from the relations header', () => {
    const two = withUids([base[0], { name: 'Role', fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }, { name: 'name', type: 'STRING' }] }])
    const onRowAdded = vi.fn()
    const { onChange } = renderEditor(two, { onRowAdded })
    fireEvent.click(screen.getAllByRole('button', { name: 'Add a join entity…' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    const next = onChange.mock.calls[0][0] as FullstackEntityDef[]
    expect(next.map(e => e.name)).toEqual(['User', 'UserRole', 'Role'])
    expect(next[1].relations?.map(r => r.targetEntity)).toEqual(['User', 'Role'])
    expect(onRowAdded).toHaveBeenCalledWith(next[1].uid)
  })
})
