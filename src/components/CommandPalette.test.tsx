import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandPalette, MAX_ROWS } from './CommandPalette'
import { registerCommands, useRegisteredCommands, type PaletteAction } from '../commands'
import { useHotkeys } from '../hooks/useHotkeys'
import type { InitializrMetadata, ProjectFormValues } from '../types'

const dep = (id: string, name: string, description = '') => ({ id, name, description })

const metadata = {
  dependencies: {
    values: [
      { name: 'Web', values: [dep('web', 'Spring Web', 'Build web applications with Spring MVC'), dep('webflux', 'Spring Reactive Web')] },
      { name: 'Data', values: [dep('data-jpa', 'Spring Data JPA', 'Persist data in SQL stores'), dep('kafka', 'Spring for Apache Kafka')] },
    ],
  },
  language: { values: [{ id: 'java', name: 'Java' }], default: 'java' },
  javaVersion: { values: [{ id: '17', name: '17' }, { id: '21', name: '21' }], default: '21' },
  bootVersion: { values: [{ id: '3.2.1', name: '3.2.1' }], default: '3.2.1' },
  packaging: { values: [{ id: 'jar', name: 'Jar' }, { id: 'war', name: 'War' }], default: 'jar' },
} as unknown as InitializrMetadata

const form = { javaVersion: '21', packaging: 'jar', language: 'java', bootVersion: '3.2.1' } as unknown as ProjectFormValues

function action(id: string, title: string, run = vi.fn(), shortcut?: string): PaletteAction {
  return { id, title, icon: 'bolt', group: 'Backend', run, shortcut }
}

function renderPalette(over: Partial<React.ComponentProps<typeof CommandPalette>> = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    metadata,
    templates: [],
    form,
    selectedDeps: ['web'],
    onSelectTemplate: vi.fn(),
    onToggleDependency: vi.fn(),
    onFormChange: vi.fn(),
    actions: [action('generate', 'Generate and download the project', vi.fn(), 'Ctrl+Enter')],
    ...over,
  }
  render(<CommandPalette {...props} />)
  return props
}

const titles = () => screen.getAllByRole('option').map(el => el.querySelector('h4')?.textContent)
const type = (text: string) => fireEvent.change(screen.getByRole('combobox'), { target: { value: text } })

describe('CommandPalette', () => {
  beforeEach(() => { localStorage.clear() })

  it('groups everything under headings when nothing is typed, actions first', () => {
    renderPalette()
    expect(titles()[0]).toBe('Generate and download the project')
    expect(screen.getByText('Ctrl+Enter')).toBeTruthy()
    expect(screen.getByRole('listbox').textContent).toMatch(/Backend.*Dependencies.*Java Version/s)
    // The selected dependency is marked.
    expect(screen.getByLabelText('Selected')).toBeTruthy()
  })

  it('ranks what is typed: a name by its letters, a description by its words', () => {
    renderPalette()
    type('sdj')
    expect(titles()).toEqual(['Spring Data JPA'])
    expect(screen.getByRole('option').querySelectorAll('mark')).toHaveLength(3)

    // "web" starts "Spring Web"'s second word and is a prefix of nothing; both web starters match.
    type('web')
    expect(titles().slice(0, 2).sort()).toEqual(['Spring Reactive Web', 'Spring Web'])

    // Only in a description.
    type('sql stores')
    expect(titles()).toEqual(['Spring Data JPA'])

    type('zzz')
    expect(screen.queryByRole('option')).toBeNull()
    expect(screen.getByText(/No results found/)).toBeTruthy()
  })

  it('runs an action and closes; toggles a dependency and stays open', () => {
    const run = vi.fn()
    const props = renderPalette({ actions: [action('generate', 'Generate and download the project', run)] })
    type('generate')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })
    expect(run).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)

    type('kafka')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })
    expect(props.onToggleDependency).toHaveBeenCalledWith('kafka')
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('moves the selection with the arrows and tells assistive tech which row it is on', () => {
    renderPalette()
    const input = screen.getByRole('combobox')
    expect(input.getAttribute('aria-activedescendant')).toBe('palette-opt-0')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe('palette-opt-1')
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowUp' })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowUp' })
    // Wraps to the last row.
    expect(input.getAttribute('aria-activedescendant')).toBe(`palette-opt-${screen.getAllByRole('option').length - 1}`)
  })

  it('opens on what was used last', () => {
    const first = renderPalette()
    type('kafka')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })
    expect(first.onToggleDependency).toHaveBeenCalledWith('kafka')
    document.body.innerHTML = ''

    renderPalette()
    expect(titles()[0]).toBe('Spring for Apache Kafka')
    expect(screen.getByRole('listbox').textContent).toMatch(/^Recent/)
  })

  it('draws a screenful, not the whole catalog, and says how much more there is', () => {
    const many = {
      ...metadata,
      dependencies: { values: [{ name: 'Lots', values: Array.from({ length: 120 }, (_, i) => dep(`d${i}`, `Dependency ${i}`)) }] },
    } as unknown as InitializrMetadata
    renderPalette({ metadata: many })
    expect(screen.getAllByRole('option')).toHaveLength(MAX_ROWS)
    expect(document.querySelector('[data-palette-more]')?.textContent).toMatch(/Showing 50 of 12\d/)
    type('dependency 11')
    // 11, 110–119
    expect(screen.getAllByRole('option')).toHaveLength(11)
    expect(document.querySelector('[data-palette-more]')).toBeNull()
  })
})

describe('the command registry', () => {
  function Listed() {
    return <ul>{useRegisteredCommands().map(a => <li key={a.id}>{a.title}</li>)}</ul>
  }
  const listed = () => screen.queryAllByRole('listitem').map(li => li.textContent)

  it('merges the scopes, the app-wide ones last, and drops a scope when its owner goes', () => {
    render(<Listed />)
    let offGlobal = () => {}
    let offDeps = () => {}
    let offView = () => {}
    act(() => {
      offGlobal = registerCommands([action('go', 'Go to Frontend')], 'global')
      offDeps = registerCommands([action('search', 'Search dependencies')], 'backend-deps')
      offView = registerCommands([action('generate', 'Generate')])
    })
    expect(listed()).toEqual(['Search dependencies', 'Generate', 'Go to Frontend'])

    // A scope registered again replaces what it held; a stale disposer does nothing.
    let offDeps2 = () => {}
    act(() => {
      offDeps2 = registerCommands([action('wizard', 'Open the SQL wizard')], 'backend-deps')
      offDeps()
    })
    expect(listed()).toEqual(['Open the SQL wizard', 'Generate', 'Go to Frontend'])

    act(() => {
      offDeps2()
      offView()
      offGlobal()
    })
    expect(listed()).toEqual([])
  })
})

describe('useHotkeys', () => {
  function Keys({ onSlash, onGenerate, enabled = true }: { onSlash: () => void; onGenerate: () => void; enabled?: boolean }) {
    useHotkeys([
      { key: '/', run: onSlash },
      { key: 'Enter', ctrl: true, run: onGenerate },
    ], enabled)
    return <input aria-label="A field" />
  }

  it('fires a chord while typing, a bare key only outside a field, and nothing under a modal', () => {
    const slash = vi.fn()
    const generate = vi.fn()
    const { rerender } = render(<Keys onSlash={slash} onGenerate={generate} />)
    const field = screen.getByLabelText('A field')

    fireEvent.keyDown(field, { key: '/' })
    expect(slash).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: '/' })
    expect(slash).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(field, { key: 'Enter', ctrlKey: true })
    expect(generate).toHaveBeenCalledTimes(1)
    // Enter alone is not the chord.
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(generate).toHaveBeenCalledTimes(1)

    const modal = document.createElement('div')
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    document.body.appendChild(modal)
    fireEvent.keyDown(document.body, { key: '/' })
    fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true })
    expect(slash).toHaveBeenCalledTimes(1)
    expect(generate).toHaveBeenCalledTimes(1)
    modal.remove()

    rerender(<Keys onSlash={slash} onGenerate={generate} enabled={false} />)
    fireEvent.keyDown(document.body, { key: '/' })
    expect(slash).toHaveBeenCalledTimes(1)
  })
})
