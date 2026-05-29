import { useState, useCallback, useMemo } from 'react'
import type { AdminVersion, VersionKind, Toast } from '../../../types'
import { useAdminResource } from '../../../hooks/useAdminResource'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { VersionForm } from './VersionForm'

const KIND_TABS: { id: VersionKind; label: string }[] = [
  { id: 'JAVA',            label: 'Java' },
  { id: 'BOOT',            label: 'Spring Boot' },
  { id: 'REACT',           label: 'React' },
  { id: 'NODE',            label: 'Node' },
  { id: 'PACKAGE_MANAGER', label: 'Package Mgr' },
]

const EMPTY = (kind: VersionKind): Partial<AdminVersion> => ({
  kind,
  versionId: '',
  displayName: '',
  isDefault: false,
  enabled: true,
  sortOrder: 0,
  npmSemver: '',
  typesSemver: '',
})

export function VersionsTab() {
  const { items: allItems, loading, create, update, remove } = useAdminResource<AdminVersion>('/admin/versions')
  const [kind, setKind] = useState<VersionKind>('JAVA')
  const items = useMemo(() => allItems.filter(v => v.kind === kind), [allItems, kind])
  const [editing, setEditing] = useState<Partial<AdminVersion> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminVersion | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  function openNew() { setEditing(EMPTY(kind)); setIsNew(true); setErrors({}); setDrawerOpen(true) }
  function openEdit(row: AdminVersion) { setEditing({ ...row }); setIsNew(false); setErrors({}); setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }

  function validate(data: Partial<AdminVersion>): Record<string, string> {
    const e: Record<string, string> = {}
    if (!data.kind) e.kind = 'Required'
    if (!data.versionId?.trim()) e.versionId = 'Required'
    if (!data.displayName?.trim()) e.displayName = 'Required'
    return e
  }

  async function handleSave() {
    if (!editing) return
    const e = validate(editing)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    try {
      const payload: Partial<AdminVersion> = {
        ...editing,
        npmSemver: editing.npmSemver?.trim() ? editing.npmSemver.trim() : null,
        typesSemver: editing.typesSemver?.trim() ? editing.typesSemver.trim() : null,
      }
      if (isNew) await create(payload as Omit<AdminVersion, 'id'>)
      else await update(editing.id!, payload)
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
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Versions</h2>
        <p className="text-[11px] text-on-surface-variant mt-0.5">
          Selectable Java, Spring Boot, React, Node, and package-manager versions surfaced in the wizard dropdowns. Edits hot-reload through <code>/admin/refresh</code> — no restart needed.
        </p>
      </div>

      <div className="inline-flex p-0.5 rounded-xl border border-outline-variant bg-surface-container-high">
        {KIND_TABS.map(t => {
          const active = t.id === kind
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setKind(t.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                active ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:text-on-surface'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <AdminTable
        columns={[
          { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
          { label: 'Version', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.versionId}</code> },
          { label: 'Display Name', render: r => r.displayName },
          { label: 'Default', render: r => r.isDefault ? 'Yes' : '', width: '80px' },
          { label: 'Enabled', render: r => r.enabled ? 'Yes' : 'No', width: '80px' },
          { label: 'npm Semver', render: r => r.npmSemver ? <code className="text-xs">{r.npmSemver}</code> : '', width: '120px' },
          { label: '@types', render: r => r.typesSemver ? <code className="text-xs">{r.typesSemver}</code> : '', width: '120px' },
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
            New Version
          </button>
        }
      />

      <AdminFormDrawer
        title={isNew ? 'New Version' : 'Edit Version'}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onSave={handleSave}
        saving={saving}
      >
        {editing && (
          <VersionForm
            data={editing}
            errors={errors}
            onChange={updates => setEditing(prev => ({ ...prev, ...updates }))}
            lockedKind={isNew ? kind : undefined}
          />
        )}
      </AdminFormDrawer>

      {deleteTarget && (
        <DeleteConfirmDialog
          itemLabel={`"${deleteTarget.displayName}" (${deleteTarget.kind} / ${deleteTarget.versionId})`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      <StatusToast toast={toast} onClear={clearToast} />
    </div>
  )
}
