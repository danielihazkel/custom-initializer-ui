import { describe, it, expect } from 'vitest'
import { canonicalVersion, carryDefaultAcrossTypes, validateEntities, validateMeta, countMetaErrors } from './validation'
import type { FullstackEntityDef } from '../../types'

const validEntity = (over: Partial<FullstackEntityDef> = {}): FullstackEntityDef => ({
  name: 'User',
  fields: [
    { name: 'id', type: 'LONG', primaryKey: true, generated: true },
    { name: 'email', type: 'STRING', required: true },
  ],
  ...over,
})

describe('validateEntities', () => {
  it('accepts a well-formed entity', () => {
    const result = validateEntities([validEntity()])
    expect(result.count).toBe(0)
    expect(result.entities).toEqual({})
  })

  it('flags an invalid identifier as the entity name', () => {
    const result = validateEntities([validEntity({ name: '1bad' })])
    expect(result.entities[0]?.name).toBeTruthy()
    expect(result.count).toBeGreaterThan(0)
  })

  it('flags a reserved keyword entity name', () => {
    const result = validateEntities([validEntity({ name: 'class' })])
    expect(result.entities[0]?.name).toBe('Reserved keyword')
  })

  it('flags duplicate entity names case-insensitively', () => {
    const result = validateEntities([validEntity({ name: 'User' }), validEntity({ name: 'user' })])
    expect(result.entities[0]?.name).toBe('Duplicate entity name')
    expect(result.entities[1]?.name).toBe('Duplicate entity name')
  })

  it('reports a field-less entity as such, not as a missing primary key', () => {
    const result = validateEntities([validEntity({ fields: [] })])
    expect(result.entities[0]?.noFields).toBe('Add at least one field')
    expect(result.entities[0]?.pk).toBeUndefined()
    expect(result.count).toBe(1)
  })

  it('requires at least one primary key and allows composite keys', () => {
    const noPk = validateEntities([validEntity({
      fields: [{ name: 'email', type: 'STRING' }],
    })])
    expect(noPk.entities[0]?.pk).toContain('primary key')

    // Composite keys are supported — two plain PKs produce no PK error.
    const twoPk = validateEntities([validEntity({
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true },
        { name: 'other', type: 'LONG', primaryKey: true },
      ],
    })])
    expect(twoPk.entities[0]?.pk).toBeUndefined()

    // But a generated (auto-increment) key still requires a single PK.
    const genComposite = validateEntities([validEntity({
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true, generated: true },
        { name: 'other', type: 'LONG', primaryKey: true },
      ],
    })])
    expect(genComposite.entities[0]?.pk).toContain('single primary key')
  })

  it('flags duplicate field names within an entity', () => {
    const result = validateEntities([validEntity({
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true },
        { name: 'dupe', type: 'STRING' },
        { name: 'dupe', type: 'STRING' },
      ],
    })])
    expect(result.entities[0]?.fields[1]?.name).toBe('Duplicate field name')
    expect(result.entities[0]?.fields[2]?.name).toBe('Duplicate field name')
  })

  it('requires enum values and rejects reserved/invalid ones', () => {
    const empty = validateEntities([validEntity({
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true },
        { name: 'status', type: 'ENUM', enumValues: [] },
      ],
    })])
    expect(empty.entities[0]?.fields[1]?.enumValues).toBeTruthy()

    const reserved = validateEntities([validEntity({
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true },
        { name: 'status', type: 'ENUM', enumValues: ['ACTIVE', 'class'] },
      ],
    })])
    expect(reserved.entities[0]?.fields[1]?.enumValues).toContain('class')
  })

  it('flags an empty entity list', () => {
    const result = validateEntities([])
    expect(result.noEntities).toBe(true)
    expect(result.count).toBe(1)
  })

  it('flags length on a non-STRING field', () => {
    const result = validateEntities([validEntity({
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true },
        { name: 'count', type: 'INTEGER', length: 10 },
      ],
    })])
    expect(result.entities[0]?.fields[1]?.length).toBe('Length applies to STRING only')
  })

  it('flags a non-positive length on a STRING field', () => {
    const result = validateEntities([validEntity({
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true },
        { name: 'code', type: 'STRING', length: 0 },
      ],
    })])
    expect(result.entities[0]?.fields[1]?.length).toBe('Length must be positive')
  })

  it('flags enumValues on a non-ENUM field', () => {
    const result = validateEntities([validEntity({
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true },
        { name: 'status', type: 'STRING', enumValues: ['ACTIVE'] },
      ],
    })])
    expect(result.entities[0]?.fields[1]?.enumValues).toBe('Values apply to ENUM only')
  })

  it('flags generated on a non-primary-key field', () => {
    const result = validateEntities([validEntity({
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true, generated: true },
        { name: 'code', type: 'LONG', generated: true },
      ],
    })])
    expect(result.entities[0]?.fields[1]?.generated).toBe('Only the primary key can be auto-generated')
  })

  it('flags generated on a non-integral primary key', () => {
    const result = validateEntities([validEntity({
      fields: [
        { name: 'id', type: 'STRING', primaryKey: true, generated: true },
      ],
    })])
    expect(result.entities[0]?.fields[0]?.generated).toBe('Generated key must be LONG, INTEGER, or UUID')
  })

  it('reports both view rules independently (generated PK and relations)', () => {
    const result = validateEntities([
      validEntity({ name: 'Customer', fields: [{ name: 'id', type: 'LONG', primaryKey: true }] }),
      validEntity({
        name: 'Summary',
        viewQuery: 'SELECT id, total FROM orders',
        fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }],
        relations: [{ type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
      }),
    ])
    const view = result.entities[1]?.view ?? ''
    expect(view).toContain('generated primary key')
    expect(view).toContain('relations')
    // Both count towards the total, not just the first.
    expect(result.count).toBeGreaterThanOrEqual(2)
  })

  it('does not reject Java-only regex syntax client-side', () => {
    // Possessive quantifiers are valid for java.util.regex but a SyntaxError in JS.
    const result = validateEntities([validEntity({
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true, generated: true },
        { name: 'code', type: 'STRING', pattern: '[A-Z]*+' },
      ],
    })])
    expect(result.entities[0]?.fields[1]?.pattern).toBeUndefined()
    expect(result.count).toBe(0)
  })

  it('still flags a pattern on a non-STRING field', () => {
    const result = validateEntities([validEntity({
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true, generated: true },
        { name: 'qty', type: 'INTEGER', pattern: '[0-9]+' },
      ],
    })])
    expect(result.entities[0]?.fields[1]?.pattern).toBe('Pattern applies to STRING only')
  })
})

describe('validateMeta', () => {
  it('accepts valid coordinates', () => {
    const errors = validateMeta({ groupId: 'com.menora', artifactId: 'demo', packageName: 'com.menora.demo' })
    expect(countMetaErrors(errors)).toBe(0)
  })

  it('rejects blanks, spaces, and malformed package names', () => {
    const errors = validateMeta({ groupId: '', artifactId: 'a b', packageName: '1.bad' })
    expect(errors.groupId).toBe('Required')
    expect(errors.artifactId).toBe('No spaces allowed')
    expect(errors.packageName).toBe('Invalid Java package name')
    expect(countMetaErrors(errors)).toBe(3)
  })
})

describe('validateMeta version catalog check', () => {
  const meta = { groupId: 'com.menora', artifactId: 'shop', packageName: 'com.menora.shop', bootVersion: '3.2.1', javaVersion: '21' }
  it('flags a version the catalog no longer lists, naming it', () => {
    const errors = validateMeta({ ...meta, bootVersion: '2.7.0' }, { bootVersions: ['3.2.1', '3.3.0'], javaVersions: ['17', '21'] })
    expect(errors.bootVersion).toBe('Not in the catalog (2.7.0)')
    expect(errors.javaVersion).toBeUndefined()
    expect(countMetaErrors(errors)).toBe(1)
  })
  it('stays quiet while the catalog is empty (not loaded yet) or absent', () => {
    expect(validateMeta({ ...meta, bootVersion: '2.7.0' }, { bootVersions: [], javaVersions: [] })).toEqual({})
    expect(validateMeta({ ...meta, bootVersion: '2.7.0' })).toEqual({})
  })
})

describe('numeric bounds per type', () => {
  const withField = (f: FullstackEntityDef['fields'][number]) =>
    validateEntities([validEntity({ fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }, f] })])
  it('accepts decimals on BIG_DECIMAL only', () => {
    expect(withField({ name: 'price', type: 'BIG_DECIMAL', min: 0.5, max: 99.99 }).count).toBe(0)
    expect(withField({ name: 'qty', type: 'INTEGER', min: 0.5 }).entities[0]?.fields[1]?.min).toBe('Must be a whole number')
    expect(withField({ name: 'big', type: 'LONG', max: 1.25 }).entities[0]?.fields[1]?.max).toBe('Must be a whole number')
  })
  it('keeps INTEGER bounds inside the int range', () => {
    expect(withField({ name: 'qty', type: 'INTEGER', max: 3_000_000_000 }).entities[0]?.fields[1]?.max).toBe('Out of the int range')
    expect(withField({ name: 'big', type: 'LONG', max: 3_000_000_000 }).count).toBe(0)
  })
})

describe('carryDefaultAcrossTypes', () => {
  it('keeps a default across the lossless pairs and drops it otherwise', () => {
    expect(carryDefaultAcrossTypes('STRING', 'TEXT', 'hello')).toBe('hello')
    expect(carryDefaultAcrossTypes('TEXT', 'STRING', 'hello')).toBe('hello')
    expect(carryDefaultAcrossTypes('INTEGER', 'LONG', '42')).toBe('42')
    expect(carryDefaultAcrossTypes('LONG', 'INTEGER', '42')).toBe('42')
    expect(carryDefaultAcrossTypes('LONG', 'INTEGER', '3000000000')).toBeUndefined()
    expect(carryDefaultAcrossTypes('STRING', 'INTEGER', '42')).toBeUndefined()
    expect(carryDefaultAcrossTypes('BOOLEAN', 'STRING', 'true')).toBeUndefined()
    expect(carryDefaultAcrossTypes('STRING', 'TEXT', '  ')).toBeUndefined()
  })
})

describe('enum constants and Java keywords', () => {
  it('accepts upper-case constants that only match a keyword case-insensitively', () => {
    const r = validateEntities([validEntity({
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true },
        { name: 'status', type: 'ENUM', enumValues: ['NEW', 'DEFAULT', 'DONE'] },
      ],
    })])
    expect(r.count).toBe(0)
  })
})

describe('Boot version spellings', () => {
  it('treats the client metadata spelling (3.2.1.RELEASE) and the catalog id (3.2.1) as the same version', () => {
    const meta = { groupId: 'g', artifactId: 'a', packageName: 'g.a', bootVersion: '3.2.1', javaVersion: '21' }
    expect(validateMeta(meta, { bootVersions: ['3.2.1.RELEASE', '3.3.0.RELEASE'], javaVersions: ['21'] })).toEqual({})
    expect(validateMeta({ ...meta, bootVersion: '3.3.0.RELEASE' }, { bootVersions: ['3.3.0'], javaVersions: ['21'] })).toEqual({})
    expect(validateMeta({ ...meta, bootVersion: '2.7.0.RELEASE' }, { bootVersions: ['3.2.1.RELEASE'], javaVersions: ['21'] }).bootVersion).toBeTruthy()
    expect(canonicalVersion('3.2.1.RELEASE')).toBe('3.2.1')
    expect(canonicalVersion('3.2.1')).toBe('3.2.1')
  })
})

describe('validateMeta — name and version', () => {
  const base = { groupId: 'com.menora', artifactId: 'demo', packageName: 'com.menora.demo' }
  it('accepts blank name/version (the server defaults them) and Maven-shaped versions', () => {
    expect(validateMeta({ ...base, name: '', version: '' })).toEqual({})
    expect(validateMeta({ ...base, version: '0.0.1-SNAPSHOT' })).toEqual({})
    expect(validateMeta({ ...base, version: '2024.1' })).toEqual({})
  })
  it('flags a whitespace-only name and a version with spaces or leading punctuation', () => {
    expect(validateMeta({ ...base, name: '   ' }).name).toBeTruthy()
    expect(validateMeta({ ...base, version: '1.0 beta' }).version).toBeTruthy()
    expect(validateMeta({ ...base, version: '-1' }).version).toBeTruthy()
  })
})

describe('validateEntities — enum labels', () => {
  const pk = { name: 'id', type: 'LONG' as const, primaryKey: true, generated: true }
  it('allows labels on an ENUM, flags one over 80 characters, and rejects labels on other types', () => {
    const ok = validateEntities([{ name: 'T', fields: [pk, { name: 'status', type: 'ENUM', enumValues: ['OPEN'], enumLabels: { OPEN: 'פתוח' } }] }])
    expect(ok.count).toBe(0)
    const long = validateEntities([{ name: 'T', fields: [pk, { name: 'status', type: 'ENUM', enumValues: ['OPEN'], enumLabels: { OPEN: 'x'.repeat(81) } }] }])
    expect(long.entities[0]?.fields?.[1]?.enumValues).toMatch(/too long/)
    const stale = validateEntities([{ name: 'T', fields: [pk, { name: 'status', type: 'ENUM', enumValues: ['OPEN'], enumLabels: { GONE: 'Gone' } }] }])
    expect(stale.entities[0]?.fields?.[1]?.enumValues).toMatch(/not one of the values/)
    const wrongType = validateEntities([{ name: 'T', fields: [pk, { name: 'status', type: 'STRING', enumLabels: { OPEN: 'Open' } }] }])
    expect(wrongType.entities[0]?.fields?.[1]?.enumValues).toBe('Values apply to ENUM only')
  })
})
