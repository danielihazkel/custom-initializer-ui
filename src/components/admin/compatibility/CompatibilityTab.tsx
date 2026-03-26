import { useState, useCallback } from 'react'
import type { AdminDependencyCompatibility, Toast } from '../../../types'
import { useAdminResource } from '../../../hooks/useAdminResource'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { CompatibilityForm } from './CompatibilityForm'

const EMPTY: Partial<AdminDependencyCompatibility> = {
  sourceDepId: '', targetDepId: '', relationType: undefined, description: '', sortOrder: 0,
}

const RELATION_BADGE: Record<string, string> = {
  CONFLICTS:  'bg-error/10 text-error border-error/20',
  REQUIRES:   'bg-warning/10 text-warning border-warning/20',
  RECOMMENDS: 'bg-primary/10 text-primary border-primary/20',
}

export function CompatibilityTab() {
  const { items, loading, create, update, remove } = useAdminResource<AdminDependencyCompatibility>('/admin/compatibility')
  const [editing, setEditing] = useState<Partial<AdminDependencyCompatibility> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminDependencyCompatibility | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); setErrors({}); setDrawerOpen(true) }
  function openEdit(row: AdminDependencyCompatibility) { setEditing({ ...row }); setIsNew(false); setErrors({}); setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }

  function validate(data: Partial<AdminDependencyCompatibility>): Record<string, string> {
    const e: Record<string, string> = {}
    if (!data.sourceDepId?.trim()) e.sourceDepId = 'Required'
    if (!data.targetDepId?.trim()) e.targetDepId = 'Required'
    if (!data.relationType) e.relationType = 'Required'
    return e
  }

  async function handleSave() {
    if (!editing) return
    const e = validate(editing)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    try {
      if (isNew) await create(editing as Omit<AdminDependencyCompatibility, 'id'>)
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
          <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Compatibility Rules</h2>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Define REQUIRES, CONFLICTS, and RECOMMENDS relationships between dependencies</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-bold bg-primary text-on-primary hover:brightness-110 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
          New Rule
        </button>
      </div>

      <AdminTable
        columns={[
          { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
          { label: 'Source', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.sourceDepId}</code> },
          { label: 'Relation', render: r => (
            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${RELATION_BADGE[r.relationType] ?? ''}`}>
              {r.relationType}
            </span>
          )},
          { label: 'Target', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.targetDepId}</code> },
          { label: 'Description', render: r => <span className="text-xs text-on-surface-variant truncate max-w-xs block">{r.description}</span> },
          { label: 'Sort', render: r => r.sortOrder, width: '70px' },
        ]}
        rows={items}
        loading={loading}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
      />

      <AdminFormDrawer
        title={isNew ? 'New Compatibility Rule' : 'Edit Compatibility Rule'}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onSave={handleSave}
        saving={saving}
      >
        {editing && (
          <CompatibilityForm
            data={editing}
            errors={errors}
            onChange={updates => setEditing(prev => ({ ...prev, ...updates }))}
          />
        )}
      </AdminFormDrawer>

      {deleteTarget && (
        <DeleteConfirmDialog
          itemLabel={`"${deleteTarget.sourceDepId} ${deleteTarget.relationType} ${deleteTarget.targetDepId}"`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      <StatusToast toast={toast} onClear={clearToast} />
    </div>
  )
}
