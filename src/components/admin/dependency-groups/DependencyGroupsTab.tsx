import { useState, useCallback, useEffect } from 'react'
import type { AdminDependencyGroup, Toast } from '../../../types'
import { useAdminResource, AdminApiError, adminFetch } from '../../../hooks/useAdminResource'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog, type OrphanDetails } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { DependencyGroupForm } from './DependencyGroupForm'

const EMPTY: Partial<AdminDependencyGroup> = { name: '', sortOrder: 0 }

export function DependencyGroupsTab() {
  const { items, loading, create, update, remove, reload } = useAdminResource<AdminDependencyGroup>('/admin/dependency-groups')
  const [editing, setEditing] = useState<Partial<AdminDependencyGroup> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminDependencyGroup | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [orphanDetails, setOrphanDetails] = useState<OrphanDetails | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [localItems, setLocalItems] = useState<AdminDependencyGroup[]>([])

  useEffect(() => { setLocalItems(items) }, [items])

  const isDirty = localItems.length > 0 && localItems.some((item, i) => item.id !== items[i]?.id)

  async function handleSaveOrder() {
    setSaving(true)
    try {
      const orderings = localItems.map((item, i) => ({ id: item.id, sortOrder: i + 1 }))
      await adminFetch('PUT', '/admin/dependency-groups/reorder', orderings)
      reload()
      setToast({ message: 'Order saved successfully', type: 'success' })
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  function openNew() {
    setEditing({ ...EMPTY })
    setIsNew(true)
    setErrors({})
    setDrawerOpen(true)
  }

  function openEdit(row: AdminDependencyGroup) {
    setEditing({ ...row })
    setIsNew(false)
    setErrors({})
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setEditing(null)
  }

  function validate(data: Partial<AdminDependencyGroup>): Record<string, string> {
    const e: Record<string, string> = {}
    if (!data.name?.trim()) e.name = 'Required'
    return e
  }

  async function handleSave() {
    if (!editing) return
    const e = validate(editing)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    try {
      if (isNew) {
        await create(editing as Omit<AdminDependencyGroup, 'id'>)
      } else {
        await update(editing.id!, editing)
      }
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
      setToast({ message: 'Deleted successfully', type: 'success' })
      setDeleteTarget(null)
      setOrphanDetails(null)
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 409 && err.body) {
        setOrphanDetails(err.body as OrphanDetails)
      } else {
        setToast({ message: String(err), type: 'error' })
      }
    } finally {
      setDeleting(false)
    }
  }

  async function handleForceDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await remove(deleteTarget.id, true)
      setToast({ message: 'Deleted successfully (with references)', type: 'success' })
      setDeleteTarget(null)
      setOrphanDetails(null)
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const clearToast = useCallback(() => setToast(null), [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Dependency Groups</h2>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Categories shown in the UI (e.g. Web, Data, Messaging)</p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <button
              onClick={handleSaveOrder}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-bold text-on-primary bg-primary border hover:bg-primary-container disabled:opacity-50 transition-all shadow-md active:scale-95"
            >
              Save Order
            </button>
          )}
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn shadow-md"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            New Group
          </button>
        </div>
      </div>

      <AdminTable
        columns={[
          { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
          { label: 'Name', render: r => <span className="font-medium">{r.name}</span> },
          { label: 'Sort Order', render: r => r.sortOrder, width: '100px' },
        ]}
        rows={localItems}
        loading={loading}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        onReorder={setLocalItems}
      />

      <AdminFormDrawer
        title={isNew ? 'New Dependency Group' : 'Edit Dependency Group'}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onSave={handleSave}
        saving={saving}
      >
        {editing && (
          <DependencyGroupForm
            data={editing}
            errors={errors}
            onChange={updates => setEditing(prev => ({ ...prev, ...updates }))}
          />
        )}
      </AdminFormDrawer>

      {deleteTarget && (
        <DeleteConfirmDialog
          itemLabel={`Group: "${deleteTarget.name}"`}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setOrphanDetails(null) }}
          deleting={deleting}
          orphanDetails={orphanDetails}
          onForceDelete={handleForceDelete}
        />
      )}

      <StatusToast toast={toast} onClear={clearToast} />
    </div>
  )
}
