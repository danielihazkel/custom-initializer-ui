import { useState, useCallback } from 'react'
import type { AdminBuildCustomization, AdminDependencyEntry, Toast } from '../../../types'
import { useAdminResource } from '../../../hooks/useAdminResource'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { BuildCustomizationForm } from './BuildCustomizationForm'

const EMPTY: Partial<AdminBuildCustomization> = {
  dependencyId: '', customizationType: undefined,
  mavenGroupId: '', mavenArtifactId: '', version: '',
  excludeFromGroupId: '', excludeFromArtifactId: '',
  repoId: '', repoName: '', repoUrl: '', snapshotsEnabled: false, sortOrder: 0
}

export function BuildCustomizationsTab() {
  const { items, loading, create, update, remove } = useAdminResource<AdminBuildCustomization>('/admin/build-customizations')
  const { items: depEntries } = useAdminResource<AdminDependencyEntry>('/admin/dependency-entries')
  const [editing, setEditing] = useState<Partial<AdminBuildCustomization> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminBuildCustomization | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); setErrors({}); setDrawerOpen(true) }
  function openEdit(row: AdminBuildCustomization) { setEditing({ ...row }); setIsNew(false); setErrors({}); setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }

  function validate(data: Partial<AdminBuildCustomization>): Record<string, string> {
    const e: Record<string, string> = {}
    if (!data.dependencyId?.trim()) e.dependencyId = 'Required'
    if (!data.customizationType) e.customizationType = 'Required'
    if (data.customizationType === 'ADD_DEPENDENCY' || data.customizationType === 'EXCLUDE_DEPENDENCY') {
      if (!data.mavenGroupId?.trim()) e.mavenGroupId = 'Required'
      if (!data.mavenArtifactId?.trim()) e.mavenArtifactId = 'Required'
    }
    if (data.customizationType === 'EXCLUDE_DEPENDENCY') {
      if (!data.excludeFromGroupId?.trim()) e.excludeFromGroupId = 'Required'
      if (!data.excludeFromArtifactId?.trim()) e.excludeFromArtifactId = 'Required'
    }
    if (data.customizationType === 'ADD_REPOSITORY') {
      if (!data.repoId?.trim()) e.repoId = 'Required'
      if (!data.repoUrl?.trim()) e.repoUrl = 'Required'
    }
    return e
  }

  async function handleSave() {
    if (!editing) return
    const e = validate(editing)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    try {
      if (isNew) await create(editing as Omit<AdminBuildCustomization, 'id'>)
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

  function describeRow(r: AdminBuildCustomization): string {
    if (r.customizationType === 'ADD_REPOSITORY') return r.repoId ?? ''
    return [r.mavenGroupId, r.mavenArtifactId].filter(Boolean).join(':')
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Build Customizations</h2>
        <p className="text-[11px] text-on-surface-variant mt-0.5">Maven pom.xml modifications — add/exclude deps, add repositories</p>
      </div>

      <AdminTable
        columns={[
          { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
          { label: 'Dep ID', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.dependencyId}</code> },
          { label: 'Type', render: r => <span className="text-xs font-medium text-primary">{r.customizationType}</span> },
          { label: 'Target', render: r => <code className="text-xs text-secondary">{describeRow(r)}</code> },
          { label: 'Sort', render: r => r.sortOrder, width: '60px' },
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
            New Customization
          </button>
        }
      />

      <AdminFormDrawer
        title={isNew ? 'New Build Customization' : 'Edit Build Customization'}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onSave={handleSave}
        saving={saving}
      >
        {editing && (
          <BuildCustomizationForm
            data={editing}
            isEditing={!isNew}
            errors={errors}
            onChange={updates => setEditing(prev => ({ ...prev, ...updates }))}
            dependencyEntries={depEntries}
          />
        )}
      </AdminFormDrawer>

      {deleteTarget && (
        <DeleteConfirmDialog
          itemLabel={`${deleteTarget.customizationType} — ${describeRow(deleteTarget)}`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      <StatusToast toast={toast} onClear={clearToast} />
    </div>
  )
}
