import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { buildWizardBody } from './projectUtils'
import { encodeBackendShare } from './backendShare'
import { parseBackendModel } from '../components/backend/backendModel'
import { requestOfSnapshot } from '../components/backend/backendRequest'
import { useProjectState } from '../hooks/useProjectState'
import type { ProjectFormValues, SoapWizardEntry } from '../types'

// A WSDL in several files: the main document in `wsdl`, what it refers to in `files`. The
// request, a project's model file, a share link and the stored draft all carry them.

const form: ProjectFormValues = {
  groupId: 'com.menora',
  artifactId: 'atlas',
  name: 'atlas',
  description: '',
  packageName: 'com.menora.atlas',
  bootVersion: '3.2.1',
  language: 'java',
  type: 'maven-project',
  packaging: 'jar',
  javaVersion: '21',
  department: '',
}

const entry: SoapWizardEntry = {
  wsdl: '<wsdl:definitions/>',
  endpointSubPackage: 'endpoint',
  clientSubPackage: 'client',
  payloadSubPackage: 'generated',
  mode: 'BOTH',
  baseUrlProperty: 'soap.client.base-url',
  contextPath: '/ws',
}

const files = { 'port/country-port.wsdl': '<wsdl:definitions name="port"/>', 'schemas/types.xsd': '<xsd:schema/>' }

describe('a WSDL in several files', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('is sent as wsdlFilesByDep beside the main document, and not at all for one document', () => {
    const one = buildWizardBody(form, ['web-services'], {}, {}, {}, { 'web-services': entry })
    expect(one.wsdlByDep).toEqual({ 'web-services': entry.wsdl })
    expect(JSON.parse(JSON.stringify(one))).not.toHaveProperty('wsdlFilesByDep')

    const several = buildWizardBody(form, ['web-services'], {}, {}, {}, { 'web-services': { ...entry, files } })
    expect(several).toMatchObject({ wsdlByDep: { 'web-services': entry.wsdl }, wsdlFilesByDep: { 'web-services': files } })
  })

  it('comes back from a project’s model file, and goes out the same', () => {
    const parsed = parseBackendModel(JSON.stringify({
      format: 'menora-backend-model/1',
      kind: 'backend',
      request: {
        groupId: 'com.menora', artifactId: 'atlas', packageName: 'com.menora.atlas',
        bootVersion: '3.2.1', javaVersion: '21', packaging: 'jar',
        dependencies: ['web-services'],
        wsdlByDep: { 'web-services': entry.wsdl },
        soapOptions: { 'web-services': { mode: 'BOTH' } },
        // A blank file is nothing; files of a dependency without a WSDL are nobody's.
        wsdlFilesByDep: { 'web-services': { ...files, 'empty.xsd': ' ' }, other: { 'x.xsd': '<x/>' } },
      },
    }))
    if ('error' in parsed) throw new Error(parsed.error)
    expect(parsed.snapshot.soapByDep).toEqual({ 'web-services': { ...entry, files } })
    expect(requestOfSnapshot(parsed.snapshot).wsdlFilesByDep).toEqual({ 'web-services': files })
    // One document reads back without the key.
    const one = parseBackendModel(JSON.stringify({ request: { artifactId: 'atlas', dependencies: ['web-services'],
      wsdlByDep: { 'web-services': entry.wsdl }, wsdlFilesByDep: { 'web-services': { 'empty.xsd': '' } } } }))
    if ('error' in one) throw new Error(one.error)
    expect(one.snapshot.soapByDep['web-services']).not.toHaveProperty('files')
  })

  it('survives a reload and a share link', () => {
    localStorage.setItem('soapByDep', JSON.stringify({ 'web-services': { ...entry, files } }))
    localStorage.setItem('selected', JSON.stringify(['web-services']))
    const stored = renderHook(() => useProjectState(null))
    expect(stored.result.current.soapByDep['web-services'].files).toEqual(files)
    stored.unmount()

    localStorage.clear()
    const shared = encodeBackendShare({
      form, selected: ['web-services'], selectedOptions: {}, sqlByDep: {}, openApiByDep: {},
      soapByDep: { 'web-services': { ...entry, files } }, multiModuleEnabled: false, selectedModules: [],
    })
    window.history.replaceState(null, '', `/?artifactId=atlas&dependencies=web-services&bs=${shared}`)
    const linked = renderHook(() => useProjectState(null))
    expect(linked.result.current.soapByDep['web-services']).toEqual({ ...entry, files })
  })
})
