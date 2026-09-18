import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useFullstackPresets } from './useFullstackPresets'
import { DEFAULT_PROJECT_META, type FullstackSnapshot } from '../components/fullstack/snapshot'

const snapshot: FullstackSnapshot = {
  meta: { ...DEFAULT_PROJECT_META, artifactId: 'billing' },
  entities: [{ name: 'Invoice', fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }] }],
  selectedDeps: ['web'], scaffoldOpts: [], backendSet: 'spring-jpa-crud', frontendSet: 'react-tailwind-crud',
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('useFullstackPresets', () => {
  it('saves a preset, reports it persisted, and can delete + restore it at its old position', () => {
    const { result } = renderHook(() => useFullstackPresets())
    let saved!: ReturnType<typeof result.current.savePreset>
    act(() => { saved = result.current.savePreset('First', snapshot) })
    act(() => { result.current.savePreset('Second', snapshot) })
    expect(saved.persisted).toBe(true)
    expect(result.current.presets.map(p => p.name)).toEqual(['Second', 'First'])
    expect(result.current.persistFailed).toBe(false)

    let removed!: ReturnType<typeof result.current.deletePreset>
    act(() => { removed = result.current.deletePreset(saved.preset.id) })
    expect(removed?.index).toBe(1)
    expect(result.current.presets.map(p => p.name)).toEqual(['Second'])
    act(() => { result.current.restorePreset(removed!.preset, removed!.index) })
    expect(result.current.presets.map(p => p.name)).toEqual(['Second', 'First'])
    // Restoring twice is a no-op.
    act(() => { result.current.restorePreset(removed!.preset, removed!.index) })
    expect(result.current.presets).toHaveLength(2)
    expect(result.current.deletePreset('nope')).toBeNull()
  })

  it('says so when localStorage refuses the write instead of pretending the save stuck', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    const { result } = renderHook(() => useFullstackPresets())
    let saved!: ReturnType<typeof result.current.savePreset>
    act(() => { saved = result.current.savePreset('Big', snapshot) })
    expect(saved.persisted).toBe(false)
    // Still listed for the session…
    expect(result.current.presets.map(p => p.name)).toEqual(['Big'])
    // …and the hook flags that persistence is failing.
    expect(result.current.persistFailed).toBe(true)
  })
})
