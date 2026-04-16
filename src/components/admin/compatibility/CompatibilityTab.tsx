import { useState, useCallback, useMemo, useEffect } from 'react'
import { List, Share2 } from 'lucide-react'
import type { AdminDependencyCompatibility, AdminDependencyEntry, Toast } from '../../../types'
import { useAdminResource, adminFetch } from '../../../hooks/useAdminResource'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { CompatibilityForm } from './CompatibilityForm'
import { CompatibilityGraph } from './CompatibilityGraph'

type ViewMode = 'table' | 'graph'

const EMPTY: Partial<AdminDependencyCompatibility> = {
  sourceDepId: '', targetDepId: '', relationType: undefined, description: '', sortOrder: 0,
}

const RELATION_BADGE: Record<string, string> = {
  CONFLICTS:  'bg-error/10 text-error border-error/20',
  REQUIRES:   'bg-warning/10 text-warning border-warning/20',
  RECOMMENDS: 'bg-primary/10 text-primary border-primary/20',
}

export function CompatibilityTab() {
  const { items, loading, create, update, remove, reload } = useAdminResource<AdminDependencyCompatibility>('/admin/compatibility')
  const { items: depEntries } = useAdminResource<AdminDependencyEntry>('/admin/dependency-entries')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [tableQuery, setTableQuery] = useState('')
  const [localItems, setLocalItems] = useState<AdminDependencyCompatibility[]>([])

  useEffect(() => { setLocalItems(items) }, [items])

  const isDirty = localItems.length > 0 && localItems.some((item, i) => item.id !== items[i]?.id)

  async function handleSaveOrder() {
    setSaving(true)
    try {
      const orderings = localItems.map((item, i) => ({ id: item.id, sortOrder: i + 1 }))
      await adminFetch('PUT', '/admin/compatibility/reorder', orderings)
      reload()
      setToast({ message: 'Order saved successfully', type: 'success' })
    } catch (err) {
      setToast({ message: String(err), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const filteredItems = useMemo(() => {
    if (!tableQuery.trim()) return localItems
    const q = tableQuery.toLowerCase()
    return localItems.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(q)))
  }, [localItems, tableQuery])
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
      <div className="sticky top-0 z-10 bg-background border-b border-outline-variant py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-surface-variant/50 p-0.5 rounded-lg border border-outline-variant">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-primary text-on-primary shadow' : 'text-secondary hover:text-on-surface'}`}
            >
              <List size={13} />
              Table
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold transition-all ${viewMode === 'graph' ? 'bg-primary text-on-primary shadow' : 'text-secondary hover:text-on-surface'}`}
            >
              <Share2 size={13} />
              Graph
            </button>
          </div>
          {/* Search — only in table mode */}
          {viewMode === 'table' && (
            <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-xl border border-outline-variant max-w-sm shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: '20px' }}>search</span>
              <input
                type="text"
                placeholder="Search..."
                value={tableQuery}
                onChange={e => setTableQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full text-on-surface placeholder:text-secondary"
              />
              {tableQuery && (
                <button onClick={() => setTableQuery('')} className="text-secondary hover:text-on-surface">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && viewMode === 'table' && (
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
            className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-bold bg-primary text-on-primary hover:brightness-110 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
            New Rule
          </button>
        </div>
      </div>

      {viewMode === 'graph' && (
        <CompatibilityGraph rules={items} onEditRule={openEdit} />
      )}

      {viewMode === 'table' && (
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
          rows={filteredItems}
          loading={loading}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
          onReorder={setLocalItems}
          searchable={false}
        />
      )}

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
            dependencyEntries={depEntries}
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
