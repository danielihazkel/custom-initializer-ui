import { describe, it, expect } from 'vitest'
import { frontendSetDefaults } from './frontendSetDefaults'
import type { EntityTemplateSetSummary } from '../../types'

const set = (designSystem: EntityTemplateSetSummary['designSystem']): EntityTemplateSetSummary => ({
  setKey: 'x', name: 'X', description: null, kind: 'FRONTEND_REACT', defaultDeps: [],
  designSystem, bootVersion: null, javaVersion: null, defaultPaletteId: null,
})

describe('frontendSetDefaults', () => {
  it('turns on Hebrew + RTL for the Menora Digital set only', () => {
    expect(frontendSetDefaults(set('MENORA_DIGITAL'))).toEqual({ locale: 'he', rtl: true })
    expect(frontendSetDefaults(set('TAILWIND'))).toEqual({})
    expect(frontendSetDefaults(undefined)).toEqual({})
  })
})
