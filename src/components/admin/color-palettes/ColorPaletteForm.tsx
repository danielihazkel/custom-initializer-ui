import type { AdminColorPalette } from '../../../types'
import { FieldRow, inputClass } from '../shared/FieldRow'

interface Props {
  data: Partial<AdminColorPalette>
  errors: Record<string, string>
  onChange: (updates: Partial<AdminColorPalette>) => void
}

function ColorField({
  label,
  required,
  error,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  // Native color picker requires a real 6-digit hex; fall back to white when the
  // text field is mid-typing or empty so the picker doesn't blow up on '#'.
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff'
  return (
    <FieldRow label={label} required={required} error={error} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safe}
          onChange={e => onChange(e.target.value)}
          className="w-10 h-10 rounded border border-outline-variant cursor-pointer bg-transparent"
        />
        <input
          type="text"
          className={inputClass}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '#1976d2'}
        />
      </div>
    </FieldRow>
  )
}

export function ColorPaletteForm({ data, errors, onChange }: Props) {
  return (
    <>
      <FieldRow label="Palette ID" required error={errors.paletteId} hint="Stable kebab-case slug — used in the URL (e.g. menora-default)">
        <input
          className={inputClass}
          value={data.paletteId ?? ''}
          onChange={e => onChange({ paletteId: e.target.value })}
          placeholder="menora-default"
        />
      </FieldRow>
      <FieldRow label="Name" required error={errors.name}>
        <input
          className={inputClass}
          value={data.name ?? ''}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Menora Default"
        />
      </FieldRow>
      <FieldRow label="Description" error={errors.description}>
        <input
          className={inputClass}
          value={data.description ?? ''}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Default Menora blue/violet palette"
        />
      </FieldRow>
      <ColorField
        label="Primary"
        required
        error={errors.primary}
        value={data.primary ?? ''}
        onChange={v => onChange({ primary: v })}
        placeholder="#1976d2"
      />
      <ColorField
        label="Secondary"
        required
        error={errors.secondary}
        value={data.secondary ?? ''}
        onChange={v => onChange({ secondary: v })}
        placeholder="#9c27b0"
      />
      <ColorField
        label="Accent"
        error={errors.accent}
        hint="Optional — shown in supporting UI accents"
        value={data.accent ?? ''}
        onChange={v => onChange({ accent: v })}
        placeholder="#ff8f00"
      />
      <ColorField
        label="Error"
        error={errors.error}
        hint="Optional — used by MUI's palette.error"
        value={data.error ?? ''}
        onChange={v => onChange({ error: v })}
        placeholder="#d32f2f"
      />
      <FieldRow label="Default" hint="Exactly one palette should be marked default — used when no palette is selected">
        <label className="inline-flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={data.isDefault ?? false}
            onChange={e => onChange({ isDefault: e.target.checked })}
          />
          <span>Mark as the default palette</span>
        </label>
      </FieldRow>
      <FieldRow label="Sort Order">
        <input
          type="number"
          className={inputClass}
          value={data.sortOrder ?? 0}
          onChange={e => onChange({ sortOrder: parseInt(e.target.value) || 0 })}
        />
      </FieldRow>
    </>
  )
}
