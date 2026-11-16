import { useCallback, useState } from 'react'
import type { AdminSchemaSource, Toast } from '../../../types'
import { AdminApiError, adminFetch, useAdminResource } from '../../../hooks/useAdminResource'
import { AdminTable } from '../shared/AdminTable'
import { AdminFormDrawer } from '../shared/AdminFormDrawer'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { StatusToast } from '../shared/StatusToast'
import { FieldRow, inputClass } from '../shared/FieldRow'

const DIALECTS: { id: AdminSchemaSource['dialect']; label: string; port?: number }[] = [
  { id: 'POSTGRESQL', label: 'PostgreSQL', port: 5432 },
  { id: 'MSSQL', label: 'SQL Server', port: 1433 },
  { id: 'ORACLE', label: 'Oracle', port: 1521 },
  { id: 'DB2', label: 'DB2 for IBM i' },
]

/** Mirrors LiveSchemaService.PASSWORD_REF: the server reads nothing else. */
export const PASSWORD_REF = /^(SCHEMA_SOURCE_[A-Z0-9_]{1,200}|menora\.live-schema\.secrets\.[a-z0-9][a-z0-9.-]{0,180})$/

const EMPTY: Partial<AdminSchemaSource> = {
  name: '', dialect: 'POSTGRESQL', host: '', username: '', passwordRef: '', trustServerCertificate: false,
  enabled: true, sortOrder: 0,
}

export function validateSchemaSource(d: Partial<AdminSchemaSource>): Record<string, string> {
  const e: Record<string, string> = {}
  if (!d.name?.trim()) e.name = 'Required'
  if (!d.host?.trim()) e.host = 'Required'
  if (!d.username?.trim()) e.username = 'Required'
  if (d.dialect !== 'DB2' && !d.databaseName?.trim()) e.databaseName = 'Required'
  if (d.passwordRef?.trim() && !PASSWORD_REF.test(d.passwordRef.trim())) {
    e.passwordRef = 'An environment variable SCHEMA_SOURCE_… or a property menora.live-schema.secrets.…'
  }
  return e
}

function errorText(err: unknown): string {
  if (err instanceof AdminApiError) {
    const b = err.body as { detail?: string; error?: string } | null
    return b?.detail ?? b?.error ?? err.message
  }
  return String(err)
}

/**
 * The databases everyone may read tables from in the SQL wizard and the fullstack import. A
 * source keeps no password: it names the environment variable or property that holds it.
 */
export function SchemaSourcesTab() {
  const { items, loading, create, update, remove } = useAdminResource<AdminSchemaSource>('/admin/schema-sources')
  const [editing, setEditing] = useState<Partial<AdminSchemaSource> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminSchemaSource | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  function open(row: Partial<AdminSchemaSource>, fresh: boolean) {
    setEditing({ ...row }); setIsNew(fresh); setErrors({}); setTestResult(null); setDrawerOpen(true)
  }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }
  const change = (u: Partial<AdminSchemaSource>) => { setEditing(prev => ({ ...prev, ...u })); setTestResult(null) }

  async function handleSave() {
    if (!editing) return
    const e = validateSchemaSource(editing)
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSaving(true)
    try {
      const { passwordAvailable: _ignored, ...body } = editing
      void _ignored
      if (isNew) await create(body as Omit<AdminSchemaSource, 'id'>)
      else await update(editing.id!, body)
      setToast({ message: 'Saved successfully', type: 'success' })
      closeDrawer()
    } catch (err) {
      setToast({ message: errorText(err), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!editing) return
    setTesting(true)
    setTestResult(null)
    try {
      const r = await adminFetch('POST', '/admin/schema-sources/test', editing) as { ok: boolean; message: string }
      setTestResult(r)
    } catch (err) {
      setTestResult({ ok: false, message: errorText(err) })
    } finally {
      setTesting(false)
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
      setToast({ message: errorText(err), type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const clearToast = useCallback(() => setToast(null), [])
  const dialect = DIALECTS.find(d => d.id === editing?.dialect) ?? DIALECTS[0]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">Schema sources</h2>
        <p className="text-[11px] text-on-surface-variant mt-0.5">
          Databases anyone may read tables and views from — the SQL wizard's <em>Read from a database</em> and the
          fullstack import. Users see a source's name only. Connect with a user that may only read; the password stays in
          the server's environment.
        </p>
      </div>

      <AdminTable
        columns={[
          { label: 'Name', render: r => <span className="font-semibold">{r.name}</span> },
          { label: 'Type', render: r => DIALECTS.find(d => d.id === r.dialect)?.label ?? r.dialect, width: '120px' },
          { label: 'Where', render: r => <code className="text-xs">{r.host}{r.port ? `:${r.port}` : ''}{r.databaseName ? `/${r.databaseName}` : ''}{r.library ? ` (${r.library})` : ''}</code> },
          { label: 'User', render: r => <code className="text-xs">{r.username}</code>, width: '120px' },
          {
            label: 'Password',
            render: r => !r.passwordRef
              ? <span className="text-xs text-on-surface-variant">none</span>
              : r.passwordAvailable
                ? <span className="text-xs text-primary">set</span>
                : <span className="text-xs text-error" title={`${r.passwordRef} is not set on the server`}>not set</span>,
            width: '90px',
          },
          { label: 'On', render: r => r.enabled ? '✓' : '—', width: '50px' },
        ]}
        rows={items}
        loading={loading}
        onEdit={row => open(row, false)}
        onDelete={setDeleteTarget}
        addButton={
          <button onClick={() => open(EMPTY, true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-bold bg-primary text-on-primary hover:brightness-110 transition-all active:scale-95">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
            New Source
          </button>
        }
      />

      <AdminFormDrawer title={isNew ? 'New Schema Source' : 'Edit Schema Source'} isOpen={drawerOpen}
                       onClose={closeDrawer} onSave={handleSave} saving={saving}>
        {editing && (
          <>
            <FieldRow label="Name" required error={errors.name} hint="What users pick from, e.g. HR reporting">
              <input className={inputClass} value={editing.name ?? ''} onChange={e => change({ name: e.target.value })} />
            </FieldRow>
            <FieldRow label="Description" hint="Shown under the name">
              <input className={inputClass} value={editing.description ?? ''} onChange={e => change({ description: e.target.value })} />
            </FieldRow>
            <FieldRow label="Database type" required>
              <select className={inputClass} value={editing.dialect}
                      onChange={e => change({ dialect: e.target.value as AdminSchemaSource['dialect'] })}>
                {DIALECTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Host" required error={errors.host}>
              <input className={inputClass} value={editing.host ?? ''} onChange={e => change({ host: e.target.value })} placeholder="db01.menora.co.il" />
            </FieldRow>
            {dialect.port && (
              <FieldRow label="Port" hint={`Blank: ${dialect.port}`}>
                <input className={inputClass} inputMode="numeric" value={editing.port ?? ''}
                       onChange={e => change({ port: e.target.value.replace(/\D/g, '') ? Number(e.target.value.replace(/\D/g, '')) : null })} />
              </FieldRow>
            )}
            {editing.dialect === 'DB2' ? (
              <FieldRow label="Library" hint="The library the connection starts in (optional)">
                <input className={inputClass} value={editing.library ?? ''} onChange={e => change({ library: e.target.value })} />
              </FieldRow>
            ) : (
              <FieldRow label={editing.dialect === 'ORACLE' ? 'Service name' : 'Database'} required error={errors.databaseName}>
                <input className={inputClass} value={editing.databaseName ?? ''} onChange={e => change({ databaseName: e.target.value })} />
              </FieldRow>
            )}
            <FieldRow label="User" required error={errors.username}>
              <input className={inputClass} value={editing.username ?? ''} onChange={e => change({ username: e.target.value })} autoComplete="off" />
            </FieldRow>
            <FieldRow label="Password from" error={errors.passwordRef}
                      hint="The environment variable SCHEMA_SOURCE_… or property menora.live-schema.secrets.… that holds the password — never the password itself">
              <input className={inputClass} value={editing.passwordRef ?? ''} onChange={e => change({ passwordRef: e.target.value })}
                     placeholder="SCHEMA_SOURCE_HR" />
            </FieldRow>
            {editing.dialect === 'MSSQL' && (
              <FieldRow label="Certificate">
                <label className="inline-flex items-center gap-2 text-sm text-on-surface">
                  <input type="checkbox" checked={editing.trustServerCertificate ?? false}
                         onChange={e => change({ trustServerCertificate: e.target.checked })} />
                  <span>Trust the server's certificate (a self-signed one)</span>
                </label>
              </FieldRow>
            )}
            <FieldRow label="Default schema" hint="The schema the picker opens on; blank: the user's own">
              <input className={inputClass} value={editing.defaultSchema ?? ''} onChange={e => change({ defaultSchema: e.target.value })} />
            </FieldRow>
            <FieldRow label="Enabled">
              <label className="inline-flex items-center gap-2 text-sm text-on-surface">
                <input type="checkbox" checked={editing.enabled ?? true} onChange={e => change({ enabled: e.target.checked })} />
                <span>Offer it to users</span>
              </label>
            </FieldRow>
            <FieldRow label="Sort Order">
              <input type="number" className={inputClass} value={editing.sortOrder ?? 0}
                     onChange={e => change({ sortOrder: parseInt(e.target.value) || 0 })} />
            </FieldRow>
            <div className="pt-2">
              <button type="button" onClick={handleTest} disabled={testing} data-test-connection
                      className="px-4 py-2 rounded text-sm font-medium border border-outline-variant text-on-surface hover:border-primary/60 disabled:opacity-50">
                {testing ? 'Connecting…' : 'Test connection'}
              </button>
              {testResult && (
                <p role="status" className={`mt-2 text-xs ${testResult.ok ? 'text-primary' : 'text-error'}`}>{testResult.message}</p>
              )}
            </div>
          </>
        )}
      </AdminFormDrawer>

      {deleteTarget && (
        <DeleteConfirmDialog itemLabel={`"${deleteTarget.name}"`} onConfirm={handleDelete}
                             onCancel={() => setDeleteTarget(null)} deleting={deleting} />
      )}

      <StatusToast toast={toast} onClear={clearToast} />
    </div>
  )
}
