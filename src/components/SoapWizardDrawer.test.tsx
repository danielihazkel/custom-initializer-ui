import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SoapWizardDrawer } from './SoapWizardDrawer'
import type { SoapWizardEntry } from '../types'

// The drawer's chrome and the CodeMirror editor are not what is under test.
vi.mock('./admin/shared/AdminFormDrawer', () => ({
  AdminFormDrawer: ({ children, onSave, isOpen }: { children: ReactNode; onSave: () => void; isOpen: boolean }) =>
    isOpen ? <div>{children}<button onClick={onSave}>Save</button></div> : null,
}))
vi.mock('./admin/file-contributions/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
    <textarea aria-label="wsdl" value={value} onChange={e => onChange(e.target.value)} />,
}))

const entry: SoapWizardEntry = {
  wsdl: '<wsdl:definitions name="main"/>',
  endpointSubPackage: 'endpoint',
  clientSubPackage: 'client',
  payloadSubPackage: 'generated',
  mode: 'ENDPOINTS',
  baseUrlProperty: 'soap.client.base-url',
  contextPath: '/ws',
}

/** What the drawer last asked the server to detect services in. */
function lastDetectBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const calls = fetchMock.mock.calls.filter(c => c[0] === '/starter-wizard.detect-services')
  return JSON.parse((calls[calls.length - 1][1] as RequestInit).body as string)
}

function open(initial: SoapWizardEntry | null, onSave = vi.fn()) {
  render(<SoapWizardDrawer isOpen onClose={() => {}} depId="web-services" depName="Web Services"
    initial={initial} onSave={onSave} />)
  return onSave
}

describe('SoapWizardDrawer', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify(['CountryService.CountryPort: getCountry']), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps one document the request it always was', async () => {
    const onSave = open(entry)
    await waitFor(() => expect(screen.getByText('CountryService.CountryPort: getCountry')).toBeTruthy())
    expect(lastDetectBody(fetchMock)).toEqual({ wsdl: entry.wsdl })
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(entry)
    expect('files' in onSave.mock.calls[0][0]).toBe(false)
  })

  it('takes a WSDL in several files: the first .wsdl is the main document, the rest its files', async () => {
    const onSave = open(null)
    const picked = [
      new File(['<xsd:schema name="types"/>'], 'types.xsd'),
      new File(['<wsdl:definitions name="picked"/>'], 'service.wsdl'),
      new File(['<xsd:schema name="more"/>'], 'more.xsd'),
    ]
    fireEvent.change(screen.getByLabelText('Upload file…'), { target: { files: picked } })
    await waitFor(() => expect((screen.getByLabelText('wsdl') as HTMLTextAreaElement).value).toBe('<wsdl:definitions name="picked"/>'))
    const paths = () => screen.getAllByLabelText('Path of the file').map(i => (i as HTMLInputElement).value)
    await waitFor(() => expect(paths()).toEqual(['types.xsd', 'more.xsd']))

    // The detection reads the files with the main document.
    await waitFor(() => expect(lastDetectBody(fetchMock)).toEqual({
      wsdl: '<wsdl:definitions name="picked"/>',
      files: { 'types.xsd': '<xsd:schema name="types"/>', 'more.xsd': '<xsd:schema name="more"/>' },
    }))

    // A file is named the way the reference to it reads.
    fireEvent.change(screen.getAllByLabelText('Path of the file')[0], { target: { value: 'schemas/types.xsd' } })
    fireEvent.click(screen.getByLabelText('Remove more.xsd'))
    fireEvent.click(screen.getByText('Save'))
    expect(onSave.mock.calls[0][0]).toMatchObject({
      wsdl: '<wsdl:definitions name="picked"/>',
      files: { 'schemas/types.xsd': '<xsd:schema name="types"/>' },
    })
  })

  it('adds files to a WSDL already there, swaps the main document, and says when two share a name', async () => {
    const onSave = open({ ...entry, files: { 'port.wsdl': '<wsdl:definitions name="port"/>' } })
    fireEvent.change(screen.getByLabelText('Add files…'), {
      target: { files: [new File(['<xsd:schema name="types"/>'], 'types.xsd')] },
    })
    const paths = () => screen.getAllByLabelText('Path of the file').map(i => (i as HTMLInputElement).value)
    await waitFor(() => expect(paths()).toEqual(['port.wsdl', 'types.xsd']))

    // "Make main" swaps: the file becomes the document, the old document takes its name.
    fireEvent.click(screen.getAllByText('Make main')[0])
    expect((screen.getByLabelText('wsdl') as HTMLTextAreaElement).value).toBe('<wsdl:definitions name="port"/>')

    // Two rows of one name are said, and nothing is asked of the server meanwhile.
    fireEvent.change(screen.getAllByLabelText('Path of the file')[1], { target: { value: 'port.wsdl' } })
    await waitFor(() => expect(screen.getByText('Two files are named port.wsdl.')).toBeTruthy())
    fireEvent.change(screen.getAllByLabelText('Path of the file')[1], { target: { value: 'types.xsd' } })

    fireEvent.click(screen.getByText('Save'))
    expect(onSave.mock.calls[0][0]).toMatchObject({
      wsdl: '<wsdl:definitions name="port"/>',
      files: { 'port.wsdl': entry.wsdl, 'types.xsd': '<xsd:schema name="types"/>' },
    })
  })

  it('clearing the WSDL drops its files, and saving nothing removes the entry', () => {
    const onSave = open({ ...entry, files: { 'types.xsd': '<xsd:schema/>' } })
    fireEvent.click(screen.getByText('Clear'))
    expect(screen.queryByLabelText('Path of the file')).toBeNull()
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(null)
  })
})
