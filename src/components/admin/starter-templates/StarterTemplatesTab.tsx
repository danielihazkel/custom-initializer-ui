import { useState, useCallback, useEffect } from 'react'
import type { AdminStarterTemplate, AdminStarterTemplateDep, AdminDependencyEntry, Toast } from '../../../types'
import { useAdminResource, AdminApiError, adminFetch } from '../../../hooks/useAdminResource'
import { useAdminMetadata } from '../../../hooks/useAdminMetadata'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog, type OrphanDetails } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { StarterTemplateForm } from './StarterTemplateForm'
import { FieldRow, inputClass, selectClass } from '../shared/FieldRow'

const EMPTY_TEMPLATE: Partial<AdminStarterTemplate> = {
  templateId: '', name: '', description: '', icon: '', color: '',
  bootVersion: '', javaVersion: '', packaging: '', sortOrder: 0,
}

const EMPTY_DEP: Partial<AdminStarterTemplateDep> = {
  template: { id: 0 }, depId: '', subOptions: '',
}

export function StarterTemplatesTab() {
  const templates = useAdminResource<AdminStarterTemplate>('/admin/starter-templates')
  const deps = useAdminResource<AdminStarterTemplateDep>('/admin/starter-template-deps')
  const { items: depEntries } = useAdminResource<AdminDependencyEntry>('/admin/dependency-entries')
  const { bootVersions, javaVersions, packagings } = useAdminMetadata()

  // Template CRUD state
  const [editing, setEditing] = useState<Partial<AdminStarterTemplate> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminStarterTemplate | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [orphanDetails, setOrphanDetails] = useState<OrphanDetails | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [localTemplates, setLocalTemplates] = useState<AdminStarterTemplate[]>([])

  useEffect(() => { setLocalTemplates(templates.items) }, [templates.items])

  const isTemplateDirty = localTemplates.length > 0 && localTemplates.some((item, i) => item.id !== templates.items[i]?.id)

  async function handleSaveTemplateOrder() {
    setSaving(true)
    try {
      const orderings = localTemplates.map((item, i) => ({ id: item.id, sortOrder: i + 1 }))
      await adminFetch('PUT', '/admin/starter-templates/reorder', orderings)
      templates.reload()
      setToast({ message: 'Order saved successfully', type: 'success' })
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Dep CRUD state
  const [editingDep, setEditingDep] = useState<Partial<AdminStarterTemplateDep> | null>(null)
  const [isNewDep, setIsNewDep] = useState(false)
  const [depDrawerOpen, setDepDrawerOpen] = useState(false)
  const [deleteDepTarget, setDeleteDepTarget] = useState<AdminStarterTemplateDep | null>(null)
  const [depErrors, setDepErrors] = useState<Record<string, string>>({})
  const [savingDep, setSavingDep] = useState(false)
  const [deletingDep, setDeletingDep] = useState(false)

  // Template handlers
  function openNew() { setEditing({ ...EMPTY_TEMPLATE }); setIsNew(true); setErrors({}); setDrawerOpen(true) }
  function openEdit(row: AdminStarterTemplate) { setEditing({ ...row }); setIsNew(false); setErrors({}); setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }

  function validate(data: Partial<AdminStarterTemplate>): Record<string, string> {
    const e: Record<string, string> = {}
    if (!data.templateId?.trim()) e.templateId = 'Required'
    if (!data.name?.trim()) e.name = 'Required'
    return e
  }

  async function handleSave() {
    if (!editing) return
    const e = validate(editing)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    try {
      if (isNew) await templates.create(editing as Omit<AdminStarterTemplate, 'id'>)
      else await templates.update(editing.id!, editing)
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
      await templates.remove(deleteTarget.id)
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
      await templates.remove(deleteTarget.id, true)
      setToast({ message: 'Deleted successfully (with references)', type: 'success' })
      setDeleteTarget(null)
      setOrphanDetails(null)
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  // Dep handlers
  function openNewDep() { setEditingDep({ ...EMPTY_DEP }); setIsNewDep(true); setDepErrors({}); setDepDrawerOpen(true) }
  function openEditDep(row: AdminStarterTemplateDep) { setEditingDep({ ...row }); setIsNewDep(false); setDepErrors({}); setDepDrawerOpen(true) }
  function closeDepDrawer() { setDepDrawerOpen(false); setEditingDep(null) }

  function validateDep(data: Partial<AdminStarterTemplateDep>): Record<string, string> {
    const e: Record<string, string> = {}
    if (!data.template?.id) e.templateId = 'Required'
    if (!data.depId?.trim()) e.depId = 'Required'
    return e
  }

  async function handleSaveDep() {
    if (!editingDep) return
    const e = validateDep(editingDep)
    if (Object.keys(e).length > 0) { setDepErrors(e); return }
    setSavingDep(true)
    try {
      if (isNewDep) await deps.create(editingDep as Omit<AdminStarterTemplateDep, 'id'>)
      else await deps.update(editingDep.id!, editingDep)
      setToast({ message: 'Saved successfully', type: 'success' })
      closeDepDrawer()
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setSavingDep(false)
    }
  }

  async function handleDeleteDep() {
    if (!deleteDepTarget) return
    setDeletingDep(true)
    try {
      await deps.remove(deleteDepTarget.id)
      setToast({ message: 'Deleted successfully', type: 'success' })
      setDeleteDepTarget(null)
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setDeletingDep(false)
    }
  }

  const clearToast = useCallback(() => setToast(null), [])

  // Helper to resolve template name from ID
  const templateName = (id: number) => templates.items.find(t => t.id === id)?.name ?? `#${id}`

  return (
    <div className="space-y-10">
      {/* Templates section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Starter Templates</h2>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Pre-configured project templates shown in the Quick Start section</p>
        </div>

        <AdminTable
          columns={[
            { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
            { label: 'Template ID', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.templateId}</code> },
            { label: 'Name', render: r => r.name },
            { label: 'Description', render: r => <span className="text-xs text-secondary truncate max-w-[200px] inline-block">{r.description}</span> },
            { label: 'Icon', render: r => r.icon ? <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{r.icon}</span> : '—' , width: '60px' },
            { label: 'Sort', render: r => r.sortOrder, width: '60px' },
          ]}
          rows={localTemplates}
          loading={templates.loading}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
          onReorder={setLocalTemplates}
          addButton={
            <>
              {isTemplateDirty && (
                <button
                  onClick={handleSaveTemplateOrder}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-on-primary bg-primary border hover:bg-primary-container disabled:opacity-50 transition-all shadow-md active:scale-95"
                >
                  Save Order
                </button>
              )}
              <button
                onClick={openNew}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-bold bg-primary text-on-primary hover:brightness-110 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                New Template
              </button>
            </>
          }
        />
      </div>

      {/* Template Dependencies section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Template Dependencies</h2>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Dependencies included in each template</p>
        </div>

        <AdminTable
          columns={[
            { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
            { label: 'Template', render: r => templateName(r.template?.id ?? 0) },
            { label: 'Dep ID', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.depId}</code> },
            { label: 'Sub-Options', render: r => r.subOptions || '—' },
          ]}
          rows={deps.items}
          loading={deps.loading}
          onEdit={openEditDep}
          onDelete={setDeleteDepTarget}
          addButton={
            <button
              onClick={openNewDep}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-bold bg-primary text-on-primary hover:brightness-110 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              New Dep Mapping
            </button>
          }
        />
      </div>

      {/* Template form drawer */}
      <AdminFormDrawer
        title={isNew ? 'New Template' : 'Edit Template'}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onSave={handleSave}
        saving={saving}
      >
        {editing && (
          <StarterTemplateForm
            data={editing}
            errors={errors}
            onChange={updates => setEditing(prev => ({ ...prev, ...updates }))}
            bootVersions={bootVersions}
            javaVersions={javaVersions}
            packagings={packagings}
          />
        )}
      </AdminFormDrawer>

      {/* Dep form drawer */}
      <AdminFormDrawer
        title={isNewDep ? 'New Dep Mapping' : 'Edit Dep Mapping'}
        isOpen={depDrawerOpen}
        onClose={closeDepDrawer}
        onSave={handleSaveDep}
        saving={savingDep}
      >
        {editingDep && (
          <>
            <FieldRow label="Template" required error={depErrors.templateId}>
              <select
                className={inputClass}
                value={editingDep.template?.id ?? 0}
                onChange={e => setEditingDep(prev => ({ ...prev, template: { id: parseInt(e.target.value) || 0 } }))}
              >
                <option value={0}>— Select —</option>
                {templates.items.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.templateId})</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Dep ID" required error={depErrors.depId} hint="Must match an existing dependency entry">
              <select
                className={selectClass}
                value={editingDep.depId ?? ''}
                onChange={e => setEditingDep(prev => ({ ...prev, depId: e.target.value }))}
              >
                <option value="">— Select —</option>
                {depEntries.map(d => <option key={d.depId} value={d.depId}>{d.name} ({d.depId})</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Sub-Options" hint="Comma-separated sub-option IDs (e.g. consumer-example,producer-example)">
              <input
                className={inputClass}
                value={editingDep.subOptions ?? ''}
                onChange={e => setEditingDep(prev => ({ ...prev, subOptions: e.target.value }))}
                placeholder="consumer-example,producer-example"
              />
            </FieldRow>
          </>
        )}
      </AdminFormDrawer>

      {/* Delete dialogs */}
      {deleteTarget && (
        <DeleteConfirmDialog
          itemLabel={`template "${deleteTarget.name}" (${deleteTarget.templateId})`}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setOrphanDetails(null) }}
          deleting={deleting}
          orphanDetails={orphanDetails}
          onForceDelete={handleForceDelete}
        />
      )}

      {deleteDepTarget && (
        <DeleteConfirmDialog
          itemLabel={`dep mapping "${deleteDepTarget.depId}" from template #${deleteDepTarget.template?.id}`}
          onConfirm={handleDeleteDep}
          onCancel={() => setDeleteDepTarget(null)}
          deleting={deletingDep}
        />
      )}

      <StatusToast toast={toast} onClear={clearToast} />
    </div>
  )
}
