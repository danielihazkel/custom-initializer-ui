import { useMemo, useState } from 'react'
import type {
  AdminColorPalette, AdminDependencyEntry, AdminEntityTemplateSet, DesignSystem, EntityTemplateSetKind,
} from '../../../types'
import { useAdminMetadata } from '../../../hooks/useAdminMetadata'
import { FieldRow, inputClass, selectClass } from '../shared/FieldRow'

interface Props {
  data: Partial<AdminEntityTemplateSet>
  errors: Record<string, string>
  onChange: (updates: Partial<AdminEntityTemplateSet>) => void
  defaultDeps: string[]
  onDefaultDepsChange: (next: string[]) => void
  catalogDeps: AdminDependencyEntry[]
  palettes: AdminColorPalette[]
}

const KINDS: { value: EntityTemplateSetKind; label: string }[] = [
  { value: 'BACKEND_JAVA', label: 'Backend (Java)' },
  { value: 'FRONTEND_REACT', label: 'Frontend (React)' },
]

const DESIGN_SYSTEMS: { value: DesignSystem; label: string }[] = [
  { value: 'TAILWIND', label: 'Tailwind CSS' },
  { value: 'MUI', label: 'Material UI' },
  { value: 'CHAKRA', label: 'Chakra UI' },
  { value: 'MANTINE', label: 'Mantine' },
  { value: 'SHADCN', label: 'shadcn/ui' },
  { value: 'NONE', label: 'None / Plain CSS' },
]

// Design systems for which a color palette is meaningfully applied at generation
// time. Tailwind / shadcn / none don't consume palette tokens — the field stays
// editable but the form hints that it'll be ignored.
const PALETTE_AWARE: ReadonlySet<DesignSystem> = new Set(['MUI', 'CHAKRA', 'MANTINE'])

export function EntityTemplateSetForm({
  data, errors, onChange, defaultDeps, onDefaultDepsChange, catalogDeps, palettes,
}: Props) {
  const { bootVersions, javaVersions } = useAdminMetadata()
  const [depQuery, setDepQuery] = useState('')
  const selectedSet = useMemo(() => new Set(defaultDeps), [defaultDeps])

  const sortedCatalog = useMemo(() =>
    [...catalogDeps].sort((a, b) => a.depId.localeCompare(b.depId)),
    [catalogDeps])

  const filtered = useMemo(() => {
    const q = depQuery.trim().toLowerCase()
    if (!q) return sortedCatalog
    return sortedCatalog.filter(d =>
      d.depId.toLowerCase().includes(q) ||
      (d.name ?? '').toLowerCase().includes(q))
  }, [sortedCatalog, depQuery])

  function toggle(depId: string, checked: boolean) {
    if (checked) {
      if (selectedSet.has(depId)) return
      onDefaultDepsChange([...defaultDeps, depId])
    } else {
      onDefaultDepsChange(defaultDeps.filter(d => d !== depId))
    }
  }

  const isBackend = data.kind === 'BACKEND_JAVA'
  const isFrontend = data.kind === 'FRONTEND_REACT'

  return (
    <>
      <FieldRow label="Set Key" required error={errors.setKey} hint="Unique identifier, e.g. 'spring-jpa-crud'">
        <input
          type="text"
          className={inputClass}
          value={data.setKey ?? ''}
          onChange={e => onChange({ setKey: e.target.value })}
          placeholder="spring-jpa-crud"
        />
      </FieldRow>
      <FieldRow label="Name" required error={errors.name}>
        <input
          type="text"
          className={inputClass}
          value={data.name ?? ''}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Spring Boot + JPA CRUD"
        />
      </FieldRow>
      <FieldRow label="Description">
        <textarea
          className={inputClass}
          rows={2}
          value={data.description ?? ''}
          onChange={e => onChange({ description: e.target.value })}
        />
      </FieldRow>
      <FieldRow label="Kind" required error={errors.kind}>
        <select
          className={selectClass}
          value={data.kind ?? ''}
          onChange={e => onChange({ kind: e.target.value as EntityTemplateSetKind })}
        >
          <option value="">— Select kind —</option>
          {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Enabled">
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={data.enabled ?? true}
            onChange={e => onChange({ enabled: e.target.checked })}
          />
          Surface this set in the wizard
        </label>
      </FieldRow>
      <FieldRow label="Sort Order">
        <input
          type="number"
          className={inputClass}
          value={data.sortOrder ?? 0}
          onChange={e => onChange({ sortOrder: Number(e.target.value) })}
        />
      </FieldRow>

      {isFrontend && (
        <FieldRow
          label="Design System"
          hint="Descriptive tag for the wizard. Choosing MUI here doesn't auto-rewrite Tailwind templates — that's a separate set."
        >
          <select
            className={selectClass}
            value={data.designSystem ?? ''}
            onChange={e => onChange({ designSystem: (e.target.value || null) as DesignSystem | null })}
          >
            <option value="">— Unspecified —</option>
            {DESIGN_SYSTEMS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </FieldRow>
      )}

      {isFrontend && (
        <FieldRow
          label="Default Color Palette"
          hint={
            data.designSystem && !PALETTE_AWARE.has(data.designSystem)
              ? `Palettes are ignored by ${data.designSystem} — set is purely informational.`
              : 'Pre-selected in the wizard. Applied by palette-aware design systems (MUI / Chakra / Mantine).'
          }
        >
          <select
            className={selectClass}
            value={data.defaultPaletteId ?? ''}
            onChange={e => onChange({ defaultPaletteId: e.target.value || null })}
          >
            <option value="">— Use whichever palette is marked default —</option>
            {palettes.map(p => (
              <option key={p.paletteId} value={p.paletteId}>
                {p.name} ({p.paletteId}){p.isDefault ? ' ★' : ''}
              </option>
            ))}
          </select>
        </FieldRow>
      )}

      {isBackend && (
        <>
          <FieldRow
            label="Boot Version"
            hint="Optional. When set, the wizard pre-fills its Boot Version dropdown when this set is chosen. Users can still override."
          >
            <select
              className={selectClass}
              value={data.bootVersion ?? ''}
              onChange={e => onChange({ bootVersion: e.target.value || null })}
            >
              <option value="">— Use wizard default —</option>
              {bootVersions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </FieldRow>
          <FieldRow
            label="Java Version"
            hint="Optional. When set, the wizard pre-fills its Java Version dropdown when this set is chosen. Users can still override."
          >
            <select
              className={selectClass}
              value={data.javaVersion ?? ''}
              onChange={e => onChange({ javaVersion: e.target.value || null })}
            >
              <option value="">— Use wizard default —</option>
              {javaVersions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </FieldRow>
        </>
      )}

      {isBackend && (
        <FieldRow
          label="Default Dependencies"
          hint="Pre-checked in the wizard when this set is selected. Users can uncheck anything before generating — for the standard JPA + REST templates to compile you'll want data-jpa and web here, plus an embedded DB driver like h2 unless you expect users to bring their own."
        >
          <div className="space-y-2">
            <input
              type="text"
              className={inputClass}
              placeholder="Filter dependencies…"
              value={depQuery}
              onChange={e => setDepQuery(e.target.value)}
            />
            <div className="border border-outline-variant rounded-lg bg-background max-h-64 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="text-xs text-secondary text-center py-4">No matches</div>
              )}
              {filtered.map(d => (
                <label
                  key={d.depId}
                  className="flex items-start gap-2 px-3 py-1.5 border-b border-outline-variant/50 last:border-b-0 hover:bg-surface-container-low cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedSet.has(d.depId)}
                    onChange={e => toggle(d.depId, e.target.checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <code className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">{d.depId}</code>
                      <span className="ml-2 text-on-surface">{d.name}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="text-[11px] text-on-surface-variant">
              {defaultDeps.length} selected
            </div>
          </div>
        </FieldRow>
      )}
    </>
  )
}
