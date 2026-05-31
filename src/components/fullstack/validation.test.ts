import { describe, it, expect } from 'vitest'
import { validateEntities, validateMeta, countMetaErrors } from './validation'
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

  it('requires exactly one primary key', () => {
    const noPk = validateEntities([validEntity({
      fields: [{ name: 'email', type: 'STRING' }],
    })])
    expect(noPk.entities[0]?.pk).toContain('primary key')

    const twoPk = validateEntities([validEntity({
      fields: [
        { name: 'id', type: 'LONG', primaryKey: true },
        { name: 'other', type: 'LONG', primaryKey: true },
      ],
    })])
    expect(twoPk.entities[0]?.pk).toContain('Only one')
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
