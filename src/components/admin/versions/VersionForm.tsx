import type { AdminVersion, VersionKind } from '../../../types'
import { FieldRow, inputClass, selectClass } from '../shared/FieldRow'

interface Props {
  data: Partial<AdminVersion>
  errors: Record<string, string>
  onChange: (updates: Partial<AdminVersion>) => void
  /** When set, the kind picker is locked to the active tab kind — keeps new rows in the same column. */
  lockedKind?: VersionKind
}

const KIND_LABELS: { value: VersionKind; label: string }[] = [
  { value: 'JAVA', label: 'Java' },
  { value: 'BOOT', label: 'Spring Boot' },
  { value: 'REACT', label: 'React' },
  { value: 'NODE', label: 'Node' },
  { value: 'PACKAGE_MANAGER', label: 'Package Manager' },
]

export function VersionForm({ data, errors, onChange, lockedKind }: Props) {
  const isReact = (data.kind ?? lockedKind) === 'REACT'
  return (
    <>
      <FieldRow label="Kind" required error={errors.kind}>
        <select
          className={selectClass}
          value={data.kind ?? lockedKind ?? ''}
          disabled={!!lockedKind}
          onChange={e => onChange({ kind: e.target.value as VersionKind })}
        >
          {!data.kind && !lockedKind && <option value="">— Select —</option>}
          {KIND_LABELS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Version ID" required error={errors.versionId} hint="ID used by the generator (e.g. 21, 3.2.1, 18, pnpm)">
        <input
          className={inputClass}
          value={data.versionId ?? ''}
          onChange={e => onChange({ versionId: e.target.value })}
          placeholder="21"
        />
      </FieldRow>
      <FieldRow label="Display Name" required error={errors.displayName}>
        <input
          className={inputClass}
          value={data.displayName ?? ''}
          onChange={e => onChange({ displayName: e.target.value })}
          placeholder="React 18"
        />
      </FieldRow>
      <FieldRow label="Sort Order">
        <input
          type="number"
          className={inputClass}
          value={data.sortOrder ?? 0}
          onChange={e => onChange({ sortOrder: parseInt(e.target.value) || 0 })}
        />
      </FieldRow>
      <FieldRow label="Default">
        <label className="inline-flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={!!data.isDefault}
            onChange={e => onChange({ isDefault: e.target.checked })}
          />
          Pre-selected in the wizard
        </label>
      </FieldRow>
      <FieldRow label="Enabled">
        <label className="inline-flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={data.enabled ?? true}
            onChange={e => onChange({ enabled: e.target.checked })}
          />
          Show in the picker
        </label>
      </FieldRow>
      {isReact && (
        <>
          <FieldRow label="npm Semver" error={errors.npmSemver} hint="Pinned by the generated package.json for react / react-dom (e.g. ^18.3.1)">
            <input
              className={inputClass}
              value={data.npmSemver ?? ''}
              onChange={e => onChange({ npmSemver: e.target.value })}
              placeholder="^18.3.1"
            />
          </FieldRow>
          <FieldRow label="@types Semver" error={errors.typesSemver} hint="Pinned for @types/react and @types/react-dom (e.g. ^18.3.3)">
            <input
              className={inputClass}
              value={data.typesSemver ?? ''}
              onChange={e => onChange({ typesSemver: e.target.value })}
              placeholder="^18.3.3"
            />
          </FieldRow>
        </>
      )}
    </>
  )
}
