import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DependencySelector } from './DependencySelector'
import type { DependencySelectorProps, InitializrMetadata } from '../types'

vi.mock('framer-motion', async () => {
  const React = await import('react')
  const passthrough = (tag: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.forwardRef((props: any, ref) => {
      const { initial: _i, animate: _a, exit: _e, transition: _t, layout: _l, variants: _v, ...rest } = props
      return React.createElement(tag, { ...rest, ref })
    })
  return {
    motion: new Proxy({}, { get: (_t, tag: string) => passthrough(tag) }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  }
})

const dep = (id: string, name: string, description = '') => ({ id, name, description })

const metadata = {
  dependencies: {
    values: [
      { name: 'Web', values: [dep('web', 'Spring Web', 'Build web applications with Spring MVC'), dep('webflux', 'Spring Reactive Web')] },
      { name: 'Data', values: [dep('data-jpa', 'Spring Data JPA', 'Persist data in SQL stores'), dep('postgresql', 'PostgreSQL Driver')] },
      { name: 'Messaging', values: [dep('kafka', 'Spring for Apache Kafka')] },
    ],
  },
} as unknown as InitializrMetadata

function Harness(over: Partial<DependencySelectorProps>) {
  const [selected, setSelected] = useState<string[]>([])
  return (
    <>
      <output data-selected>{selected.join(',')}</output>
      <DependencySelector
        metadata={metadata}
        selected={selected}
        onChange={setSelected}
        extensions={{}}
        selectedOptions={{}}
        onOptionsChange={() => {}}
        compatibilityRules={[]}
        sqlDialects={{ postgresql: 'POSTGRESQL' }}
        sqlByDep={{}}
        onSqlByDepChange={() => {}}
        openApiCapableDeps={['web']}
        openApiByDep={{}}
        onOpenApiByDepChange={() => {}}
        soapCapableDeps={[]}
        soapByDep={{}}
        onSoapByDepChange={() => {}}
        eventsCapableDeps={['kafka']}
        {...over}
      />
    </>
  )
}

const selected = () => document.querySelector('[data-selected]')!.textContent
const search = () => screen.getByRole('searchbox', { name: 'Search dependencies' })
const cards = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[data-dep-card]')).map(i => i.dataset.depCard)

describe('DependencySelector — search and keyboard', () => {
  beforeEach(() => {
    localStorage.clear()
    // The "Popular" row asks the backend; the picker must work the same when that fails.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('finds a name by its initials and a description by its words, and marks the match', async () => {
    render(<Harness />)
    fireEvent.change(search(), { target: { value: 'sdj' } })
    await waitFor(() => expect(cards()).toEqual(['data-jpa']))
    expect(document.querySelectorAll('mark.search-hit')).toHaveLength(3)

    fireEvent.change(search(), { target: { value: 'spring mvc' } })
    await waitFor(() => expect(cards()).toEqual(['web']))

    // The id is searchable too.
    fireEvent.change(search(), { target: { value: 'webflux' } })
    await waitFor(() => expect(cards()).toEqual(['webflux']))

    fireEvent.change(search(), { target: { value: 'nothing like it' } })
    await waitFor(() => expect(screen.getByText('No results found')).toBeTruthy())
  })

  it('"/" goes to the search box; Enter adds the first result; Escape clears it', async () => {
    render(<Harness />)
    fireEvent.keyDown(document.body, { key: '/' })
    expect(document.activeElement).toBe(search())

    fireEvent.change(search(), { target: { value: 'kafka' } })
    await waitFor(() => expect(cards()).toEqual(['kafka']))
    fireEvent.keyDown(search(), { key: 'Enter' })
    expect(selected()).toBe('kafka')

    fireEvent.keyDown(search(), { key: 'Escape' })
    expect((search() as HTMLInputElement).value).toBe('')
  })

  it('walks the results with the arrows, and back up into the search box', () => {
    render(<Harness />)
    search().focus()
    fireEvent.keyDown(search(), { key: 'ArrowDown' })
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-dep-card]'))
    expect(document.activeElement).toBe(inputs[0])
    fireEvent.keyDown(inputs[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(inputs[1])
    fireEvent.keyDown(inputs[1], { key: 'ArrowUp' })
    fireEvent.keyDown(inputs[0], { key: 'ArrowUp' })
    expect(document.activeElement).toBe(search())
  })

  it('skips the dependencies of a collapsed group', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Web/, expanded: true }))
    search().focus()
    fireEvent.keyDown(search(), { key: 'ArrowDown' })
    expect((document.activeElement as HTMLInputElement).dataset.depCard).toBe('data-jpa')
  })

  it('says which dependencies have a wizard before they are selected', () => {
    render(<Harness />)
    const badge = (id: string) =>
      document.querySelector(`input[data-dep-card="${id}"]`)!.closest('label')!.querySelector('[data-wizard-badge]')?.textContent
    expect(badge('postgresql')).toContain('SQL wizard')
    expect(badge('web')).toContain('OpenAPI wizard')
    expect(badge('kafka')).toContain('AsyncAPI wizard')
    expect(badge('data-jpa')).toBeUndefined()
  })

  it('offers favourites, then recent, then popular dependencies as quick picks', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(String(url).includes('popular-deps')
        ? [{ depId: 'web', count: 9 }, { depId: 'kafka', count: 4 }, { depId: 'gone-from-the-catalog', count: 3 }]
        : []),
    })))
    render(<Harness recentDepIds={['kafka', 'data-jpa']} />)
    expect(document.querySelector('[data-quick-picks]')).toBeTruthy()

    // Star PostgreSQL: it leads the quick picks. Kafka is recent, so it is not repeated as popular.
    fireEvent.click(screen.getByRole('button', { name: 'Add PostgreSQL Driver to favourites' }))
    await waitFor(() => {
      const picks = within(document.querySelector<HTMLElement>('[data-quick-picks]')!).getAllByRole('button').map(b => b.textContent?.replace(/^(star|history|trending_up|check)/, ''))
      expect(picks).toEqual(['PostgreSQL Driver', 'Spring for Apache Kafka', 'Spring Data JPA', 'Spring Web'])
    })
    expect(JSON.parse(localStorage.getItem('depFavorites')!)).toEqual(['postgresql'])
    // Starring did not select it; picking does.
    expect(selected()).toBe('')
    fireEvent.click(within(document.querySelector<HTMLElement>('[data-quick-picks]')!).getByRole('button', { name: /Spring Web/ }))
    expect(selected()).toBe('web')

    // Quick picks step aside while searching.
    await act(async () => { fireEvent.change(search(), { target: { value: 'jpa' } }) })
    await waitFor(() => expect(document.querySelector('[data-quick-picks]')).toBeNull())
  })
})
