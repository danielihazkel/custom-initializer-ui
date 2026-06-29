import type { FullstackEntityDef, FullstackFieldDef, FullstackFieldType, FullstackRelationDef } from '../../types'
import type { EntityErrors } from './validation'
import { EnumValuesEditor } from './EnumValuesEditor'
import { RelationsEditor } from './RelationsEditor'

const FIELD_TYPES: FullstackFieldType[] = [
  'STRING', 'TEXT', 'LONG', 'INTEGER', 'BOOLEAN',
  'LOCAL_DATE', 'LOCAL_DATE_TIME', 'BIG_DECIMAL', 'UUID', 'ENUM',
]

interface Props {
  entities: FullstackEntityDef[]
  onChange: (entities: FullstackEntityDef[]) => void
  errors?: Record<number, EntityErrors>
}

function newEntity(): FullstackEntityDef {
  return {
    name: '',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true, generated: true },
      { name: 'name', type: 'STRING', required: true },
    ],
  }
}

function newField(): FullstackFieldDef {
  return { name: '', type: 'STRING' }
}

export function EntitiesEditor({ entities, onChange, errors }: Props) {
  function updateEntity(idx: number, updates: Partial<FullstackEntityDef>) {
    onChange(entities.map((e, i) => i === idx ? { ...e, ...updates } : e))
  }
  function removeEntity(idx: number) {
    onChange(entities.filter((_, i) => i !== idx))
  }
  function addEntity() {
    onChange([...entities, newEntity()])
  }
  function duplicateEntity(idx: number) {
    const src = entities[idx]
    // Deep copy fields so edits to the clone don't mutate the original.
    const copy: FullstackEntityDef = {
      name: `${src.name}Copy`,
      tableName: undefined,
      schema: undefined,
      readOnly: src.readOnly,
      listViews: src.listViews ? [...src.listViews] : undefined,
      listView: src.listView,
      viewQuery: src.viewQuery,
      sourceSql: src.sourceSql,
      fields: src.fields.map(f => ({ ...f, enumValues: f.enumValues ? [...f.enumValues] : undefined })),
      relations: src.relations ? src.relations.map(r => ({ ...r })) : undefined,
    }
    onChange([...entities.slice(0, idx + 1), copy, ...entities.slice(idx + 1)])
  }
  function updateField(eIdx: number, fIdx: number, updates: Partial<FullstackFieldDef>) {
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      return { ...e, fields: e.fields.map((f, j) => j === fIdx ? { ...f, ...updates } : f) }
    }))
  }
  // Changing a field's type clears attributes that no longer apply, so we never send
  // an orphaned length (non-STRING) or enumValues (non-ENUM) — the backend rejects both.
  function changeFieldType(eIdx: number, fIdx: number, type: FullstackFieldType) {
    const updates: Partial<FullstackFieldDef> = { type }
    if (type !== 'STRING') updates.length = undefined
    if (type !== 'ENUM') updates.enumValues = undefined
    // Auto-generated keys are valid on an integral key (IDENTITY) or a UUID (@UuidGenerator) —
    // drop the flag when the type can't carry it.
    if (type !== 'LONG' && type !== 'INTEGER' && type !== 'UUID') updates.generated = undefined
    // Constraints follow the same "clear what no longer applies" rule the backend enforces:
    // numeric bounds only on numeric types, regex/email only on STRING.
    const numeric = type === 'LONG' || type === 'INTEGER' || type === 'BIG_DECIMAL'
    if (!numeric) { updates.min = undefined; updates.max = undefined }
    if (type !== 'STRING') { updates.pattern = undefined; updates.email = undefined }
    updateField(eIdx, fIdx, updates)
  }

  function updateRelations(eIdx: number, relations: FullstackRelationDef[]) {
    updateEntity(eIdx, { relations })
  }
  // All entity names (non-blank) — valid FK targets for the relations editor.
  const entityNames = entities.map(e => e.name.trim()).filter(Boolean)
  function duplicateField(eIdx: number, fIdx: number) {
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      const src = e.fields[fIdx]
      const copy: FullstackFieldDef = {
        ...src,
        name: `${src.name}Copy`,
        enumValues: src.enumValues ? [...src.enumValues] : undefined,
      }
      return { ...e, fields: [...e.fields.slice(0, fIdx + 1), copy, ...e.fields.slice(fIdx + 1)] }
    }))
  }
  function removeField(eIdx: number, fIdx: number) {
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      return { ...e, fields: e.fields.filter((_, j) => j !== fIdx) }
    }))
  }
  function addField(eIdx: number) {
    onChange(entities.map((e, i) => {
      if (i !== eIdx) return e
      return { ...e, fields: [...e.fields, newField()] }
    }))
  }

  return (
    <div className="space-y-6">
      {entities.map((entity, eIdx) => {
        const eErr = errors?.[eIdx]
        // Mirror the backend down-grade rules so the picker only offers a mode the entity supports:
        // kanban groups by an ENUM/BOOLEAN field and writes the value back (needs a writable entity);
        // calendar places records by a LOCAL_DATE/LOCAL_DATE_TIME field.
        const kanbanOk = !entity.readOnly && !entity.viewQuery
          && entity.fields.some(f => f.type === 'ENUM' || f.type === 'BOOLEAN')
        const calendarOk = entity.fields.some(f => f.type === 'LOCAL_DATE' || f.type === 'LOCAL_DATE_TIME')
        // Which list views are enabled (back-compat: fall back to the legacy single listView, else table).
        const views: string[] = entity.listViews ?? (entity.listView ? [entity.listView] : ['table'])
        const VIEW_ORDER = ['table', 'cards', 'kanban', 'calendar']
        const viewOptions = [
          { key: 'table', label: 'Table', applicable: true, hint: '' },
          { key: 'cards', label: 'Cards', applicable: true, hint: '' },
          { key: 'kanban', label: 'Kanban', applicable: kanbanOk, hint: 'Needs an enum/boolean field' },
          { key: 'calendar', label: 'Calendar', applicable: calendarOk, hint: 'Needs a date field' },
        ] as const
        function toggleView(key: string) {
          const has = views.includes(key)
          // Keep at least one view selected; otherwise toggle and re-sort into canonical order so the
          // first (= the generated page's initial mode) is deterministic regardless of click order.
          const next = (has ? views.filter(v => v !== key) : [...views, key])
            .filter((v, i, a) => a.indexOf(v) === i)
          if (next.length === 0) return
          next.sort((a, b) => VIEW_ORDER.indexOf(a) - VIEW_ORDER.indexOf(b))
          updateEntity(eIdx, { listViews: next as FullstackEntityDef['listViews'], listView: undefined })
        }
        return (
        <div key={eIdx} className="border border-outline-variant rounded-xl p-5 bg-surface-container shadow-sm space-y-4">
          {/* Header: identity (row 1) split from secondary attributes (row 2) so the controls
              don't overflow a single row on laptop widths. A tinted panel marks the card title. */}
          <div className="rounded-lg bg-primary/[0.04] border border-outline-variant px-3 py-2.5 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-secondary shrink-0">Entity</span>
                <div className="flex-1 max-w-sm">
                  <input
                    type="text"
                    aria-label="Entity name"
                    aria-invalid={Boolean(eErr?.name)}
                    className={`w-full bg-background border rounded px-3 py-2 text-sm font-mono text-on-surface focus:ring-2 outline-none ${eErr?.name ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                    placeholder="User, Order, Product…"
                    value={entity.name}
                    onChange={e => updateEntity(eIdx, { name: e.target.value })}
                  />
                  {eErr?.name && <p className="mt-1 text-[11px] text-error">{eErr.name}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => duplicateEntity(eIdx)}
                  className="p-1.5 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Duplicate entity"
                  aria-label="Duplicate entity"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>content_copy</span>
                </button>
                <button
                  onClick={() => removeEntity(eIdx)}
                  className="p-1.5 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors"
                  title="Remove entity"
                  aria-label="Remove entity"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <input
                type="text"
                aria-label="Schema (optional)"
                className="w-40 bg-background border border-outline-variant rounded px-3 py-2 text-sm text-secondary placeholder:text-secondary/60 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="schema (optional)"
                value={entity.schema ?? ''}
                onChange={e => updateEntity(eIdx, { schema: e.target.value || undefined })}
              />
              <input
                type="text"
                aria-label="Table name (optional)"
                className="w-56 bg-background border border-outline-variant rounded px-3 py-2 text-sm text-secondary placeholder:text-secondary/60 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:opacity-40"
                placeholder="table_name (optional)"
                value={entity.tableName ?? ''}
                disabled={Boolean(entity.viewQuery)}
                title={entity.viewQuery ? 'A SELECT-backed view maps to its query, not a table' : undefined}
                onChange={e => updateEntity(eIdx, { tableName: e.target.value || undefined })}
              />
              <label
                className="flex items-center gap-1.5 text-xs text-secondary shrink-0 cursor-pointer"
                title={entity.viewQuery ? 'A SELECT-backed view is always read-only' : 'Generate GET-only scaffolding (no create/update/delete)'}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  aria-label="Read-only"
                  checked={Boolean(entity.readOnly) || Boolean(entity.viewQuery)}
                  disabled={Boolean(entity.viewQuery)}
                  onChange={e => updateEntity(eIdx, { readOnly: e.target.checked || undefined })}
                />
                Read-only
              </label>
              <div
                className="flex items-center gap-1.5 text-xs text-secondary shrink-0"
                title="Which list views the generated page includes. A runtime toggle appears when you pick 2+; the first (Table > Cards > Kanban > Calendar) is the initial mode."
              >
                <span>Views</span>
                <div className="inline-flex rounded border border-outline-variant overflow-hidden" role="group" aria-label="List views">
                  {viewOptions.map(opt => {
                    const selected = views.includes(opt.key)
                    // Disabled only blocks *adding* an unsupported view — an already-selected one can
                    // still be removed (so it never gets stuck after its field is deleted).
                    const interactive = opt.applicable || selected
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        aria-pressed={selected}
                        disabled={!interactive}
                        title={opt.applicable ? undefined : opt.hint}
                        onClick={() => toggleView(opt.key)}
                        className={`px-2 py-1 transition-colors ${selected ? 'bg-primary text-on-primary' : 'bg-background text-secondary hover:text-on-surface'} ${interactive ? '' : 'opacity-40 cursor-not-allowed'}`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {eErr?.pk && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 border border-error/30 text-[11px] text-error">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
              {eErr.pk}
            </div>
          )}

          {eErr?.view && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 border border-error/30 text-[11px] text-error">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
              {eErr.view}
            </div>
          )}

          {entity.viewQuery && (
            <details className="rounded-lg border border-outline-variant bg-background/50">
              <summary className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-secondary cursor-pointer select-none">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>table_view</span>
                Read-only view — mapped to this SELECT via <code className="font-mono">@Subselect</code>.
                Field <code className="font-mono">@Column</code> names must match the projected aliases.
              </summary>
              <textarea
                aria-label="View SELECT query"
                className="w-full font-mono text-[11px] bg-background border-t border-outline-variant rounded-b p-3 min-h-[100px] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                value={entity.viewQuery}
                spellCheck={false}
                onChange={e => updateEntity(eIdx, { viewQuery: e.target.value || undefined })}
              />
            </details>
          )}

          {entity.sourceSql && !entity.viewQuery && (
            <details className="rounded-lg border border-outline-variant bg-background/50">
              <summary className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-secondary cursor-pointer select-none">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>code</span>
                Imported from this <code className="font-mono">CREATE TABLE</code> (read-only — for reference).
              </summary>
              <textarea
                aria-label="Source CREATE TABLE"
                className="w-full font-mono text-[11px] bg-background border-t border-outline-variant rounded-b p-3 min-h-[100px] text-secondary outline-none resize-y"
                value={entity.sourceSql}
                readOnly
                spellCheck={false}
              />
            </details>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                  <th className="text-left py-1.5 px-2">Name</th>
                  <th className="text-left py-1.5 px-2">Type</th>
                  <th className="text-center py-1.5 px-2 w-12">PK</th>
                  <th className="text-center py-1.5 px-2 w-12">Gen</th>
                  <th className="text-center py-1.5 px-2 w-12">Req</th>
                  <th className="text-center py-1.5 px-2 w-12">Uniq</th>
                  <th className="text-left py-1.5 px-2 w-20">Length</th>
                  <th className="text-left py-1.5 px-2 w-20">Min</th>
                  <th className="text-left py-1.5 px-2 w-20">Max</th>
                  <th className="text-left py-1.5 px-2 w-28">Pattern</th>
                  <th className="text-center py-1.5 px-2 w-12">Email</th>
                  <th className="text-left py-1.5 px-2">Enum values</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {entity.fields.map((field, fIdx) => {
                  const fErr = eErr?.fields?.[fIdx]
                  const pkCount = entity.fields.filter(f => f.primaryKey).length
                  // A generated key requires a single PK (JPA IDENTITY can't target one column of a composite key).
                  const canGenerate = !!field.primaryKey && pkCount === 1 && (field.type === 'LONG' || field.type === 'INTEGER' || field.type === 'UUID')
                  const isNumeric = field.type === 'LONG' || field.type === 'INTEGER' || field.type === 'BIG_DECIMAL'
                  const isString = field.type === 'STRING'
                  return (
                  <tr key={fIdx} className="border-t border-outline-variant">
                    <td className="py-1.5 px-2 align-top">
                      <input
                        type="text"
                        aria-label="Field name"
                        aria-invalid={Boolean(fErr?.name)}
                        className={`w-full bg-background border rounded px-2 py-1 text-xs font-mono focus:ring-1 outline-none ${fErr?.name ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                        value={field.name}
                        onChange={e => updateField(eIdx, fIdx, { name: e.target.value })}
                        placeholder="fieldName"
                      />
                      {fErr?.name && <p className="mt-0.5 text-[11px] text-error">{fErr.name}</p>}
                    </td>
                    <td className="py-1.5 px-2 align-top">
                      <select
                        aria-label="Field type"
                        className="w-full bg-background border border-outline-variant rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary/20 focus:border-primary outline-none"
                        value={field.type}
                        onChange={e => changeFieldType(eIdx, fIdx, e.target.value as FullstackFieldType)}
                      >
                        {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Primary key" checked={!!field.primaryKey}
                        onChange={e => updateField(eIdx, fIdx, e.target.checked ? { primaryKey: true } : { primaryKey: false, generated: undefined })} />
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      <input type="checkbox" aria-label="Auto-generated value" checked={!!field.generated}
                        disabled={!canGenerate}
                        title={canGenerate ? undefined : (pkCount > 1 ? 'A generated key requires a single primary key' : 'Auto-generated applies to a LONG/INTEGER/UUID primary key only')}
                        className="h-4 w-4 accent-primary disabled:opacity-40 disabled:cursor-not-allowed"
                        onChange={e => updateField(eIdx, fIdx, { generated: e.target.checked })} />
                      {fErr?.generated && <p className="mt-0.5 text-[11px] text-error">{fErr.generated}</p>}
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Required (not null)" checked={!!field.required}
                        onChange={e => updateField(eIdx, fIdx, { required: e.target.checked })} />
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      <input type="checkbox" className="h-4 w-4 accent-primary" aria-label="Unique" checked={!!field.unique}
                        onChange={e => updateField(eIdx, fIdx, { unique: e.target.checked })} />
                    </td>
                    <td className="py-1.5 px-2 align-top">
                      <input
                        type="number"
                        min={1}
                        aria-label="Max length"
                        aria-invalid={Boolean(fErr?.length)}
                        title={field.type !== 'STRING' ? 'Length applies to STRING fields only' : undefined}
                        className={`w-full bg-background border rounded px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed focus:ring-1 outline-none ${fErr?.length ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                        value={field.length ?? ''}
                        disabled={field.type !== 'STRING'}
                        onChange={e => updateField(eIdx, fIdx, { length: e.target.value === '' ? undefined : Number(e.target.value) })}
                      />
                      {fErr?.length && <p className="mt-0.5 text-[11px] text-error">{fErr.length}</p>}
                    </td>
                    <td className="py-1.5 px-2 align-top">
                      <input
                        type="number"
                        aria-label="Minimum value"
                        aria-invalid={Boolean(fErr?.min)}
                        title={isNumeric ? undefined : 'Min applies to numeric fields only'}
                        className={`w-full bg-background border rounded px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed focus:ring-1 outline-none ${fErr?.min ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                        value={field.min ?? ''}
                        disabled={!isNumeric}
                        onChange={e => updateField(eIdx, fIdx, { min: e.target.value === '' ? undefined : Number(e.target.value) })}
                      />
                      {fErr?.min && <p className="mt-0.5 text-[11px] text-error">{fErr.min}</p>}
                    </td>
                    <td className="py-1.5 px-2 align-top">
                      <input
                        type="number"
                        aria-label="Maximum value"
                        aria-invalid={Boolean(fErr?.max)}
                        title={isNumeric ? undefined : 'Max applies to numeric fields only'}
                        className={`w-full bg-background border rounded px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed focus:ring-1 outline-none ${fErr?.max ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                        value={field.max ?? ''}
                        disabled={!isNumeric}
                        onChange={e => updateField(eIdx, fIdx, { max: e.target.value === '' ? undefined : Number(e.target.value) })}
                      />
                      {fErr?.max && <p className="mt-0.5 text-[11px] text-error">{fErr.max}</p>}
                    </td>
                    <td className="py-1.5 px-2 align-top">
                      <input
                        type="text"
                        aria-label="Regex pattern"
                        aria-invalid={Boolean(fErr?.pattern)}
                        title={isString ? undefined : 'Pattern applies to STRING fields only'}
                        className={`w-full bg-background border rounded px-2 py-1 text-xs font-mono disabled:opacity-40 disabled:cursor-not-allowed focus:ring-1 outline-none ${fErr?.pattern ? 'border-error focus:ring-error/20 focus:border-error' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
                        value={field.pattern ?? ''}
                        disabled={!isString}
                        placeholder="[A-Z]{3}"
                        onChange={e => updateField(eIdx, fIdx, { pattern: e.target.value === '' ? undefined : e.target.value })}
                      />
                      {fErr?.pattern && <p className="mt-0.5 text-[11px] text-error">{fErr.pattern}</p>}
                    </td>
                    <td className="py-1.5 px-2 text-center align-top">
                      <input type="checkbox" aria-label="Email format" checked={!!field.email}
                        disabled={!isString}
                        title={isString ? undefined : 'Email applies to STRING fields only'}
                        className="h-4 w-4 accent-primary disabled:opacity-40 disabled:cursor-not-allowed"
                        onChange={e => updateField(eIdx, fIdx, { email: e.target.checked })} />
                      {fErr?.email && <p className="mt-0.5 text-[11px] text-error">{fErr.email}</p>}
                    </td>
                    <td className="py-1.5 px-2 align-top">
                      {field.type === 'ENUM' ? (
                        <EnumValuesEditor
                          values={field.enumValues ?? []}
                          onChange={vals => updateField(eIdx, fIdx, { enumValues: vals })}
                          invalid={Boolean(fErr?.enumValues)}
                        />
                      ) : (
                        <input
                          type="text"
                          aria-label="Enum values (ENUM fields only)"
                          title="Enum values apply to ENUM fields only"
                          className="w-full bg-background border border-outline-variant rounded px-2 py-1 text-xs opacity-40 cursor-not-allowed outline-none"
                          placeholder="ACTIVE,DISABLED"
                          value=""
                          disabled
                          readOnly
                        />
                      )}
                      {fErr?.enumValues && <p className="mt-0.5 text-[11px] text-error">{fErr.enumValues}</p>}
                    </td>
                    <td className="py-1.5 px-2 text-right align-top">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => duplicateField(eIdx, fIdx)}
                          className="p-1 rounded text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Duplicate field"
                          aria-label="Duplicate field"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                        </button>
                        <button
                          onClick={() => removeField(eIdx, fIdx)}
                          className="p-1 rounded text-secondary hover:text-error hover:bg-error/10 transition-colors"
                          title="Remove field"
                          aria-label="Remove field"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
            <button
              onClick={() => addField(eIdx)}
              className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded text-xs text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
              Add field
            </button>
          </div>

          <RelationsEditor
            relations={entity.relations ?? []}
            entityNames={entityNames}
            onChange={rels => updateRelations(eIdx, rels)}
            errors={eErr?.relations}
          />
        </div>
        )
      })}

      {entities.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 px-6 py-12 rounded-xl border-2 border-dashed border-outline-variant">
          <span className="material-symbols-outlined text-secondary/60" style={{ fontSize: '40px' }}>table_chart</span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-on-surface">No entities yet</p>
            <p className="text-xs text-secondary max-w-xs">
              Add an entity to define its fields and relations — or import one from DDL/SELECT above.
            </p>
          </div>
          <button
            onClick={addEntity}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:opacity-90 transition-opacity active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Add entity
          </button>
        </div>
      ) : (
        <button
          onClick={addEntity}
          className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-outline-variant hover:border-primary text-secondary hover:text-primary text-sm font-medium transition-colors"
        >
          + Add entity
        </button>
      )}
    </div>
  )
}
