import { describe, it, expect } from 'vitest'
import type { DesignKitSummary, DesignKitVersion } from '../../types'
import type { FeColorPalette } from '../../hooks/useFrontendMetadata'
import { kitDefaults, kitPreviewPalette, kitRef, kitStatus, parseKitRef, pinFromRef, resolveToken } from './designKits'
import { describeSnapshotChange, isSnapshot, makeSnapshot, parseExportedModel, snapshotChangeKey, DEFAULT_PROJECT_META, REQUEST_MODEL_FORMAT, type FullstackSnapshot } from './snapshot'

const kit = (key: string, latestVersion: number | null, extra: Partial<DesignKitSummary> = {}): DesignKitSummary => ({
  key, name: key, description: null, baseSetKey: 'react-tailwind-crud', builtIn: false, enabled: true, sortOrder: 0,
  defaultPaletteId: null, clonedFrom: null, latestVersion, hasDraft: false, paletteAware: true, defaults: null, ...extra,
})
const KITS = [kit('acme', 3), kit('menora-digital', 1, { baseSetKey: 'react-menora-digital-crud', defaults: { locale: 'he', rtl: true } })]
const PALETTE: FeColorPalette = { id: 'p', name: 'P', primary: '#111111', secondary: '#222222', accent: null, error: '#ff0000', isDefault: true, sortOrder: 0 }

describe('kit references', () => {
  it('reads key and key@N against the listed kits', () => {
    expect(parseKitRef('acme', KITS)).toEqual({ key: 'acme', version: 3 })
    expect(parseKitRef('acme@2', KITS)).toEqual({ key: 'acme', version: 2 })
    expect(parseKitRef('nope', KITS)).toBeNull()
    expect(parseKitRef('Bad Key', KITS)).toBeNull()
    expect(kitRef({ key: 'acme', version: 2 })).toBe('acme@2')
  })

  it('reads a pin from a request only when it names a version', () => {
    expect(pinFromRef('acme@4')).toEqual({ key: 'acme', version: 4 })
    expect(pinFromRef('acme')).toBeUndefined()
    expect(pinFromRef(42)).toBeUndefined()
  })

  it('tells a pinned model about a newer version, or a kit that is gone', () => {
    expect(kitStatus({ key: 'acme', version: 3 }, KITS)).toEqual({ kind: 'current' })
    expect(kitStatus({ key: 'acme', version: 1 }, KITS)).toEqual({ kind: 'upgrade', latest: 3 })
    expect(kitStatus({ key: 'gone', version: 1 }, KITS)).toEqual({ kind: 'missing' })
    expect(kitStatus({ key: 'acme', version: 9 }, KITS)).toEqual({ kind: 'missing' })
  })

  it("applies a kit's declared defaults", () => {
    expect(kitDefaults(KITS[1])).toEqual({ locale: 'he', rtl: true })
    expect(kitDefaults(KITS[0])).toEqual({})
  })
})

describe('kit colours in the preview', () => {
  const version = (tokens: { name: string; value: string }[]): DesignKitVersion => ({
    key: 'acme', version: 1, status: 'PUBLISHED', checksum: 'x', notes: null,
    tokens: { $schema: 'menora-design-tokens/1', tokens }, manifest: { imports: [] }, css: '', assets: [],
  })

  it('resolves palette references with their fallbacks', () => {
    const tokens = [{ name: 'color-success', value: '{palette.accent|#16a34a}' }, { name: 'color-danger', value: '{palette.error|#dc2626}' },
      { name: 'color-brand-deep', value: 'color-mix(in srgb, {palette.primary} 85%, black)' }]
    expect(resolveToken(tokens, 'color-success', PALETTE)).toBe('#16a34a')
    expect(resolveToken(tokens, 'color-danger', PALETTE)).toBe('#ff0000')
    expect(resolveToken(tokens, 'color-brand-deep', PALETTE)).toBe('color-mix(in srgb, #111111 85%, black)')
  })

  it("draws a kit's own brand and gold, else the palette's", () => {
    expect(kitPreviewPalette(version([{ name: 'color-brand', value: '#0f766e' }, { name: 'color-gold', value: '{palette.secondary}' }]), PALETTE))
      .toMatchObject({ id: 'p', primary: '#0f766e', secondary: '#222222' })
    expect(kitPreviewPalette(null, PALETTE)).toBe(PALETTE)
  })
})

describe('the snapshot pins its kit', () => {
  const base: FullstackSnapshot = {
    meta: { ...DEFAULT_PROJECT_META }, entities: [], selectedDeps: [], scaffoldOpts: [],
    backendSet: 'spring-jpa-crud', frontendSet: 'react-tailwind-crud',
  }

  it('keeps the pin through makeSnapshot and its shape check, and older snapshots without one', () => {
    const pinned = makeSnapshot({ ...base, designKit: { key: 'acme', version: 2 } })
    expect(pinned.designKit).toEqual({ key: 'acme', version: 2 })
    expect(isSnapshot(pinned)).toBe(true)
    expect(isSnapshot({ ...base, designKit: 'acme' })).toBe(false)
    expect('designKit' in makeSnapshot(base)).toBe(false)
  })

  it('names a kit change for undo', () => {
    const v1 = makeSnapshot({ ...base, designKit: { key: 'acme', version: 1 } })
    const v2 = makeSnapshot({ ...base, designKit: { key: 'acme', version: 2 } })
    expect(describeSnapshotChange(base, v1)).toBe('Changed the design kit')
    expect(describeSnapshotChange(v1, v2)).toBe('Updated the design kit')
    expect(snapshotChangeKey(v1, v2)).toBe('sets')
  })

  it("reopens a generated zip's request-only model with its kit", () => {
    const parsed = parseExportedModel(JSON.stringify({ format: REQUEST_MODEL_FORMAT, request: { entities: [], designKit: 'acme@3' } }))
    expect('snapshot' in parsed && parsed.snapshot.designKit).toEqual({ key: 'acme', version: 3 })
  })
})
