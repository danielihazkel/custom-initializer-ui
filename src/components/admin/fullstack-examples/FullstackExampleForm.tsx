import { useMemo, useState } from 'react'
import type { FullstackNav } from '../../../types'
import type { FullstackEntityDef, FullstackPageDef, TeamModelSummary } from '../../../types'
import { PagesEditor } from '../../fullstack/PagesEditor'
import { requestPages, validatePages } from '../../fullstack/pageLayout'
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
  const [pagesMode, setPagesMode] = useState<'visual' | 'json'>('visual')
  const visual = useMemo(() => parseForVisualEditor(data.entitiesText, data.pagesText, data.settingsText), [data.entitiesText, data.pagesText, data.settingsText])
  const showVisual = pagesMode === 'visual' && !('error' in visual)

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
      <FieldRow label="Pages" error={errors.pagesText}
                hint="Optional frontend page layout — the pages array of a POST /starter-fullstack.zip body. None = the classic dashboard + one list page per entity">
        <div className="space-y-2">
          <div role="radiogroup" aria-label="Pages editor" className="inline-flex overflow-hidden rounded-lg border border-outline-variant text-xs">
            {(['visual', 'json'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={pagesMode === mode}
                onClick={() => setPagesMode(mode)}
                className={`px-3 py-1 font-semibold ${pagesMode === mode ? 'bg-primary/15 text-primary' : 'text-secondary hover:text-primary'}`}
              >
                {mode === 'visual' ? 'Visual' : 'JSON'}
              </button>
            ))}
          </div>
          {pagesMode === 'visual' && 'error' in visual && (
            <p className="text-xs text-secondary" data-pages-visual-unavailable>{visual.error} — edit it as JSON instead.</p>
          )}
          {showVisual && !('error' in visual) ? (
            <PagesEditor
              pages={visual.pages}
              entities={visual.entities}
              validation={validatePages(visual.pages, visual.entities, { scaffoldOpts: visual.scaffold })}
              // The stored JSON is a request body, so the editor-only id lock stays out of it.
              onChange={next => onChange({ pagesText: next.length ? JSON.stringify(requestPages(next), null, 2) : '' })}
              pushUndo={() => {}}
              onClear={() => onChange({ pagesText: '' })}
              previewSettings={{ locale: visual.locale, projectOpts: visual.scaffold, skin: visual.menora ? 'menora' : 'tailwind' }}
              nav={visual.nav}
              layout="stacked"
            />
          ) : (
            <textarea
              className={`${inputClass} font-mono text-xs`}
              rows={8}
              spellCheck={false}
              aria-label="Pages (JSON)"
              value={data.pagesText ?? ''}
              onChange={e => onChange({ pagesText: e.target.value })}
            />
          )}
        </div>
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

/** What the visual page editor needs from the form's JSON fields — or why it cannot be shown
 *  (it edits a parsed layout, so broken JSON has to be fixed in the text first). */
function parseForVisualEditor(entitiesText: string, pagesText: string | undefined, settingsText: string | undefined):
  { entities: FullstackEntityDef[]; pages: FullstackPageDef[]; locale: 'en' | 'he'; scaffold: string[]; menora: boolean; nav?: FullstackNav } | { error: string } {
  let entities: unknown
  try { entities = JSON.parse(entitiesText || '[]') } catch { return { error: 'The entities are not valid JSON' } }
  if (!Array.isArray(entities)) return { error: 'The entities are not a JSON array' }
  let pages: unknown = []
  if (pagesText?.trim()) {
    try { pages = JSON.parse(pagesText) } catch { return { error: 'The pages are not valid JSON' } }
  }
  if (!Array.isArray(pages)) return { error: 'The pages are not a JSON array' }
  let settings: Record<string, unknown> = {}
  try { settings = settingsText?.trim() ? JSON.parse(settingsText) as Record<string, unknown> : {} } catch { /* preview falls back to defaults */ }
  const safeEntities = (entities as FullstackEntityDef[])
    .filter(e => e && typeof e.name === 'string')
    .map(e => ({ ...e, fields: Array.isArray(e.fields) ? e.fields : [] }))
  return {
    entities: safeEntities,
    pages: pages as FullstackPageDef[],
    locale: settings.locale === 'he' ? 'he' : 'en',
    scaffold: Array.isArray(settings.scaffold) ? (settings.scaffold as unknown[]).filter((x): x is string => typeof x === 'string') : [],
    menora: typeof settings.frontendTemplateSet === 'string' && settings.frontendTemplateSet.includes('menora'),
    nav: settings.nav && typeof settings.nav === 'object' ? settings.nav as FullstackNav : undefined,
  }
}
