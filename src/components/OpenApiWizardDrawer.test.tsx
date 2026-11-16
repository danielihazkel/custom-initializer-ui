import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { OpenApiWizardDrawer } from './OpenApiWizardDrawer'
import type { OpenApiWizardEntry } from '../types'

// The drawer's chrome and the CodeMirror editor are not what is under test.
vi.mock('./admin/shared/AdminFormDrawer', () => ({
  AdminFormDrawer: ({ children, onSave, isOpen }: { children: ReactNode; onSave: () => void; isOpen: boolean }) =>
    isOpen ? <div>{children}<button onClick={onSave}>Save</button></div> : null,
}))
vi.mock('./admin/file-contributions/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
    <textarea aria-label="spec" value={value} onChange={e => onChange(e.target.value)} />,
}))

const entry: OpenApiWizardEntry = {
  spec: 'openapi: 3.0.0',
  apiSubPackage: 'api',
  dtoSubPackage: 'dto',
  clientSubPackage: 'client',
  mode: 'BOTH',
  baseUrlProperty: 'openapi.client.base-url',
}

function open(initial: OpenApiWizardEntry) {
  const onSave = vi.fn()
  render(<OpenApiWizardDrawer isOpen onClose={() => {}} depId="web" depName="Spring Web" initial={initial} onSave={onSave} />)
  return onSave
}

describe('OpenApiWizardDrawer options', () => {
  it('leaves an untouched entry as it was', () => {
    const onSave = open(entry)
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(entry)
  })

  it('saves the RestClient kind and the spec copy', () => {
    const onSave = open(entry)
    expect(screen.getByRole('radio', { name: /RestTemplate/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: /RestClient/ }))
    fireEvent.click(screen.getByLabelText(/Keep the spec in the project/))
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith({ ...entry, clientKind: 'restClient', copySpec: true })
  })

  it('starts a new setup on interfaces and keeps an old one on classes', () => {
    const onNew = vi.fn()
    render(<OpenApiWizardDrawer isOpen onClose={() => {}} depId="web" depName="Spring Web" initial={null} onSave={onNew} />)
    expect(screen.getByRole('radio', { name: /Interfaces/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.change(screen.getByLabelText('spec'), { target: { value: 'openapi: 3.0.0' } })
    fireEvent.click(screen.getByText('Save'))
    expect(onNew).toHaveBeenCalledWith(expect.objectContaining({ apiStyle: 'interfaces', mode: 'CONTROLLERS' }))
  })

  it('saves the style only for a server side, and classes as nothing', () => {
    const onSave = open({ ...entry, apiStyle: 'interfaces' })
    fireEvent.click(screen.getByRole('radio', { name: /Classes/ }))
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(entry)
  })

  it('offers no style where no server side is generated', () => {
    const onSave = open({ ...entry, mode: 'CLIENT', apiStyle: 'interfaces' })
    expect(screen.queryByRole('radiogroup', { name: /Server code as/ })).toBeNull()
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith({ ...entry, mode: 'CLIENT' })
  })

  it('offers no client kind where no client is generated', () => {
    const onSave = open({ ...entry, mode: 'CONTROLLERS', clientKind: 'restClient' })
    expect(screen.queryByRole('radiogroup', { name: /Client calls through/ })).toBeNull()
    fireEvent.click(screen.getByText('Save'))
    // …and a kind left over from another mode is not saved with it.
    expect(onSave).toHaveBeenCalledWith({ ...entry, mode: 'CONTROLLERS' })
  })
})
