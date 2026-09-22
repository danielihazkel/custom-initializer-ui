import { useState, useCallback } from 'react'
import type { AdminFullstackExample, FullstackEntityDef, Toast } from '../../../types'
import { AdminApiError, useAdminResource } from '../../../hooks/useAdminResource'
import { invalidateFullstackExamples } from '../../../hooks/useFullstackExamples'
import { useTeamModels } from '../../../hooks/useTeamModels'
import { validateEntities } from '../../fullstack/validation'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { FullstackExampleForm } from './FullstackExampleForm'

/** The drawer's working copy: the entities are edited as JSON text and parsed on save. */
export type ExampleDraft = Partial<Omit<AdminFullstackExample, 'entities'>> & { entitiesText: string }

/** Mirrors FullstackExampleAdminController's slug rule. */
const EXAMPLE_ID = /^[a-z][a-z0-9-]*$/
const ICON = /^[a-z0-9_]+$/

const EMPTY: ExampleDraft = {
  exampleId: '',
  name: '',
  description: '',
  icon: '',
  sortOrder: 0,
  enabled: true,
  entitiesText: '[]',
}

function toText(entities: unknown): string {
  return JSON.stringify(entities, null, 2)
}

/**
 * Client-side checks before the round-trip: the slug/name rules, that the JSON parses to a
 * non-empty array, and the Fullstack editor's own validation (the server re-checks with the
 * generator's validator). Returns the errors and, when the JSON parsed, the entities.
 */
export function validateFullstackExample(data: ExampleDraft): { errors: Record<string, string>; entities?: FullstackEntityDef[] } {
  const errors: Record<string, string> = {}
  if (!data.exampleId?.trim()) errors.exampleId = 'Required'
  else if (!EXAMPLE_ID.test(data.exampleId.trim())) errors.exampleId = "Lower-case letters, digits and '-', starting with a letter"
  if (!data.name?.trim()) errors.name = 'Required'
  if (data.icon?.trim() && !ICON.test(data.icon.trim())) errors.icon = "Lower-case letters, digits and '_'"

  let entities: FullstackEntityDef[] | undefined
  try {
    const parsed: unknown = JSON.parse(data.entitiesText)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      errors.entitiesText = 'Must be a non-empty JSON array of entities'
    } else {
      entities = parsed as FullstackEntityDef[]
      const issues = validateEntities(entities)
      if (issues.count > 0) {
        errors.entitiesText = `The editor finds ${issues.count} problem${issues.count === 1 ? '' : 's'} in this model — load it in the Fullstack tab to see them`
      }
    }
  } catch (err) {
    errors.entitiesText = `Not valid JSON: ${err instanceof Error ? err.message : String(err)}`
  }
  return { errors, entities }
}

/** The server's `{error, detail}` message when there is one, else the HTTP status. */
function errorMessage(err: unknown): string {
  if (err instanceof AdminApiError) {
    const body = err.body as { error?: string; detail?: string } | null
    if (body?.detail) return body.detail
    if (body?.error) return body.error
  }
  return String(err)
}

export function FullstackExamplesTab() {
  const { items, loading, create, update, remove } =
    useAdminResource<AdminFullstackExample>('/admin/fullstack-examples')
  const team = useTeamModels()
  const [editing, setEditing] = useState<ExampleDraft | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminFullstackExample | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); setErrors({}); setDrawerOpen(true) }
  function openEdit(row: AdminFullstackExample) {
    const { entities, ...rest } = row
    setEditing({ ...rest, entitiesText: toText(entities) })
    setIsNew(false)
    setErrors({})
    setDrawerOpen(true)
  }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }

  async function importTeamModel(id: number) {
    const snapshot = await team.load(id)
    const model = team.models.find(m => m.id === id)
    setEditing(prev => prev && ({
      ...prev,
      entitiesText: toText(snapshot.entities),
      // Fill the blanks from the team model, never overwrite what the admin typed.
      name: prev.name?.trim() ? prev.name : model?.name ?? prev.name,
      description: prev.description?.trim() ? prev.description : model?.description ?? prev.description,
    }))
  }

  async function handleSave() {
    if (!editing) return
    const { errors: e, entities } = validateFullstackExample(editing)
    if (Object.keys(e).length > 0 || !entities) { setErrors(e); return }
    const { entitiesText: _text, ...rest } = editing
    void _text
    const body = {
      ...rest,
      exampleId: rest.exampleId?.trim(),
      name: rest.name?.trim(),
      icon: rest.icon?.trim() || null,
      description: rest.description?.trim() || null,
      entities,
    }
    setSaving(true)
    try {
      if (isNew) await create(body as Omit<AdminFullstackExample, 'id'>)
      else await update(editing.id!, body)
      // The Fullstack tab refetches the list on its next mount.
      invalidateFullstackExamples()
      setToast({ message: 'Saved successfully', type: 'success' })
      closeDrawer()
    } catch (err) {
      setToast({ message: errorMessage(err), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await remove(deleteTarget.id)
      invalidateFullstackExamples()
      setToast({ message: 'Deleted successfully', type: 'success' })
      setDeleteTarget(null)
    } catch (err) {
      setToast({ message: errorMessage(err), type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const clearToast = useCallback(() => setToast(null), [])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Fullstack Examples</h2>
        <p className="text-[11px] text-on-surface-variant mt-0.5">
          The ready-made models under Fullstack → Start from → Examples. Loading one replaces the user's entities;
          the dependencies and options stay as they are.
        </p>
      </div>

      <AdminTable
        columns={[
          { label: 'ID', render: r => <span className="text-secondary text-xs">{r.id}</span>, width: '60px' },
          {
            label: 'Example',
            render: r => (
              <span className="inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }} aria-hidden="true">{r.icon || 'category'}</span>
                <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{r.exampleId}</code>
              </span>
            ),
          },
          { label: 'Name', render: r => <span className="font-medium">{r.name}</span> },
          {
            label: 'Entities',
            render: r => <span className="text-xs text-secondary" title={r.entities.map(e => e.name).join(', ')}>{r.entities.length}</span>,
            width: '80px',
          },
          {
            label: 'Enabled',
            render: r => r.enabled
              ? <span className="text-xs font-semibold text-tertiary">Yes</span>
              : <span className="text-xs text-on-surface-variant">Hidden</span>,
            width: '80px',
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
            New Example
          </button>
        }
      />

      <AdminFormDrawer
        title={isNew ? 'New Example' : 'Edit Example'}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        onSave={handleSave}
        saving={saving}
      >
        {editing && (
          <FullstackExampleForm
            data={editing}
            errors={errors}
            onChange={updates => setEditing(prev => prev && ({ ...prev, ...updates }))}
            teamModels={team.models}
            onImportTeamModel={importTeamModel}
          />
        )}
      </AdminFormDrawer>

      {deleteTarget && (
        <DeleteConfirmDialog
          itemLabel={`"${deleteTarget.name}" (${deleteTarget.exampleId})`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      <StatusToast toast={toast} onClear={clearToast} />
    </div>
  )
}
