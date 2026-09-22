import { useState } from 'react'
import type { TeamModelSummary } from '../../../types'
import { FieldRow, inputClass, selectClass } from '../shared/FieldRow'
import type { ExampleDraft } from './FullstackExamplesTab'

interface Props {
  data: ExampleDraft
  errors: Record<string, string>
  onChange: (updates: Partial<ExampleDraft>) => void
  /** Team models an admin can copy the entities from (build in the editor → save to Team → promote). */
  teamModels: TeamModelSummary[]
  onImportTeamModel: (id: number) => Promise<void>
}

export function FullstackExampleForm({ data, errors, onChange, teamModels, onImportTeamModel }: Props) {
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  async function importTeam(id: string) {
    if (!id) return
    setImporting(true)
    setImportError(null)
    try {
      await onImportTeamModel(Number(id))
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <FieldRow label="Example ID" required error={errors.exampleId}
                hint="Lower-case slug, unique across examples (e.g. blog)">
        <input
          className={inputClass}
          value={data.exampleId ?? ''}
          onChange={e => onChange({ exampleId: e.target.value })}
          placeholder="blog"
        />
      </FieldRow>
      <FieldRow label="Name" required error={errors.name} hint="Card title under Fullstack → Start from → Examples">
        <input
          className={inputClass}
          value={data.name ?? ''}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Blog"
        />
      </FieldRow>
      <FieldRow label="Description" error={errors.description}>
        <textarea
          className={inputClass}
          rows={2}
          value={data.description ?? ''}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Authors write posts; readers leave comments."
        />
      </FieldRow>
      <FieldRow label="Icon" error={errors.icon} hint="Material Symbols name (e.g. article, shopping_cart)">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }} aria-hidden="true">
            {data.icon || 'category'}
          </span>
          <input
            className={inputClass}
            value={data.icon ?? ''}
            onChange={e => onChange({ icon: e.target.value })}
            placeholder="article"
          />
        </div>
      </FieldRow>
      <FieldRow label="Copy entities from a team model"
                hint="Build the model in the Fullstack editor, save it to Team, then pick it here"
                error={importError ?? undefined}>
        <select
          className={selectClass}
          value=""
          disabled={importing || teamModels.length === 0}
          onChange={e => void importTeam(e.target.value)}
        >
          <option value="">{teamModels.length === 0 ? 'No team models saved' : importing ? 'Loading…' : 'Choose a team model…'}</option>
          {teamModels.map(m => (
            <option key={m.id} value={m.id}>{m.name} ({m.entityCount} entit{m.entityCount === 1 ? 'y' : 'ies'})</option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Entities (JSON)" required error={errors.entitiesText}
                hint="The entities array of a POST /starter-fullstack.zip body — checked with the generator's validator on save">
        <textarea
          className={`${inputClass} font-mono text-xs`}
          rows={16}
          spellCheck={false}
          value={data.entitiesText}
          onChange={e => onChange({ entitiesText: e.target.value })}
        />
      </FieldRow>
      <FieldRow label="Pages (JSON)" error={errors.pagesText}
                hint="Optional frontend page layout — the pages array of a POST /starter-fullstack.zip body. Blank = the classic dashboard + one list page per entity">
        <textarea
          className={`${inputClass} font-mono text-xs`}
          rows={8}
          spellCheck={false}
          value={data.pagesText ?? ''}
          onChange={e => onChange({ pagesText: e.target.value })}
        />
      </FieldRow>
      <FieldRow label="Settings (JSON)" error={errors.settingsText}
                hint="Optional editor settings applied on load: locale, dashboardTitle, dashboardOverview, backendTemplateSet, frontendTemplateSet, colorPalette, scaffold[]">
        <textarea
          className={`${inputClass} font-mono text-xs`}
          rows={4}
          spellCheck={false}
          value={data.settingsText ?? ''}
          onChange={e => onChange({ settingsText: e.target.value })}
        />
      </FieldRow>
      <FieldRow label="Enabled" hint="Disabled examples stay here but are not offered on the Fullstack tab">
        <label className="inline-flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={data.enabled ?? true}
            onChange={e => onChange({ enabled: e.target.checked })}
          />
          <span>Show on the Fullstack tab</span>
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
