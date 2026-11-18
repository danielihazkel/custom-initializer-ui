import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useProjectState } from './useProjectState'
import { decodeBackendShare, encodeBackendShare } from '../utils/backendShare'
import type { InitializrMetadata } from '../types'

const metadata: InitializrMetadata = {
  bootVersion:  { values: [{ id: '3.3.0', name: '3.3.0' }], default: '3.3.0' },
  javaVersion:  { values: [{ id: '17', name: '17' }], default: '17' },
  language:     { values: [{ id: 'kotlin', name: 'Kotlin' }], default: 'kotlin' },
  packaging:    { values: [{ id: 'war', name: 'War' }], default: 'war' },
  type:         { values: [{ id: 'gradle-project', name: 'Gradle' }], default: 'gradle-project' },
  dependencies: { values: [{ name: 'Web', values: [{ id: 'web', name: 'Spring Web' }, { id: 'data-jpa', name: 'JPA' }] }] },
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useProjectState — server defaults on first load', () => {
  it('applies the catalog defaults for a first-time visitor (no saved form, no share URL)', () => {
    const { result, rerender } = renderHook(
      ({ md }: { md: InitializrMetadata | null }) => useProjectState(md),
      { initialProps: { md: null as InitializrMetadata | null } },
    )
    expect(result.current.form.language).toBe('java')

    rerender({ md: metadata })

    expect(result.current.form.language).toBe('kotlin')
    expect(result.current.form.type).toBe('gradle-project')
    expect(result.current.form.packaging).toBe('war')
    expect(result.current.form.bootVersion).toBe('3.3.0')
  })

  it('keeps a returning visitor\'s saved form (only backfills missing versions)', () => {
    localStorage.setItem('formValues', JSON.stringify({
      groupId: 'com.acme', artifactId: 'shop', name: 'shop', description: '',
      packageName: 'com.acme.shop', bootVersion: '', language: 'java',
      type: 'maven-project', packaging: 'jar', javaVersion: '21',
    }))

    const { result, rerender } = renderHook(
      ({ md }: { md: InitializrMetadata | null }) => useProjectState(md),
      { initialProps: { md: null as InitializrMetadata | null } },
    )
    rerender({ md: metadata })

    expect(result.current.form.language).toBe('java')
    expect(result.current.form.groupId).toBe('com.acme')
    expect(result.current.form.bootVersion).toBe('3.3.0')
  })

  it('merges a saved form of an older shape over the defaults instead of using it raw', () => {
    localStorage.setItem('formValues', JSON.stringify({ groupId: 'com.acme' }))

    const { result } = renderHook(() => useProjectState(null))

    expect(result.current.form.groupId).toBe('com.acme')
    expect(result.current.form.artifactId).toBe('demo')
    expect(result.current.form.packageName).toBe('com.menora.demo')
  })

  it('survives a corrupt localStorage value', () => {
    localStorage.setItem('formValues', '{not json')
    localStorage.setItem('selectedDeps', '"nope"')

    const { result } = renderHook(() => useProjectState(null))

    expect(result.current.form.artifactId).toBe('demo')
    expect(result.current.selected).toEqual([])
  })
})

describe('useProjectState — share links', () => {
  it('does not mix this browser\'s wizard/multi-module state into a shared link', () => {
    localStorage.setItem('sqlByDep', JSON.stringify({ 'data-jpa': { sql: 'CREATE TABLE t (id INT);', subPackage: 'domain', tables: [] } }))
    localStorage.setItem('multiModuleEnabled', 'true')
    localStorage.setItem('selectedModules', JSON.stringify(['api']))
    window.history.replaceState(null, '', '/?groupId=com.shared&artifactId=x&dependencies=data-jpa,web')

    const { result } = renderHook(() => useProjectState(null))

    expect(result.current.form.groupId).toBe('com.shared')
    expect(result.current.selected).toEqual(['data-jpa', 'web'])
    expect(result.current.sqlByDep).toEqual({})
    expect(result.current.multiModuleEnabled).toBe(false)
    expect(result.current.selectedModules).toEqual([])
  })

  const sharedSnapshot = (extra: Record<string, unknown> = {}) => ({
    form: { groupId: 'com.shared', artifactId: 'x' },
    selected: ['data-jpa', 'web'],
    selectedOptions: {},
    sqlByDep: { 'data-jpa': { sql: 'CREATE TABLE t (id INT);', subPackage: 'domain', tables: [] } },
    openApiByDep: {},
    soapByDep: {},
    multiModuleEnabled: true,
    selectedModules: ['api', 'core'],
    ...extra,
  })

  it('reads the modules and wizard documents a link carries in `bs`', () => {
    window.history.replaceState(null, '', `/?groupId=com.shared&artifactId=x&dependencies=data-jpa,web&bs=${encodeBackendShare(sharedSnapshot() as never)}`)

    const { result } = renderHook(() => useProjectState(null))

    expect(result.current.multiModuleEnabled).toBe(true)
    expect(result.current.selectedModules).toEqual(['api', 'core'])
    expect(result.current.sqlByDep['data-jpa'].sql).toBe('CREATE TABLE t (id INT);')
  })

  it('lets the plain parameters of a hand-edited link win, and drops documents of dependencies it no longer selects', () => {
    window.history.replaceState(null, '', `/?groupId=com.edited&artifactId=y&dependencies=web&bs=${encodeBackendShare(sharedSnapshot() as never)}`)

    const { result } = renderHook(() => useProjectState(null))

    expect(result.current.form.groupId).toBe('com.edited')
    expect(result.current.selected).toEqual(['web'])
    expect(result.current.sqlByDep).toEqual({})
    expect(result.current.selectedModules).toEqual(['api', 'core'])
  })

  it('writes `bs` only for a setup the plain parameters cannot carry, and says when it is too long', () => {
    const { result } = renderHook(() => useProjectState(metadata))
    act(() => { vi.advanceTimersByTime(400) })
    expect(new URLSearchParams(window.location.search).has('bs')).toBe(false)

    act(() => {
      result.current.handleDepsChange(['data-jpa'])
      result.current.setSelectedModules(['api'])
    })
    act(() => { result.current.handleSqlByDepChange('data-jpa', { sql: 'CREATE TABLE t (id INT);', subPackage: 'domain', tables: [] } as never) })
    act(() => { vi.advanceTimersByTime(400) })
    const carried = decodeBackendShare(new URLSearchParams(window.location.search).get('bs') ?? '')
    expect(carried?.sqlByDep['data-jpa'].sql).toBe('CREATE TABLE t (id INT);')
    expect(result.current.shareStatus).toBe('written')

    act(() => { result.current.handleSqlByDepChange('data-jpa', { sql: 'x'.repeat(70_000), subPackage: 'domain', tables: [] } as never) })
    act(() => { vi.advanceTimersByTime(400) })
    const params = new URLSearchParams(window.location.search)
    expect(params.has('bs')).toBe(false)
    expect(params.get('dependencies')).toBe('data-jpa')
    expect(result.current.shareStatus).toBe('too-large')
  })
})

describe('useProjectState — persistence', () => {
  it('debounces localStorage writes and drops wizard payloads of deselected deps', () => {
    const { result } = renderHook(() => useProjectState(metadata))

    act(() => {
      result.current.handleDepsChange(['web', 'data-jpa'])
    })
    act(() => {
      result.current.handleSqlByDepChange('data-jpa', { sql: 'x', subPackage: 'd', tables: [] })
    })
    expect(localStorage.getItem('selectedDeps')).toBeNull()

    act(() => { vi.advanceTimersByTime(400) })
    expect(JSON.parse(localStorage.getItem('selectedDeps')!)).toEqual(['web', 'data-jpa'])
    expect(Object.keys(JSON.parse(localStorage.getItem('sqlByDep')!))).toEqual(['data-jpa'])

    act(() => {
      result.current.handleDepsChange(['web'])
    })
    expect(result.current.sqlByDep).toEqual({})
  })
})

describe('useProjectState — wizard entries across a reload', () => {
  it('keeps the options a wizard saved, and reads an entry of an older shape', () => {
    // What the drawers save today…
    localStorage.setItem('selectedDeps', JSON.stringify(['web', 'data-jpa']))
    localStorage.setItem('openApiByDep', JSON.stringify({
      web: { spec: 's', apiSubPackage: 'api', dtoSubPackage: 'dto', clientSubPackage: 'client', mode: 'BOTH',
        baseUrlProperty: 'p', clientKind: 'restClient', copySpec: true, apiStyle: 'interfaces' },
      // …and an entry saved before the client kind existed.
      old: { spec: 'o' },
    }))
    localStorage.setItem('eventsByDep', JSON.stringify({
      // (keyed by a dependency this test's catalog has)
      'data-jpa': { spec: 'asyncapi: 3.0.0', groupId: 'billing', generateTests: true,
        channels: [{ name: 'orders', produce: true }, { nope: 1 }] },
    }))
    const { result } = renderHook(() => useProjectState(metadata))

    // The client kind and the spec copy used to be dropped here, so a reload undid them.
    expect(result.current.openApiByDep.web).toMatchObject({ clientKind: 'restClient', copySpec: true, apiStyle: 'interfaces' })
    expect(result.current.openApiByDep.old).toEqual({
      spec: 'o', apiSubPackage: 'api', dtoSubPackage: 'dto', clientSubPackage: 'client',
      mode: 'CONTROLLERS', baseUrlProperty: 'openapi.client.base-url',
    })
    expect(result.current.eventsByDep['data-jpa']).toEqual({
      spec: 'asyncapi: 3.0.0', subPackage: 'events', payloadSubPackage: 'events.model', groupId: 'billing',
      channels: [{ name: 'orders', produce: true, consume: false }], generateTests: true,
    })

    // Deselecting the dependency drops its entry, like the other wizards'.
    act(() => { result.current.handleDepsChange(['web']) })
    expect(result.current.eventsByDep).toEqual({})
    act(() => { result.current.handleEventsByDepChange('data-jpa', null) })
    expect(result.current.eventsByDep).toEqual({})
  })
})
