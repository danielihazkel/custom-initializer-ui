import { describe, it, expect } from 'vitest'
import { buildWizardBody, validateForm, requiredSqlDeps, isSqlDepSatisfied } from './projectUtils'
import type { ProjectFormValues, SqlByDep } from '../types'

const form: ProjectFormValues = {
  groupId: 'com.menora',
  artifactId: 'demo',
  name: 'demo',
  description: 'Demo project',
  packageName: 'com.menora.demo',
  bootVersion: '3.2.1',
  language: 'java',
  type: 'maven-project',
  packaging: 'jar',
  javaVersion: '21',
}

describe('buildWizardBody', () => {
  it('carries the form fields and selected dependencies', () => {
    const body = buildWizardBody(form, ['web', 'data-jpa'], {}, {}, {}, {})
    expect(body).toMatchObject({
      groupId: 'com.menora',
      artifactId: 'demo',
      bootVersion: '3.2.1',
      javaVersion: '21',
      dependencies: ['web', 'data-jpa'],
    })
  })

  it('includes opts only for selected dependencies with non-empty options', () => {
    const body = buildWizardBody(
      form,
      ['kafka'],
      { kafka: ['consumer-example'], rqueue: ['x'], web: [] },
      {}, {}, {},
    )
    expect(body.opts).toEqual({ kafka: ['consumer-example'] })
  })

  it('maps active SQL wizard entries into sqlByDep + sqlOptions', () => {
    const sqlByDep: SqlByDep = {
      'data-jpa': {
        sql: 'CREATE TABLE users (id INT);',
        subPackage: 'domain',
        tables: [{ name: 'users', generateRepository: true }],
        apiMode: 'MAPSTRUCT_DTO',
      },
    }
    const body = buildWizardBody(form, ['data-jpa'], {}, sqlByDep, {}, {})
    expect(body.sqlByDep).toEqual({ 'data-jpa': 'CREATE TABLE users (id INT);' })
    expect(body.sqlOptions).toEqual({
      'data-jpa': { subPackage: 'domain', tables: [{ name: 'users', generateRepository: true }], apiMode: 'MAPSTRUCT_DTO' },
    })
  })
})

describe('requiredSqlDeps', () => {
  it('requires data-jpa for entities-only mode', () => {
    expect(requiredSqlDeps('NONE')).toEqual(['data-jpa'])
  })
  it('adds web for any REST api mode', () => {
    expect(requiredSqlDeps('ENTITY_DIRECT')).toEqual(['data-jpa', 'web'])
    expect(requiredSqlDeps('INLINE_DTO')).toEqual(['data-jpa', 'web'])
  })
  it('adds web + mapstruct for the MapStruct mode', () => {
    expect(requiredSqlDeps('MAPSTRUCT_DTO')).toEqual(['data-jpa', 'web', 'mapstruct'])
  })
})

describe('isSqlDepSatisfied', () => {
  it('is satisfied when the dep is selected', () => {
    expect(isSqlDepSatisfied('data-jpa', ['data-jpa'])).toBe(true)
    expect(isSqlDepSatisfied('data-jpa', [])).toBe(false)
  })
  it('treats webflux as satisfying the web requirement', () => {
    expect(isSqlDepSatisfied('web', ['webflux'])).toBe(true)
    expect(isSqlDepSatisfied('mapstruct', ['webflux'])).toBe(false)
  })
})

describe('validateForm', () => {
  it('accepts a well-formed project', () => {
    const result = validateForm(form)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it.each(['groupId', 'artifactId', 'name', 'packageName'] as const)(
    'flags %s as required when blank',
    (field) => {
      const result = validateForm({ ...form, [field]: '   ' })
      expect(result.valid).toBe(false)
      expect(result.errors[field]).toBe('Required')
    },
  )

  it('does not require description', () => {
    const result = validateForm({ ...form, description: '' })
    expect(result.valid).toBe(true)
  })

  it('rejects an artifactId containing whitespace', () => {
    const result = validateForm({ ...form, artifactId: 'my demo' })
    expect(result.valid).toBe(false)
    expect(result.errors.artifactId).toBe('No spaces allowed')
  })

  it('rejects a malformed package name', () => {
    const result = validateForm({ ...form, packageName: 'com..menora' })
    expect(result.valid).toBe(false)
    expect(result.errors.packageName).toBe('Invalid Java package name')
  })

  it('rejects a package name starting with a digit', () => {
    const result = validateForm({ ...form, packageName: 'com.9menora' })
    expect(result.valid).toBe(false)
    expect(result.errors.packageName).toBe('Invalid Java package name')
  })

  it('prefers the required message over the format message when blank', () => {
    const result = validateForm({ ...form, packageName: '' })
    expect(result.errors.packageName).toBe('Required')
  })
})
