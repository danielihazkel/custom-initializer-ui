import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DepartmentSelect } from './DepartmentSelect'
import { invalidateDepartments } from '../../hooks/useDepartments'

const DEPARTMENTS = [
  { id: 'lts', name: 'LTS', isDefault: true, sortOrder: 0 },
  { id: 'fin', name: 'Finance', isDefault: false, sortOrder: 1 },
]

function response(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  invalidateDepartments()
  fetchMock = vi.fn().mockResolvedValue(response(200, DEPARTMENTS))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function select(): HTMLSelectElement {
  return screen.getByRole('combobox') as HTMLSelectElement
}

describe('DepartmentSelect', () => {
  it('lists the admin departments and shows the default for a blank value', async () => {
    render(<DepartmentSelect id="d" value="" onChange={() => {}} className="" />)

    await waitFor(() => expect(select().options.length).toBe(2))
    expect(fetchMock).toHaveBeenCalledWith('/metadata/departments', expect.anything())
    expect(select().value).toBe('lts')
    expect(Array.from(select().options).map(o => o.textContent)).toEqual(['LTS', 'Finance'])
  })

  it('reports the picked department id', async () => {
    const onChange = vi.fn()
    render(<DepartmentSelect id="d" value="" onChange={onChange} className="" />)
    await waitFor(() => expect(select().options.length).toBe(2))

    fireEvent.change(select(), { target: { value: 'fin' } })

    expect(onChange).toHaveBeenCalledWith('fin')
  })

  it('keeps a department that left the list visible as unknown', async () => {
    render(<DepartmentSelect id="d" value="ops" onChange={() => {}} className="" />)

    await waitFor(() => expect(select().options.length).toBe(3))
    expect(select().value).toBe('ops')
    expect(select().options[0].textContent).toBe('ops (unknown)')
  })
})
