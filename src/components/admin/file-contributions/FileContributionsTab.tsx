import { useState, useCallback } from 'react'
import type { AdminFileContribution, AdminDependencyEntry, AdminSubOption, Toast } from '../../../types'
import { useAdminResource } from '../../../hooks/useAdminResource'
import { useAdminMetadata } from '../../../hooks/useAdminMetadata'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { FileContributionForm } from './FileContributionForm'

const EMPTY: Partial<AdminFileContribution> = {
  dependencyId: '', fileType: 'STATIC_COPY', content: '',
  targetPath: '', substitutionType: 'NONE', javaVersion: '', subOptionId: '', sortOrder: 0
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

export function FileContributionsTab() {
  const { items, loading, create, update, remove } = useAdminResource<AdminFileContribution>('/admin/file-contributions')
  const { items: depEntries } = useAdminResource<AdminDependencyEntry>('/admin/dependency-entries')
  const { items: subOptions } = useAdminResource<AdminSubOption>('/admin/sub-options')
  const { javaVersions } = useAdminMetadata()
  const [editing, setEditing] = useState<Partial<AdminFileContribution> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminFileContribution | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); setErrors({}); setDrawerOpen(true) }
  function openEdit(row: AdminFileContribution) { setEditing({ ...row }); setIsNew(false); setErrors({}); setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }

  function validate(data: Partial<AdminFileContribution>): Record<string, string> {
    const e: Record<string, string> = {}
    if (!data.dependencyId?.trim()) e.dependencyId = 'Required'
    if (!data.fileType) e.fileType = 'Required'
    if (!data.targetPath?.trim()) e.targetPath = 'Required'
    return e
  }

  async function handleSave() {
    if (!editing) return
    const e = validate(editing)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    try {
      if (isNew) await create(editing as Omit<AdminFileContribution, 'id'>)
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
          <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">File Contributions</h2>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Files, YAML merges, and templates injected into generated projects</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-bold bg-primary text-on-primary hover:brightness-110 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
          New Contribution
        </button>
      </div>

      <AdminTable
        columns={[
          { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
          { label: 'Dep ID', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.dependencyId}</code> },
          { label: 'Type', render: r => <span className="text-xs font-medium text-primary">{r.fileType}</span> },
          { label: 'Target Path', render: r => <code className="text-xs text-secondary">{truncate(r.targetPath, 50)}</code> },
          { label: 'Sub-Opt', render: r => r.subOptionId ? <code className="text-xs bg-surface-container-high px-1 rounded">{r.subOptionId}</code> : <span className="text-secondary text-xs">—</span>, width: '100px' },
          { label: 'Sort', render: r => r.sortOrder, width: '60px' },
        ]}
        rows={items}
        loading={loading}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
      />

      <AdminFormDrawer
        title={isNew ? 'New File Contribution' : 'Edit File Contribution'}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onSave={handleSave}
        saving={saving}
      >
        {editing && (
          <FileContributionForm
            data={editing}
            errors={errors}
            onChange={updates => setEditing(prev => ({ ...prev, ...updates }))}
            dependencyEntries={depEntries}
            subOptions={subOptions}
            javaVersions={javaVersions}
          />
        )}
      </AdminFormDrawer>

      {deleteTarget && (
        <DeleteConfirmDialog
          itemLabel={`${deleteTarget.fileType} → ${deleteTarget.targetPath}`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      <StatusToast toast={toast} onClear={clearToast} />
    </div>
  )
}
