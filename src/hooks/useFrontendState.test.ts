import { describe, it, expect, afterEach } from 'vitest'
import { buildFrontendQuery, parseFrontendUrl, type FeState } from './useFrontendState'

const state: FeState = {
  form: { projectName: 'web', description: '', scope: '', appTitle: 'Web', department: '' },
  reactVersion: '18',
  nodeVersion: '20',
  packageManager: 'pnpm',
  basePath: '/',
  selectedDeps: [],
  selectedOptions: {},
  designSystem: 'design-none',
  colorPaletteId: '',
  apiBaseUrl: '',
  backendArtifactId: '',
  rtl: false,
}

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('department in the frontend query', () => {
  it('omits a blank department (the server default)', () => {
    expect(new URLSearchParams(buildFrontendQuery(state)).has('department')).toBe(false)
  })

  it('sends a chosen department and reads it back from a share link', () => {
    const query = buildFrontendQuery({ ...state, form: { ...state.form, department: 'fin' } })
    expect(new URLSearchParams(query).get('department')).toBe('fin')

    window.history.replaceState(null, '', '/?tab=frontend&' + query)
    expect(parseFrontendUrl()?.form?.department).toBe('fin')
  })
})
