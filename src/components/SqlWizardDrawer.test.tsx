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

  it('lists a CREATE VIEW by its name, and a SELECT under a comment by its table', () => {
    // A script read from a database says what each view is in a comment right above its
    // SELECT, which used to hide the view from the list.
    open({
      ...entry,
      sql: [
        'CREATE TABLE users (id INT PRIMARY KEY);',
        'CREATE OR REPLACE VIEW sales.active_users AS SELECT id FROM users;',
        'CREATE MATERIALIZED VIEW IF NOT EXISTS "UserTotals" AS SELECT count(*) AS n FROM users;',
        '-- View hr.staff, read-only.',
        'SELECT CAST(id AS BIGINT) AS id FROM hr.staff;',
      ].join('\n'),
    }, ['postgresql', 'data-jpa'])
    expect(screen.getByText('active_users')).toBeTruthy()
    expect(screen.getByText('UserTotals')).toBeTruthy()
    expect(screen.getByText('staff')).toBeTruthy()
    expect(screen.getAllByText('read-only view')).toHaveLength(3)
  })

  it('does not ask for a CREATE TABLE when the script is views only', () => {
    open({ ...entry, sql: 'CREATE VIEW v AS (SELECT 1 AS one);', tables: [] }, ['postgresql', 'data-jpa'])
    expect(screen.getByText('v')).toBeTruthy()
    expect(screen.queryByText(/statements detected/)).toBeNull()
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
