import { describe, expect, it } from 'vitest'
import type { ProjectSnapshot } from '../types'
import { carriesMoreThanParams, decodeBackendShare, encodeBackendShare, parseProjectSnapshot } from './backendShare'

const plain: ProjectSnapshot = {
  form: { groupId: 'com.menora', artifactId: 'shop' } as ProjectSnapshot['form'],
  selected: ['web'],
  selectedOptions: { web: ['x'] },
  sqlByDep: {},
  openApiByDep: {},
  soapByDep: {},
  multiModuleEnabled: false,
  selectedModules: [],
}

describe('backendShare', () => {
  it('round-trips a snapshot, non-ASCII text included', () => {
    const s = { ...plain, form: { ...plain.form, description: 'שירות הזמנות' } }
    expect(decodeBackendShare(encodeBackendShare(s))).toEqual(s)
  })

  it('needs the encoded state only for modules or wizard documents', () => {
    expect(carriesMoreThanParams(plain)).toBe(false)
    // Modules picked but the toggle off carry nothing.
    expect(carriesMoreThanParams({ ...plain, selectedModules: ['api'] })).toBe(false)
    expect(carriesMoreThanParams({ ...plain, multiModuleEnabled: true, selectedModules: ['api'] })).toBe(true)
    expect(carriesMoreThanParams({ ...plain, openApiByDep: { web: {} as never } })).toBe(true)
    expect(carriesMoreThanParams({ ...plain, eventsByDep: { kafka: {} as never } })).toBe(true)
  })

  it('refuses what is not a snapshot and cleans what is', () => {
    expect(decodeBackendShare('not base64 at all!')).toBeNull()
    expect(parseProjectSnapshot({ selected: [] })).toBeNull()
    expect(parseProjectSnapshot({ form: {}, selected: 'web' })).toBeNull()
    expect(parseProjectSnapshot({
      form: { groupId: 'g', evil: 1 },
      selected: ['web', 3],
      selectedOptions: { web: ['a', null] },
      sqlByDep: [],
      multiModuleEnabled: 'yes',
      selectedModules: ['api', {}],
    })).toEqual({
      form: { groupId: 'g' },
      selected: ['web'],
      selectedOptions: { web: ['a'] },
      sqlByDep: {},
      openApiByDep: {},
      soapByDep: {},
      multiModuleEnabled: false,
      selectedModules: ['api'],
    })
  })
})
