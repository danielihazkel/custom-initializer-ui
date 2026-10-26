import { describe, it, expect } from 'vitest'
import type { FullstackEntityDef } from '../../types'
import { formSectionsProblem, syncFormSections } from './formSections'
import { defaultWizardSteps } from './pageLayout'

const order: FullstackEntityDef = {
  uid: 'e1',
  name: 'Order',
  fields: [
    { uid: 'f1', name: 'id', type: 'LONG', primaryKey: true, generated: true },
    { uid: 'f2', name: 'reference', type: 'STRING' },
    { uid: 'f3', name: 'status', type: 'ENUM', enumValues: ['OPEN'] },
    { uid: 'f4', name: 'total', type: 'BIG_DECIMAL' },
  ],
  relations: [{ uid: 'r1', type: 'MANY_TO_ONE', fieldName: 'customer', targetEntity: 'Customer' }],
  formSections: [{ title: 'Who', fields: ['customer', 'reference'] }, { title: 'What', fields: ['status'] }],
}

describe('form sections', () => {
  it('follow a rename and drop what is gone, removing a section left empty', () => {
    const renamed = { ...order, fields: order.fields.map(f => (f.uid === 'f2' ? { ...f, name: 'ref' } : f)) }
    expect(syncFormSections(order, renamed).formSections).toEqual([{ title: 'Who', fields: ['customer', 'ref'] }, { title: 'What', fields: ['status'] }])
    const noStatus = { ...order, fields: order.fields.filter(f => f.uid !== 'f3') }
    expect(syncFormSections(order, noStatus).formSections).toEqual([{ title: 'Who', fields: ['customer', 'reference'] }])
    const relRenamed = { ...order, relations: [{ ...order.relations![0], fieldName: 'buyer' }] }
    expect(syncFormSections(order, relRenamed).formSections?.[0].fields).toEqual(['buyer', 'reference'])
  })

  it('say what the server would reject', () => {
    expect(formSectionsProblem(order)).toBeUndefined()
    expect(formSectionsProblem({ ...order, formSections: [{ title: ' ', fields: ['status'] }] })).toBe('Form section 1 needs a title')
    expect(formSectionsProblem({ ...order, formSections: [{ title: 'A', fields: ['id'] }] }))
      .toBe('Form section 1 (“A”) lists “id”, which is not one of its fields or relations')
    expect(formSectionsProblem({ ...order, formSections: [{ title: 'A', fields: ['status'] }, { title: 'B', fields: ['Status'] }] }))
      .toBe('“Status” is in two form sections')
  })

  it('give a wizard without steps one step per section, then the rest', () => {
    expect(defaultWizardSteps(order)).toEqual([
      { title: 'Who', fields: ['customer', 'reference'] },
      { title: 'What', fields: ['status'] },
      { fields: ['total'] },
    ])
  })
})
