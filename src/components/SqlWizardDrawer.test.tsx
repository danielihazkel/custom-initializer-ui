import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SqlWizardDrawer } from './SqlWizardDrawer'
import type { SqlWizardEntry } from '../types'

// The drawer's chrome and the CodeMirror editor are not what is under test.
vi.mock('./admin/shared/AdminFormDrawer', () => ({
  AdminFormDrawer: ({ children, onSave, isOpen }: { children: ReactNode; onSave: () => void; isOpen: boolean }) =>
    isOpen ? <div>{children}<button onClick={onSave}>Save</button></div> : null,
}))
vi.mock('./admin/file-contributions/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
    <textarea aria-label="sql" value={value} onChange={e => onChange(e.target.value)} />,
}))

const entry: SqlWizardEntry = {
  sql: 'CREATE TABLE users (id INT PRIMARY KEY);',
  subPackage: 'entity',
  tables: [{ name: 'users', generateRepository: true }],
  apiMode: 'INLINE_DTO',
}

function open(initial: SqlWizardEntry, selected: string[]) {
  const onSave = vi.fn()
  render(
    <SqlWizardDrawer
      isOpen
      onClose={() => {}}
      depId="postgresql"
      depName="PostgreSQL"
      dialectName="PostgreSQL"
      initial={initial}
      selected={selected}
      onSave={onSave}
    />,
  )
  return onSave
}

describe('SqlWizardDrawer extras', () => {
  it('leaves an untouched entry as it was', () => {
    const onSave = open(entry, ['postgresql', 'data-jpa', 'web'])
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(entry)
  })

  it('saves the baseline switched off and the tests switched on', () => {
    const onSave = open(entry, ['postgresql', 'data-jpa', 'web', 'flyway'])
    const baseline = screen.getByLabelText(/Use this script as the Flyway baseline/) as HTMLInputElement
    const tests = screen.getByLabelText(/Generate controller tests/) as HTMLInputElement
    expect(baseline.checked).toBe(true)
    expect(tests.checked).toBe(false)
    fireEvent.click(baseline)
    fireEvent.click(tests)
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith({ ...entry, flywayBaseline: false, generateTests: true })
  })

  it('says what each extra depends on', () => {
    open({ ...entry, apiMode: 'NONE', generateTests: true }, ['postgresql', 'data-jpa'])
    // No controllers without a REST mode: the box is off and cannot be ticked.
    const tests = screen.getByLabelText(/Generate controller tests/) as HTMLInputElement
    expect(tests.disabled).toBe(true)
    expect(tests.checked).toBe(false)
    expect(screen.getByText(/Needs a REST API mode/)).toBeTruthy()
    // Neither dependency is selected, and the drawer says so.
    expect(screen.getByText(/it is not, so no migration is written/)).toBeTruthy()
    expect(screen.getByText(/to turn/)).toBeTruthy()
  })
})
