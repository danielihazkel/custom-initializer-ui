import { useState, useCallback } from 'react'
import type { AdminDepartment, Toast } from '../../../types'
import { useAdminResource } from '../../../hooks/useAdminResource'
import { invalidateDepartments } from '../../../hooks/useDepartments'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { DepartmentForm } from './DepartmentForm'

/** Mirrors DepartmentEntity's @Pattern — the id lands in k8s resource names. */
const DEPARTMENT_ID = /^[a-z][a-z0-9-]*$/

const EMPTY: Partial<AdminDepartment> = {
  departmentId: '',
  name: '',
  isDefault: false,
  sortOrder: 0,
}

export function validateDepartment(data: Partial<AdminDepartment>): Record<string, string> {
  const e: Record<string, string> = {}
  if (!data.departmentId?.trim()) e.departmentId = 'Required'
  else if (!DEPARTMENT_ID.test(data.departmentId)) e.departmentId = "Lower-case letters, digits and '-', starting with a letter"
  if (!data.name?.trim()) e.name = 'Required'
  return e
}

export function DepartmentsTab() {
  const { items, loading, create, update, remove } =
    useAdminResource<AdminDepartment>('/admin/departments')
  const [editing, setEditing] = useState<Partial<AdminDepartment> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminDepartment | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); setErrors({}); setDrawerOpen(true) }
  function openEdit(row: AdminDepartment) { setEditing({ ...row }); setIsNew(false); setErrors({}); setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }

  async function handleSave() {
    if (!editing) return
    const e = validateDepartment(editing)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    try {
      if (isNew) await create(editing as Omit<AdminDepartment, 'id'>)
      else await update(editing.id!, editing)
      // The generator screens' pickers refetch the list on their next mount.
      invalidateDepartments()
      setToast({ message: 'Saved successfully', type: 'success' })
      closeDrawer()
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await remove(deleteTarget.id)
      invalidateDepartments()
      setToast({ message: 'Deleted successfully', type: 'success' })
      setDeleteTarget(null)
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const clearToast = useCallback(() => setToast(null), [])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Departments</h2>
        <p className="text-[11px] text-on-surface-variant mt-0.5">
          One list for the Backend, Frontend and Fullstack screens. The chosen id is rendered into templates as{' '}
          <code>{'{{department}}'}</code> (upper-cased: <code>{'{{departmentUpper}}'}</code>)
        </p>
      </div>

      <AdminTable
        columns={[
          { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
          { label: 'Department ID', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.departmentId}</code> },
          { label: 'Name', render: r => r.name },
          {
            label: 'Default',
            render: r => r.isDefault
              ? <span className="text-xs font-semibold text-primary">★ default</span>
              : <span className="text-xs text-on-surface-variant">—</span>,
            width: '90px',
          },
          { label: 'Sort', render: r => r.sortOrder, width: '70px' },
        ]}
        rows={items}
        loading={loading}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        addButton={
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-bold bg-primary text-on-primary hover:brightness-110 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
            New Department
          </button>
        }
      />

      <AdminFormDrawer
        title={isNew ? 'New Department' : 'Edit Department'}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onSave={handleSave}
        saving={saving}
      >
        {editing && (
          <DepartmentForm
            data={editing}
            errors={errors}
            onChange={updates => setEditing(prev => ({ ...prev, ...updates }))}
          />
        )}
      </AdminFormDrawer>

      {deleteTarget && (
        <DeleteConfirmDialog
          itemLabel={`"${deleteTarget.name}" (${deleteTarget.departmentId})`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      <StatusToast toast={toast} onClear={clearToast} />
    </div>
  )
}
