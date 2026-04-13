import { useState, useCallback } from 'react'
import type { AdminDependencyEntry, AdminDependencyGroup, Toast } from '../../../types'
import { useAdminResource, AdminApiError } from '../../../hooks/useAdminResource'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog, type OrphanDetails } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { DependencyEntryForm } from './DependencyEntryForm'

const EMPTY: Partial<AdminDependencyEntry> = {
  group: { id: 0 }, depId: '', name: '', description: '',
  mavenGroupId: '', mavenArtifactId: '', version: '', scope: '', repository: '',
  compatibilityRange: '', sortOrder: 0
}

export function DependencyEntriesTab() {
  const { items, loading, create, update, remove } = useAdminResource<AdminDependencyEntry>('/admin/dependency-entries')
  const { items: groups } = useAdminResource<AdminDependencyGroup>('/admin/dependency-groups')
  const [editing, setEditing] = useState<Partial<AdminDependencyEntry> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminDependencyEntry | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [orphanDetails, setOrphanDetails] = useState<OrphanDetails | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  const groupName = (id: number) => groups.find(g => g.id === id)?.name ?? id

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); setErrors({}); setDrawerOpen(true) }
  function openEdit(row: AdminDependencyEntry) { setEditing({ ...row }); setIsNew(false); setErrors({}); setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }

  function validate(data: Partial<AdminDependencyEntry>): Record<string, string> {
    const e: Record<string, string> = {}
    if (!data.group?.id) e.group = 'Required'
    if (!data.depId?.trim()) e.depId = 'Required'
    if (!data.name?.trim()) e.name = 'Required'
    return e
  }

  async function handleSave() {
    if (!editing) return
    const e = validate(editing)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    try {
      if (isNew) await create(editing as Omit<AdminDependencyEntry, 'id'>)
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
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Dependency Entries</h2>
        <p className="text-[11px] text-on-surface-variant mt-0.5">Individual dependencies shown in the UI dependency picker</p>
      </div>

      <AdminTable
        columns={[
          { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
          { label: 'Dep ID', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.depId}</code> },
          { label: 'Name', render: r => <span className="font-medium">{r.name}</span> },
          { label: 'Group', render: r => <span className="text-secondary text-xs">{groupName(r.group?.id)}</span> },
          { label: 'Artifact', render: r => r.mavenArtifactId ? <code className="text-xs text-secondary">{r.mavenArtifactId}</code> : <span className="text-secondary text-xs">—</span> },
          { label: 'Range', render: r => r.compatibilityRange ? <code className="text-xs text-secondary">{r.compatibilityRange}</code> : <span className="text-secondary text-xs">—</span> },
          { label: 'Sort', render: r => r.sortOrder, width: '60px' },
        ]}
        rows={items}
        loading={loading}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        addButton={
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn shadow-md"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            New Entry
          </button>
        }
      />

      <AdminFormDrawer
        title={isNew ? 'New Dependency Entry' : 'Edit Dependency Entry'}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onSave={handleSave}
        saving={saving}
      >
        {editing && (
          <DependencyEntryForm
            data={editing}
            groups={groups}
            errors={errors}
            onChange={updates => setEditing(prev => ({ ...prev, ...updates }))}
          />
        )}
      </AdminFormDrawer>

      {deleteTarget && (
        <DeleteConfirmDialog
          itemLabel={`"${deleteTarget.name}" (${deleteTarget.depId})`}
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
