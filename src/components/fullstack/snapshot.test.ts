import { describe, it, expect } from 'vitest'
import { EXPORT_FORMAT, isSnapshot, makeSnapshot, parseExportedModel, toExportedModel, type FullstackSnapshot } from './snapshot'

const snapshot: FullstackSnapshot = {
  meta: {
    groupId: 'com.menora', artifactId: 'shop', packageName: 'com.menora.shop', domainPackage: '',
    bootVersion: '3.2.1', javaVersion: '21', dashboardTitle: '', dashboardOverview: '',
  },
  entities: [
    { uid: 'e1', name: 'Order', fields: [{ uid: 'f1', name: 'id', type: 'LONG', primaryKey: true, generated: true }] },
  ],
  selectedDeps: ['data-jpa', 'web'],
  scaffoldOpts: ['audit'],
  backendSet: 'spring-jpa-crud',
  frontendSet: 'react-tailwind-crud',
  colorPalette: 'menora-digital',
}

describe('snapshot export / import', () => {
  it('exports a uid-free snapshot with a format marker and reads it back identically', () => {
    const exported = toExportedModel(snapshot)
    expect(exported.format).toBe(EXPORT_FORMAT)
    expect(JSON.stringify(exported)).not.toContain('"uid"')
    const result = parseExportedModel(JSON.stringify(exported, null, 2))
    expect('snapshot' in result && result.snapshot).toEqual(makeSnapshot(snapshot))
  })

  it('accepts a bare snapshot without the marker (e.g. copied from a preset) and keeps the palette', () => {
    const result = parseExportedModel(JSON.stringify(makeSnapshot(snapshot)))
    expect('snapshot' in result && result.snapshot.colorPalette).toBe('menora-digital')
  })

  it('rejects malformed input with a readable message instead of throwing', () => {
    expect(parseExportedModel('{not json')).toEqual({ error: 'Not valid JSON' })
    const wrong = parseExportedModel(JSON.stringify({ meta: {}, entities: 'nope' }))
    expect('error' in wrong && wrong.error).toMatch(/Not a fullstack model file/)
  })

  it('treats colorPalette as optional so older presets and links still validate', () => {
    const { colorPalette: _p, ...legacy } = snapshot
    expect(isSnapshot(legacy)).toBe(true)
    expect(isSnapshot({ ...legacy, colorPalette: 42 })).toBe(false)
    expect(makeSnapshot(legacy)).not.toHaveProperty('colorPalette')
  })
})
