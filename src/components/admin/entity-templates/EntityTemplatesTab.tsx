import { useState, useCallback, useMemo } from 'react'
import type { AdminColorPalette, AdminDependencyEntry, AdminEntityTemplateFile, AdminEntityTemplateSet, Toast } from '../../../types'
import { useAdminResource, adminFetch } from '../../../hooks/useAdminResource'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { EntityTemplateSetForm } from './EntityTemplateSetForm'
import { EntityTemplateFileForm } from './EntityTemplateFileForm'

const EMPTY_SET: Partial<AdminEntityTemplateSet> = {
  setKey: '', name: '', description: '', kind: 'BACKEND_JAVA', enabled: true, sortOrder: 0,
  designSystem: null, bootVersion: null, javaVersion: null, defaultPaletteId: null,
}

function emptyFile(setId: number): Partial<AdminEntityTemplateFile> {
  return {
    setId, pathTemplate: '', content: '',
    substitutionType: 'MUSTACHE', fileType: 'TEMPLATE',
    perEntity: false, sortOrder: 0,
  }
}

export function EntityTemplatesTab() {
  const sets = useAdminResource<AdminEntityTemplateSet>('/admin/entity-template-sets')
  const { items: allDepEntries } = useAdminResource<AdminDependencyEntry>('/admin/dependency-entries')
  const { items: allPalettes } = useAdminResource<AdminColorPalette>('/admin/color-palettes')
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null)
  const filesPath = selectedSetId == null ? null : `/admin/entity-template-files?setId=${selectedSetId}`
  const files = useAdminResource<AdminEntityTemplateFile>(filesPath ?? '/admin/entity-template-files?setId=-1')

  // Set drawer
  const [editingSet, setEditingSet] = useState<Partial<AdminEntityTemplateSet> | null>(null)
  const [editingDefaultDeps, setEditingDefaultDeps] = useState<string[]>([])
  const [isNewSet, setIsNewSet] = useState(false)
  const [setDrawerOpen, setSetDrawerOpen] = useState(false)
  const [setErrors, setSetErrors] = useState<Record<string, string>>({})
  const [savingSet, setSavingSet] = useState(false)
  const [deleteSet, setDeleteSet] = useState<AdminEntityTemplateSet | null>(null)

  // File drawer
  const [editingFile, setEditingFile] = useState<Partial<AdminEntityTemplateFile> | null>(null)
  const [isNewFile, setIsNewFile] = useState(false)
  const [fileDrawerOpen, setFileDrawerOpen] = useState(false)
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({})
  const [savingFile, setSavingFile] = useState(false)
  const [deleteFile, setDeleteFile] = useState<AdminEntityTemplateFile | null>(null)

  const [toast, setToast] = useState<Toast | null>(null)

  const selectedSet = useMemo(() =>
    sets.items.find(s => s.id === selectedSetId) ?? null,
    [sets.items, selectedSetId])

  function openNewSet() {
    setEditingSet({ ...EMPTY_SET })
    setEditingDefaultDeps([])
    setIsNewSet(true)
    setSetErrors({})
    setSetDrawerOpen(true)
  }
  async function openEditSet(row: AdminEntityTemplateSet) {
    setEditingSet({ ...row })
    setIsNewSet(false)
    setSetErrors({})
    setSetDrawerOpen(true)
    setEditingDefaultDeps([])
    // Load existing default-deps separately
    try {
      const ids = await adminFetch('GET', `/admin/entity-template-sets/${row.id}/default-deps`) as string[]
      setEditingDefaultDeps(ids ?? [])
    } catch {
      setEditingDefaultDeps([])
    }
  }
  function validateSet(data: Partial<AdminEntityTemplateSet>): Record<string, string> {
    const e: Record<string, string> = {}
    if (!data.setKey?.trim()) e.setKey = 'Required'
    if (!data.name?.trim()) e.name = 'Required'
    if (!data.kind) e.kind = 'Required'
    return e
  }
  async function saveSet() {
    if (!editingSet) return
    const e = validateSet(editingSet)
    if (Object.keys(e).length > 0) { setSetErrors(e); return }
    setSavingSet(true)
    try {
      let savedId: number
      if (isNewSet) {
        // POST directly via adminFetch so we can read back the new id for the default-deps PUT.
        const created = await adminFetch('POST', '/admin/entity-template-sets', editingSet) as AdminEntityTemplateSet
        savedId = created.id
        sets.reload()
      } else {
        await sets.update(editingSet.id!, editingSet)
        savedId = editingSet.id!
      }
      // Persist default-deps for backend sets
      if (editingSet.kind === 'BACKEND_JAVA') {
        await adminFetch('PUT',
          `/admin/entity-template-sets/${savedId}/default-deps`,
          { depIds: editingDefaultDeps })
      }
      setToast({ message: 'Set saved', type: 'success' })
      setSetDrawerOpen(false)
      setEditingSet(null)
      setEditingDefaultDeps([])
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setSavingSet(false)
    }
  }
  async function doDeleteSet() {
    if (!deleteSet) return
    try {
      await sets.remove(deleteSet.id)
      if (selectedSetId === deleteSet.id) setSelectedSetId(null)
      setDeleteSet(null)
      setToast({ message: 'Set deleted', type: 'success' })
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    }
  }

  function openNewFile() {
    if (selectedSetId == null) return
    setEditingFile(emptyFile(selectedSetId))
    setIsNewFile(true)
    setFileErrors({})
    setFileDrawerOpen(true)
  }
  function openEditFile(row: AdminEntityTemplateFile) {
    setEditingFile({ ...row })
    setIsNewFile(false)
    setFileErrors({})
    setFileDrawerOpen(true)
  }
  function validateFile(data: Partial<AdminEntityTemplateFile>): Record<string, string> {
    const e: Record<string, string> = {}
    if (!data.pathTemplate?.trim()) e.pathTemplate = 'Required'
    return e
  }
  async function saveFile() {
    if (!editingFile) return
    const e = validateFile(editingFile)
    if (Object.keys(e).length > 0) { setFileErrors(e); return }
    setSavingFile(true)
    try {
      if (isNewFile) await files.create(editingFile as Omit<AdminEntityTemplateFile, 'id'>)
      else await files.update(editingFile.id!, editingFile)
      setToast({ message: 'File saved', type: 'success' })
      setFileDrawerOpen(false)
      setEditingFile(null)
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setSavingFile(false)
    }
  }
  async function doDeleteFile() {
    if (!deleteFile) return
    try {
      await files.remove(deleteFile.id)
      setDeleteFile(null)
      setToast({ message: 'File deleted', type: 'success' })
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    }
  }

  const clearToast = useCallback(() => setToast(null), [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Entity Template Sets</h2>
        <p className="text-[11px] text-on-surface-variant mt-0.5">
          Bundles of templates used by <code className="text-[11px]">POST /starter-fullstack.zip</code> to scaffold CRUD apps.
          Each set is either BACKEND_JAVA (rendered via the Spring Initializr pipeline) or FRONTEND_REACT (rendered inline alongside).
        </p>
      </div>

      <AdminTable
        columns={[
          { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
          { label: 'Key', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.setKey}</code> },
          { label: 'Name', render: r => <span className="font-medium">{r.name}</span> },
          { label: 'Kind', render: r => <span className="text-xs text-secondary">{r.kind}</span> },
          { label: 'Design System', render: r => r.designSystem ? <span className="text-xs text-secondary">{r.designSystem}</span> : <span className="text-secondary">—</span> },
          { label: 'Enabled', render: r => r.enabled ? <span className="text-emerald-600">●</span> : <span className="text-secondary">○</span>, width: '70px' },
          { label: 'Sort', render: r => r.sortOrder, width: '60px' },
        ]}
        rows={sets.items}
        loading={sets.loading}
        onEdit={openEditSet}
        onDelete={setDeleteSet}
        addButton={
          <button
            onClick={openNewSet}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn shadow-md"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            New Set
          </button>
        }
      />

      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-secondary">Files in Selected Set</h3>
        <p className="text-[11px] text-on-surface-variant mt-0.5 mb-3">
          {selectedSet
            ? <>Editing files in <code className="text-[11px] bg-surface-container-high px-1.5 py-0.5 rounded">{selectedSet.setKey}</code></>
            : <span>Select a set above to view and edit its files.</span>}
        </p>
        <div className="flex items-center gap-2 mb-3">
          <select
            className="text-sm border border-outline-variant rounded px-3 py-1.5 bg-background text-on-surface"
            value={selectedSetId ?? ''}
            onChange={e => setSelectedSetId(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">— Select a set —</option>
            {sets.items.map(s => <option key={s.id} value={s.id}>{s.setKey} ({s.kind})</option>)}
          </select>
        </div>
        {selectedSetId != null && (
          <AdminTable
            columns={[
              { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
              { label: 'Path', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.pathTemplate}</code> },
              { label: 'Per Entity', render: r => r.perEntity ? <span className="text-emerald-600">●</span> : <span className="text-secondary">○</span>, width: '90px' },
              { label: 'File Type', render: r => <span className="text-xs text-secondary">{r.fileType}</span> },
              { label: 'Sub.', render: r => <span className="text-xs text-secondary">{r.substitutionType}</span>, width: '90px' },
              { label: 'Sort', render: r => r.sortOrder, width: '60px' },
            ]}
            rows={files.items}
            loading={files.loading}
            onEdit={openEditFile}
            onDelete={setDeleteFile}
            addButton={
              <button
                onClick={openNewFile}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn shadow-md"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                New File
              </button>
            }
          />
        )}
      </div>

      <AdminFormDrawer
        title={isNewSet ? 'New Template Set' : 'Edit Template Set'}
        isOpen={setDrawerOpen}
        onClose={() => { setSetDrawerOpen(false); setEditingSet(null); setEditingDefaultDeps([]) }}
        onSave={saveSet}
        saving={savingSet}
      >
        {editingSet && (
          <EntityTemplateSetForm
            data={editingSet}
            errors={setErrors}
            onChange={u => setEditingSet(prev => ({ ...prev, ...u }))}
            defaultDeps={editingDefaultDeps}
            onDefaultDepsChange={setEditingDefaultDeps}
            catalogDeps={allDepEntries}
            palettes={allPalettes}
          />
        )}
      </AdminFormDrawer>

      <AdminFormDrawer
        title={isNewFile ? 'New Template File' : 'Edit Template File'}
        isOpen={fileDrawerOpen}
        onClose={() => { setFileDrawerOpen(false); setEditingFile(null) }}
        onSave={saveFile}
        saving={savingFile}
      >
        {editingFile && (
          <EntityTemplateFileForm
            data={editingFile}
            errors={fileErrors}
            onChange={u => setEditingFile(prev => ({ ...prev, ...u }))}
          />
        )}
      </AdminFormDrawer>

      {deleteSet && (
        <DeleteConfirmDialog
          itemLabel={`"${deleteSet.name}" (${deleteSet.setKey})`}
          onConfirm={doDeleteSet}
          onCancel={() => setDeleteSet(null)}
          deleting={false}
        />
      )}
      {deleteFile && (
        <DeleteConfirmDialog
          itemLabel={`"${deleteFile.pathTemplate}"`}
          onConfirm={doDeleteFile}
          onCancel={() => setDeleteFile(null)}
          deleting={false}
        />
      )}

      <StatusToast toast={toast} onClear={clearToast} />
    </div>
  )
}
