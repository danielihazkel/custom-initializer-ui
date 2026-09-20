import { describe, it, expect } from 'vitest'
import { describeSetup, type DescribeSetupInput } from './setupSummary'
import type { ProjectMeta } from './snapshot'

const meta: ProjectMeta = {
  groupId: 'com.menora', artifactId: 'billing', name: '', description: '',
  packageName: 'com.menora.billing', domainPackage: '', version: '',
  javaVersion: '21', bootVersion: '3.5.0', packaging: 'jar',
  dashboardTitle: '', dashboardOverview: '', locale: 'en',
} as ProjectMeta

const base: DescribeSetupInput = {
  meta,
  backendSet: 'spring-jpa-crud',
  frontendSet: 'react-tailwind-crud',
  currentBackendSet: { setKey: 'spring-jpa-crud', name: 'Spring JPA CRUD' } as never,
  currentFrontendSet: { setKey: 'react-tailwind-crud', name: 'React + Tailwind' } as never,
  palettes: [{ id: 'menora-default', name: 'Menora', primary: '#9A83F7' } as never],
  effectivePalette: 'menora-default',
  paletteIsExplicit: false,
  selectedDeps: ['web', 'data-jpa'],
  scaffoldOpts: [],
}

const keys = (input: DescribeSetupInput) => describeSetup(input).map(c => c.key)
const chip = (input: DescribeSetupInput, key: string) => describeSetup(input).find(c => c.key === key)

describe('describeSetup', () => {
  it('names the coordinates, versions, both template sets and the dependency count', () => {
    expect(keys(base)).toEqual(['coords', 'versions', 'backendSet', 'frontendSet', 'deps'])
    expect(chip(base, 'coords')?.label).toBe('com.menora:billing')
    expect(chip(base, 'versions')?.label).toBe('Java 21 · Boot 3.5.0')
    expect(chip(base, 'backendSet')?.label).toBe('Spring JPA CRUD')
    expect(chip(base, 'deps')?.label).toBe('2 dependencies')
  })

  it('carries the effective palette colour as the frontend chip swatch', () => {
    expect(chip(base, 'frontendSet')?.swatch).toBe('#9A83F7')
    expect(chip(base, 'frontendSet')?.title).toContain('(set default)')
    expect(chip({ ...base, paletteIsExplicit: true }, 'frontendSet')?.title).not.toContain('(set default)')
  })

  it('falls back to the set key when the catalog has not loaded the set', () => {
    const bare = { ...base, currentBackendSet: undefined, currentFrontendSet: undefined }
    expect(chip(bare, 'backendSet')?.label).toBe('spring-jpa-crud')
    expect(chip(bare, 'frontendSet')?.label).toBe('react-tailwind-crud')
  })

  it('only shows a language chip when it is not the English default', () => {
    expect(keys(base)).not.toContain('locale')
    const he = { ...base, meta: { ...meta, locale: 'he' } as ProjectMeta }
    expect(chip(he, 'locale')?.label).toBe('עברית')
  })

  it('only shows an options chip when some option is on, and lists them in the tooltip', () => {
    expect(keys(base)).not.toContain('opts')
    const opted = { ...base, scaffoldOpts: ['audit', 'csvExport'] }
    expect(chip(opted, 'opts')?.label).toBe('2 options')
    expect(chip(opted, 'opts')?.title).toBe('audit, csvExport')
  })

  it('singularises the counts and survives an empty selection', () => {
    const one = { ...base, selectedDeps: ['web'], scaffoldOpts: ['audit'] }
    expect(chip(one, 'deps')?.label).toBe('1 dependency')
    expect(chip(one, 'opts')?.label).toBe('1 option')
    const none = { ...base, selectedDeps: [] }
    expect(chip(none, 'deps')?.label).toBe('0 dependencies')
    expect(chip(none, 'deps')?.title).toBe('No dependencies selected')
  })

  it('renders placeholders rather than a bare colon for unset coordinates', () => {
    const blank = { ...base, meta: { ...meta, groupId: '', artifactId: '' } as ProjectMeta }
    expect(chip(blank, 'coords')?.label).toBe('—:—')
  })

  it('points every chip at a section that lives inside the Setup panel', () => {
    const targets = new Set(describeSetup({ ...base, scaffoldOpts: ['audit'], meta: { ...meta, locale: 'he' } as ProjectMeta }).map(c => c.target))
    expect([...targets].every(t => ['fs-meta', 'fs-backend', 'fs-frontend', 'fs-options', 'fs-deps'].includes(t))).toBe(true)
  })
})
