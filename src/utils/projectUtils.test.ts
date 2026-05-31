import { describe, it, expect } from 'vitest'
import { buildWizardBody } from './projectUtils'
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
      },
    }
    const body = buildWizardBody(form, ['data-jpa'], {}, sqlByDep, {}, {})
    expect(body.sqlByDep).toEqual({ 'data-jpa': 'CREATE TABLE users (id INT);' })
    expect(body.sqlOptions).toEqual({
      'data-jpa': { subPackage: 'domain', tables: [{ name: 'users', generateRepository: true }] },
    })
  })
})
