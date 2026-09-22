import { describe, it, expect } from 'vitest'
import { validateDepartment } from './DepartmentsTab'

describe('validateDepartment', () => {
  it('accepts a lower-case slug with a name', () => {
    expect(validateDepartment({ departmentId: 'lts', name: 'LTS' })).toEqual({})
    expect(validateDepartment({ departmentId: 'data-2', name: 'Data' })).toEqual({})
  })

  it('requires both fields', () => {
    const e = validateDepartment({ departmentId: ' ', name: '' })
    expect(e.departmentId).toBe('Required')
    expect(e.name).toBe('Required')
  })

  it('rejects ids that cannot go into k8s names', () => {
    for (const id of ['LTS', '1lts', 'my dept', 'lts_x']) {
      expect(validateDepartment({ departmentId: id, name: 'X' }).departmentId).toBeTruthy()
    }
  })
})
