import { useState, useCallback } from 'react'
import type { AdminColorPalette, Toast } from '../../../types'
import { useAdminResource } from '../../../hooks/useAdminResource'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { ColorPaletteForm } from './ColorPaletteForm'

const HEX = /^#[0-9a-fA-F]{6}$/

const EMPTY: Partial<AdminColorPalette> = {
  paletteId: '',
  name: '',
  description: '',
  primary: '#1976d2',
  secondary: '#9c27b0',
  accent: '',
  error: '',
  isDefault: false,
  sortOrder: 0,
}

function Swatch({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block w-5 h-5 rounded-full border border-outline-variant shrink-0"
        style={{ background: color }}
      />
      <code className="text-xs text-on-surface-variant">{color}</code>
    </div>
  )
}

export function ColorPalettesTab() {
  const { items, loading, create, update, remove } =
    useAdminResource<AdminColorPalette>('/admin/color-palettes')
  const [editing, setEditing] = useState<Partial<AdminColorPalette> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminColorPalette | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); setErrors({}); setDrawerOpen(true) }
  function openEdit(row: AdminColorPalette) { setEditing({ ...row }); setIsNew(false); setErrors({}); setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }

  function validate(data: Partial<AdminColorPalette>): Record<string, string> {
    const e: Record<string, string> = {}
    if (!data.paletteId?.trim()) e.paletteId = 'Required'
    if (!data.name?.trim()) e.name = 'Required'
    if (!data.primary || !HEX.test(data.primary)) e.primary = 'Must be a 6-digit hex (#1976d2)'
    if (!data.secondary || !HEX.test(data.secondary)) e.secondary = 'Must be a 6-digit hex (#9c27b0)'
    if (data.accent && !HEX.test(data.accent)) e.accent = 'Must be a 6-digit hex or empty'
    if (data.error && !HEX.test(data.error)) e.error = 'Must be a 6-digit hex or empty'
    return e
  }

  async function handleSave() {
    if (!editing) return
    const e = validate(editing)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    // Strip blanks so backend coerces them to null on optional hex columns
    const payload: Partial<AdminColorPalette> = {
      ...editing,
      accent: editing.accent?.trim() ? editing.accent : null,
      error: editing.error?.trim() ? editing.error : null,
    }
    setSaving(true)
    try {
      if (isNew) await create(payload as Omit<AdminColorPalette, 'id'>)
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
        <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Color Palettes</h2>
        <p className="text-[11px] text-on-surface-variant mt-0.5">Frontend-only — selectable when generating a project with a themed design system (MUI / Chakra / Mantine)</p>
      </div>

      <AdminTable
        columns={[
          { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
          { label: 'Palette ID', render: r => <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.paletteId}</code> },
          { label: 'Name', render: r => r.name },
          { label: 'Primary', render: r => <Swatch color={r.primary} /> },
          { label: 'Secondary', render: r => <Swatch color={r.secondary} /> },
          {
            label: 'Default',
            render: r => r.isDefault
              ? <span className="text-xs font-semibold text-primary">★ default</span>
              : <span className="text-xs text-on-surface-variant">—</span>,
            width: '90px',
          },
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
            New Palette
          </button>
        }
      />

      <AdminFormDrawer
        title={isNew ? 'New Palette' : 'Edit Palette'}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onSave={handleSave}
        saving={saving}
      >
        {editing && (
          <ColorPaletteForm
            data={editing}
            errors={errors}
            onChange={updates => setEditing(prev => ({ ...prev, ...updates }))}
          />
        )}
      </AdminFormDrawer>

      {deleteTarget && (
        <DeleteConfirmDialog
          itemLabel={`"${deleteTarget.name}" (${deleteTarget.paletteId})`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      <StatusToast toast={toast} onClear={clearToast} />
    </div>
  )
}
