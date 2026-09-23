import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FullstackExampleForm } from './FullstackExampleForm'
import type { ExampleDraft } from './FullstackExamplesTab'

const entities = [{ name: 'Item', fields: [{ name: 'id', type: 'LONG', primaryKey: true }, { name: 'name', type: 'STRING' }] }]

function renderForm(patch: Partial<ExampleDraft>) {
  const onChange = vi.fn()
  const data = {
    exampleId: 'shop', name: 'Shop', description: '', icon: '', enabled: true, sortOrder: 0,
    entitiesText: JSON.stringify(entities), pagesText: '', settingsText: '', ...patch,
  } as ExampleDraft
  render(<FullstackExampleForm data={data} errors={{}} onChange={onChange} teamModels={[]} onImportTeamModel={async () => {}} />)
  return onChange
}

describe('FullstackExampleForm pages', () => {
  it('edits the layout visually and writes it back as JSON', () => {
    const onChange = renderForm({})
    fireEvent.click(screen.getByRole('button', { name: /Start from my entities/ }))
    const written = onChange.mock.calls[onChange.mock.calls.length - 1][0].pagesText as string
    expect(JSON.parse(written).map((p: { id: string }) => p.id)).toEqual(['dashboard', 'item'])
  })

  it('shows the stored layout', () => {
    renderForm({ pagesText: JSON.stringify([{ id: 'items', type: 'entity-list', entity: 'Item' }]) })
    expect(document.querySelector('[data-page-id="items"]')).toBeTruthy()
  })

  it('asks for the JSON editor when the entities are broken', () => {
    renderForm({ entitiesText: '[' })
    expect(document.querySelector('[data-pages-visual-unavailable]')?.textContent).toContain('not valid JSON')
    fireEvent.click(screen.getByRole('radio', { name: 'JSON' }))
    expect(screen.getByLabelText('Pages (JSON)')).toBeTruthy()
  })
})
