import { useState, useCallback } from 'react'
import type { AdminSubOption, AdminDependencyEntry, Toast } from '../../../types'
import { useAdminResource } from '../../../hooks/useAdminResource'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { SubOptionForm } from './SubOptionForm'

const EMPTY: Partial<AdminSubOption> = { dependencyId: '', optionId: '', label: '', description: '', sortOrder: 0 }

export function SubOptionsTab() {
  const { items, loading, create, update, remove } = useAdminResource<AdminSubOption>('/admin/sub-options')
  const { items: depEntries } = useAdminResource<AdminDependencyEntry>('/admin/dependency-entries')
  const [editing, setEditing] = useState<Partial<AdminSubOption> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminSubOption | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); setErrors({}); setDrawerOpen(true) }
  function openEdit(row: AdminSubOption) { setEditing({ ...row }); setIsNew(false); setErrors({}); setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }

  function validate(data: Partial<AdminSubOption>): Record<string, string> {
    const e: Record<string, string> = {}
    if (!data.dependencyId?.trim()) e.dependencyId = 'Required'
    if (!data.optionId?.trim()) e.optionId = 'Required'
    if (!data.label?.trim()) e.label = 'Required'
    return e
  }

  async function handleSave() {
    if (!editing) return
    const e = validate(editing)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    try {
      if (isNew) await create(editing as Omit<AdminSubOption, 'id'>)
      else await update(editing.id!, editing)
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
          <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Sub-Options</h2>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Optional extras within a dependency (e.g. Consumer Example for Kafka)</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-bold bg-primary text-on-primary hover:brightness-110 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
          New Sub-Option
        </button>
      </div>

      <AdminTable
        columns={[
          { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
          { label: 'Dep ID', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.dependencyId}</code> },
          { label: 'Option ID', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.optionId}</code> },
          { label: 'Label', render: r => r.label },
          { label: 'Sort', render: r => r.sortOrder, width: '70px' },
        ]}
        rows={items}
        loading={loading}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
      />

      <AdminFormDrawer
        title={isNew ? 'New Sub-Option' : 'Edit Sub-Option'}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onSave={handleSave}
        saving={saving}
      >
        {editing && (
          <SubOptionForm
            data={editing}
            errors={errors}
            onChange={updates => setEditing(prev => ({ ...prev, ...updates }))}
            dependencyEntries={depEntries}
          />
        )}
      </AdminFormDrawer>

      {deleteTarget && (
        <DeleteConfirmDialog
          itemLabel={`"${deleteTarget.label}" (${deleteTarget.dependencyId} / ${deleteTarget.optionId})`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      <StatusToast toast={toast} onClear={clearToast} />
    </div>
  )
}
