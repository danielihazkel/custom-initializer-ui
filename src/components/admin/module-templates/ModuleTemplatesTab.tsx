import { useState, useCallback } from 'react'
import type { AdminModuleTemplate, AdminModuleDependencyMapping, Toast } from '../../../types'
import { useAdminResource } from '../../../hooks/useAdminResource'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { ModuleTemplateForm } from './ModuleTemplateForm'
import { FieldRow, inputClass } from '../shared/FieldRow'

const EMPTY_MODULE: Partial<AdminModuleTemplate> = {
  moduleId: '', label: '', description: '', suffix: '-',
  packaging: 'jar', hasMainClass: false, sortOrder: 0,
}

const EMPTY_MAPPING: Partial<AdminModuleDependencyMapping> = {
  dependencyId: '', moduleId: '', sortOrder: 0,
}

export function ModuleTemplatesTab() {
  const modules = useAdminResource<AdminModuleTemplate>('/admin/module-templates')
  const mappings = useAdminResource<AdminModuleDependencyMapping>('/admin/module-dep-mappings')

  // Module CRUD state
  const [editing, setEditing] = useState<Partial<AdminModuleTemplate> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminModuleTemplate | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  // Mapping CRUD state
  const [editingMapping, setEditingMapping] = useState<Partial<AdminModuleDependencyMapping> | null>(null)
  const [isNewMapping, setIsNewMapping] = useState(false)
  const [mappingDrawerOpen, setMappingDrawerOpen] = useState(false)
  const [deleteMappingTarget, setDeleteMappingTarget] = useState<AdminModuleDependencyMapping | null>(null)
  const [mappingErrors, setMappingErrors] = useState<Record<string, string>>({})
  const [savingMapping, setSavingMapping] = useState(false)
  const [deletingMapping, setDeletingMapping] = useState(false)

  // Module handlers
  function openNew() { setEditing({ ...EMPTY_MODULE }); setIsNew(true); setErrors({}); setDrawerOpen(true) }
  function openEdit(row: AdminModuleTemplate) { setEditing({ ...row }); setIsNew(false); setErrors({}); setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }

  function validate(data: Partial<AdminModuleTemplate>): Record<string, string> {
    const e: Record<string, string> = {}
    if (!data.moduleId?.trim()) e.moduleId = 'Required'
    if (!data.label?.trim()) e.label = 'Required'
    if (!data.suffix?.trim()) e.suffix = 'Required'
    return e
  }

  async function handleSave() {
    if (!editing) return
    const e = validate(editing)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    try {
      if (isNew) await modules.create(editing as Omit<AdminModuleTemplate, 'id'>)
      else await modules.update(editing.id!, editing)
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
      await modules.remove(deleteTarget.id)
      setToast({ message: 'Deleted successfully', type: 'success' })
      setDeleteTarget(null)
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  // Mapping handlers
  function openNewMapping() { setEditingMapping({ ...EMPTY_MAPPING }); setIsNewMapping(true); setMappingErrors({}); setMappingDrawerOpen(true) }
  function openEditMapping(row: AdminModuleDependencyMapping) { setEditingMapping({ ...row }); setIsNewMapping(false); setMappingErrors({}); setMappingDrawerOpen(true) }
  function closeMappingDrawer() { setMappingDrawerOpen(false); setEditingMapping(null) }

  function validateMapping(data: Partial<AdminModuleDependencyMapping>): Record<string, string> {
    const e: Record<string, string> = {}
    if (!data.moduleId?.trim()) e.moduleId = 'Required'
    if (!data.dependencyId?.trim()) e.dependencyId = 'Required'
    return e
  }

  async function handleSaveMapping() {
    if (!editingMapping) return
    const e = validateMapping(editingMapping)
    if (Object.keys(e).length > 0) { setMappingErrors(e); return }
    setSavingMapping(true)
    try {
      if (isNewMapping) await mappings.create(editingMapping as Omit<AdminModuleDependencyMapping, 'id'>)
      else await mappings.update(editingMapping.id!, editingMapping)
      setToast({ message: 'Saved successfully', type: 'success' })
      closeMappingDrawer()
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setSavingMapping(false)
    }
  }

  async function handleDeleteMapping() {
    if (!deleteMappingTarget) return
    setDeletingMapping(true)
    try {
      await mappings.remove(deleteMappingTarget.id)
      setToast({ message: 'Deleted successfully', type: 'success' })
      setDeleteMappingTarget(null)
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setDeletingMapping(false)
    }
  }

  const clearToast = useCallback(() => setToast(null), [])

  return (
    <div className="space-y-10">
      {/* Module Templates section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Module Templates</h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Define sub-modules for multi-module project generation</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-bold bg-primary text-on-primary hover:brightness-110 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
            New Module
          </button>
        </div>

        <AdminTable
          columns={[
            { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
            { label: 'Module ID', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.moduleId}</code> },
            { label: 'Label', render: r => r.label },
            { label: 'Suffix', render: r => <code className="text-xs">{r.suffix}</code> },
            { label: 'Pkg', render: r => r.packaging, width: '60px' },
            { label: 'Main', render: r => r.hasMainClass ? <span className="text-tertiary">Yes</span> : '—', width: '60px' },
            { label: 'Sort', render: r => r.sortOrder, width: '60px' },
          ]}
          rows={modules.items}
          loading={modules.loading}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
        />
      </div>

      {/* Module Dependency Mappings section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Module Dependency Mappings</h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Map dependencies to specific modules</p>
          </div>
          <button
            onClick={openNewMapping}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-bold bg-primary text-on-primary hover:brightness-110 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
            New Mapping
          </button>
        </div>

        <AdminTable
          columns={[
            { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
            { label: 'Module', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.moduleId}</code> },
            { label: 'Dependency', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.dependencyId}</code> },
            { label: 'Sort', render: r => r.sortOrder, width: '60px' },
          ]}
          rows={mappings.items}
          loading={mappings.loading}
          onEdit={openEditMapping}
          onDelete={setDeleteMappingTarget}
        />
      </div>

      {/* Module form drawer */}
      <AdminFormDrawer
        title={isNew ? 'New Module' : 'Edit Module'}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onSave={handleSave}
        saving={saving}
      >
        {editing && (
          <ModuleTemplateForm
            data={editing}
            errors={errors}
            onChange={updates => setEditing(prev => ({ ...prev, ...updates }))}
          />
        )}
      </AdminFormDrawer>

      {/* Mapping form drawer */}
      <AdminFormDrawer
        title={isNewMapping ? 'New Mapping' : 'Edit Mapping'}
        isOpen={mappingDrawerOpen}
        onClose={closeMappingDrawer}
        onSave={handleSaveMapping}
        saving={savingMapping}
      >
        {editingMapping && (
          <>
            <FieldRow label="Module" required error={mappingErrors.moduleId} hint="Module ID to assign the dependency to">
              <select
                className={inputClass}
                value={editingMapping.moduleId ?? ''}
                onChange={e => setEditingMapping(prev => ({ ...prev, moduleId: e.target.value }))}
              >
                <option value="">— Select —</option>
                {modules.items.map(m => (
                  <option key={m.id} value={m.moduleId}>{m.label} ({m.moduleId})</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Dependency ID" required error={mappingErrors.dependencyId} hint="Must match an existing dependency entry (e.g. web, kafka)">
              <input
                className={inputClass}
                value={editingMapping.dependencyId ?? ''}
                onChange={e => setEditingMapping(prev => ({ ...prev, dependencyId: e.target.value }))}
                placeholder="web"
              />
            </FieldRow>
            <FieldRow label="Sort Order">
              <input
                type="number"
                className={inputClass}
                value={editingMapping.sortOrder ?? 0}
                onChange={e => setEditingMapping(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
              />
            </FieldRow>
          </>
        )}
      </AdminFormDrawer>

      {/* Delete dialogs */}
      {deleteTarget && (
        <DeleteConfirmDialog
          itemLabel={`module "${deleteTarget.label}" (${deleteTarget.moduleId})`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {deleteMappingTarget && (
        <DeleteConfirmDialog
          itemLabel={`mapping "${deleteMappingTarget.dependencyId}" → ${deleteMappingTarget.moduleId}`}
          onConfirm={handleDeleteMapping}
          onCancel={() => setDeleteMappingTarget(null)}
          deleting={deletingMapping}
        />
      )}

      <StatusToast toast={toast} onClear={clearToast} />
    </div>
  )
}
