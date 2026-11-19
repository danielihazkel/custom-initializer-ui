import { useContext } from 'react'
import type { FullstackEntityDef, FullstackFormSection, FullstackRule, FullstackUniqueKey } from '../../types'
import { ModelEntities } from './modelEntities'
import { MAX_UNIQUE_KEYS, keyableMembers } from './uniqueKeys'
import { MAX_RULES, ruleProblems, type RuleProblem } from './rules'
import { EXPR_FUNCTIONS } from './expr'
import type { EntityErrors } from './validation'
import { Labeled, inputClass } from './controls'
import { askableFields } from './pageLayout'
import { MAX_FORM_SECTIONS } from './formSections'
import { ACCESS_LEVELS, ACCESS_LEVEL_LABELS, accessSummary, cleanAccess, readLevel, writeLevel } from './access'
import type { FullstackAccessLevel } from '../../types'
import { t, tn } from '../../i18n'

interface Props {
  entity: FullstackEntityDef
  errors?: EntityErrors
  onUpdate: (updates: Partial<FullstackEntityDef>) => void
  /** Ticking "SELECT view" — the parent sets `viewQuery: ''` and focuses the query textarea. */
  onTickView: (checked: boolean) => void
}

/** One-line summary of the non-default settings, shown beside the Settings button when the
 *  panel is closed so nothing set inside it is invisible. */
export function settingsSummary(entity: FullstackEntityDef): string[] {
  const parts: string[] = []
  if (entity.label?.trim()) parts.push(`“${entity.label.trim()}”${entity.labelPlural?.trim() ? ` / “${entity.labelPlural.trim()}”` : ''}`)
  const table = [entity.schema?.trim(), entity.tableName?.trim()].filter(Boolean).join('.')
  if (table) parts.push(table)
  if (entity.readOnly && entity.viewQuery == null) parts.push(t('read-only'))
  if (entity.viewQuery != null) parts.push(entity.viewQuery.trim() ? t('SELECT view') : t('SELECT view (query missing)'))
  const sections = entity.formSections?.length ?? 0
  if (sections) parts.push(tn(sections, '{n} form section', '{n} form sections'))
  const keys = entity.uniqueKeys?.length ?? 0
  if (keys) parts.push(tn(keys, '{n} unique key', '{n} unique keys'))
  const rules = entity.rules?.length ?? 0
  if (rules) parts.push(tn(rules, '{n} rule', '{n} rules'))
  const access = accessSummary(entity)
  if (access) parts.push(access)
  return parts
}

/**
 * The entity's secondary attributes — display labels, physical mapping, SELECT-backed view —
 * behind one "Settings" button, so the card header stays readable on a laptop. Errors that
 * concern these controls force the panel open (the caller decides).
 */
export function EntitySettingsPanel({ entity, errors, onUpdate, onTickView }: Props) {
  const isView = entity.viewQuery != null
  const queryMissing = isView && !entity.viewQuery?.trim()
  return (
    <div className="rounded-lg border border-outline-variant bg-background/50 px-3 py-3 space-y-3" data-entity-settings>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Labeled label={t('Display label')} hint={t('Human-facing name in the generated UI (nav, headings, dialogs). Blank = derived from the entity name.')}>
          <input type="text" dir="auto" aria-label={t('Display label (optional)')} className={inputClass()} placeholder={t('e.g. Customer')}
                 value={entity.label ?? ''} onChange={e => onUpdate({ label: e.target.value || undefined })} />
        </Labeled>
        <Labeled label={t('Plural label')} hint={t('For nav / list heading / dashboard. Blank = the label, then the derived plural.')}>
          <input type="text" dir="auto" aria-label={t('Plural display label (optional)')} className={inputClass()} placeholder={t('e.g. Customers')}
                 value={entity.labelPlural ?? ''} onChange={e => onUpdate({ labelPlural: e.target.value || undefined })} />
        </Labeled>
        <Labeled label={t('Schema')} hint={t('Database schema the table lives in (optional).')}>
          <input type="text" dir="ltr" aria-label={t('Schema (optional)')} className={inputClass()} placeholder={t('e.g. sales')}
                 value={entity.schema ?? ''} disabled={isView}
                 onChange={e => onUpdate({ schema: e.target.value || undefined })} />
        </Labeled>
        <Labeled label={t('Table name')} hint={isView ? t('A SELECT-backed view maps to its query, not a table') : t('Blank = snake_case of the entity name.')}>
          <input type="text" dir="ltr" aria-label={t('Table name (optional)')} className={inputClass()} placeholder={t('e.g. customers')}
                 value={entity.tableName ?? ''} disabled={isView}
                 onChange={e => onUpdate({ tableName: e.target.value || undefined })} />
        </Labeled>
      </div>

      <div data-entity-access>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Labeled label={t('Who may read')} hint={t("The list, a row, the statistics and the exports. Checked against the caller's roles when the project has ldap-auth or ldap-auth-rest (the default).")}>
            <select aria-label={t('Who may read')} className={inputClass()} value={readLevel(entity)}
                    onChange={e => onUpdate({ access: cleanAccess({ ...entity.access, read: e.target.value as FullstackAccessLevel }) })}>
              {ACCESS_LEVELS.map(level => <option key={level} value={level}>{ACCESS_LEVEL_LABELS[level]}</option>)}
            </select>
          </Labeled>
          <Labeled label={t('Who may write')} hint={entity.readOnly ? t('A read-only entity has nothing to write.') : t('Create, edit, delete, import and bulk changes. An admin is a user too.')}>
            <select aria-label={t('Who may write')} className={inputClass()} value={writeLevel(entity)} disabled={entity.readOnly}
                    aria-invalid={errors?.access ? true : undefined}
                    onChange={e => onUpdate({ access: cleanAccess({ ...entity.access, write: e.target.value as FullstackAccessLevel }) })}>
              {ACCESS_LEVELS.map(level => <option key={level} value={level}>{ACCESS_LEVEL_LABELS[level]}</option>)}
            </select>
          </Labeled>
        </div>
        {errors?.access && <p className="mt-1 text-xs text-error" data-error>{errors.access}</p>}
      </div>

      <FormSectionsEditor entity={entity} error={errors?.formSections} onChange={formSections => onUpdate({ formSections })} />

      {!isView && (
        <UniqueKeysEditor entity={entity} error={errors?.uniqueKeys} onChange={uniqueKeys => onUpdate({ uniqueKeys })} />
      )}

      {!isView && !entity.readOnly && (
        <RulesEditor entity={entity} error={errors?.rules} onChange={rules => onUpdate({ rules })} />
      )}

      <label
        className="flex items-start gap-2 text-xs text-on-surface cursor-pointer"
        title={isView ? t('A SELECT-backed view is always read-only') : t('Generate GET-only scaffolding (no create/update/delete)')}
      >
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-primary"
          aria-label={t('Read-only')}
          checked={Boolean(entity.readOnly) || isView}
          disabled={isView}
          onChange={e => onUpdate({ readOnly: e.target.checked || undefined })}
        />
        <span className="flex flex-col">
          <span>{t('Read-only')}</span>
          <span className="text-[11px] text-secondary">{t('GET-only scaffolding — no create, update or delete.')}</span>
        </span>
      </label>

      <label
        className="flex items-start gap-2 text-xs text-on-surface cursor-pointer"
        title={t('Map this entity to a SELECT query (Hibernate @Immutable + @Subselect) instead of a table. Always read-only; no relations.')}
      >
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" aria-label={t('SELECT-backed view')}
               checked={isView} onChange={e => onTickView(e.target.checked)} />
        <span className="flex flex-col">
          <span>{t('SELECT view')}</span>
          <span className="text-[11px] text-secondary">
            {t('Read-only, mapped to a query via')} <code className="font-mono">@Subselect</code>. {t('Field names must match the projected aliases.')}
          </span>
        </span>
      </label>

      {isView && (
        <div className="space-y-1">
          <textarea
            dir="ltr"
            data-view-query
            aria-label={t('View SELECT query')}
            aria-invalid={queryMissing}
            data-pending={queryMissing ? '' : undefined}
            className={`w-full font-mono text-[11px] bg-background border rounded p-3 min-h-[100px] focus:ring-2 outline-none ${
              queryMissing ? 'border-warning focus:ring-warning/20' : 'border-outline-variant focus:ring-primary/20 focus:border-primary'}`}
            value={entity.viewQuery}
            placeholder="SELECT u.id AS id, u.full_name AS fullName FROM users u"
            spellCheck={false}
            onChange={e => onUpdate({ viewQuery: e.target.value })}
          />
          {queryMissing && (
            <p className="flex items-center gap-1 text-[11px] text-warning" data-pending>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit_note</span>
              {errors?.viewQuery ?? t('Enter the SELECT query or untick "SELECT view"')}
            </p>
          )}
        </div>
      )}

      {entity.sourceSql && !isView && (
        <details className="rounded-lg border border-outline-variant bg-background/50">
          <summary className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-secondary cursor-pointer select-none">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>code</span>
            {t('Imported from this')} <code className="font-mono">CREATE TABLE</code> {t('(read-only — for reference).')}
          </summary>
          <textarea
            dir="ltr"
            aria-label={t('Source CREATE TABLE')}
            className="w-full font-mono text-[11px] bg-background border-t border-outline-variant rounded-b p-3 min-h-[100px] text-secondary outline-none resize-y"
            value={entity.sourceSql}
            readOnly
            spellCheck={false}
          />
        </details>
      )}
    </div>
  )
}

/**
 * Rules over several fields: per rule an optional condition, the check every row must meet, the
 * message and the field it is shown on. Each is checked as it is typed (`rules.ts`, `expr.ts`),
 * the problem shown under the part it is in.
 */
function RulesEditor({ entity, error, onChange }: {
  entity: FullstackEntityDef
  error?: string
  onChange: (rules: FullstackRule[] | undefined) => void
}) {
  const rules = entity.rules ?? []
  // A rule may read a linked row (costCenter.budget): checked against the whole model.
  const problems = ruleProblems(entity, useContext(ModelEntities))
  const set = (next: FullstackRule[]) => onChange(next.length ? next : undefined)
  const patch = (i: number, p: Partial<FullstackRule>) => set(rules.map((r, j) => {
    if (j !== i) return r
    const next: FullstackRule = { ...r, ...p }
    if (!next.when?.trim()) delete next.when
    if (!next.field?.trim()) delete next.field
    return next
  }))
  const problemOf = (i: number, part: RuleProblem['part']) => problems.find(p => p.index === i && p.part === part)?.message
  const mono = (bad?: string) => `${inputClass(bad)} py-1 font-mono text-[11px]`
  return (
    <div className="space-y-2" data-rules>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          {t('Rules')} <span className="font-normal normal-case tracking-normal">{t('· checked by the form and the server before a save (a 400 on the field)')}</span>
        </p>
        <button
          type="button"
          disabled={rules.length >= MAX_RULES}
          onClick={() => set([...rules, { check: '', message: '' }])}
          className="inline-flex items-center gap-1 rounded-md border border-outline-variant px-2 py-0.5 text-[11px] font-semibold text-secondary hover:border-primary/50 hover:text-primary disabled:opacity-40"
          title={rules.length >= MAX_RULES ? t('At most {max} rules', { max: MAX_RULES }) : t('Add a rule over several fields')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">add</span>
          {t('Add rule')}
        </button>
      </div>
      {rules.length === 0 && (
        <p className="text-[11px] text-secondary">
          {t('None. A rule reads the row’s own fields:')} <code className="font-mono">endsOn &gt;= startsOn</code>,{' '}
          <code className="font-mono">status == 'REJECTED'</code>, <code className="font-mono">not isEmpty(reason)</code>.{' '}
          {t('An empty value makes a rule hold.')}
        </p>
      )}
      {rules.map((rule, i) => {
        const n = i + 1
        const checkErr = problemOf(i, 'check')
        const whenErr = problemOf(i, 'when')
        const messageErr = problemOf(i, 'message')
        const fieldErr = problemOf(i, 'field')
        const shown = checkErr ?? whenErr ?? messageErr ?? fieldErr
        return (
          <div key={i} className="space-y-1.5 rounded-md border border-outline-variant px-2 py-1.5" data-rule={i}>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-1.5 items-center">
              <input type="text" dir="ltr" aria-label={t('Condition of rule {n} (optional)', { n })} placeholder={t("when (optional): status == 'DONE'")}
                     className={mono(whenErr)} value={rule.when ?? ''} spellCheck={false}
                     onChange={e => patch(i, { when: e.target.value })} />
              <input type="text" dir="ltr" aria-label={t('Check of rule {n}', { n })} placeholder={t('check: endsOn >= startsOn')}
                     className={mono(checkErr)} value={rule.check} spellCheck={false}
                     onChange={e => patch(i, { check: e.target.value })} />
              <button type="button" onClick={() => set(rules.filter((_, j) => j !== i))}
                className="justify-self-end rounded p-0.5 text-secondary hover:text-error" aria-label={t('Remove rule {n}', { n })}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">close</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-1.5">
              <input type="text" dir="auto" aria-label={t('Message of rule {n}', { n })} placeholder={t('Message, e.g. Ends on or after the day it starts')}
                     className={`${inputClass(messageErr)} py-1 text-xs`} value={rule.message}
                     onChange={e => patch(i, { message: e.target.value })} />
              <select aria-label={t('Field rule {n} is shown on', { n })} className={`${inputClass(fieldErr)} py-1 text-xs`}
                      value={rule.field ?? ''} onChange={e => patch(i, { field: e.target.value })}>
                <option value="">{t('Shown on: the first field it reads')}</option>
                {entity.fields.filter(f => !(f.primaryKey && f.generated)).map(f => (
                  <option key={f.uid ?? f.name} value={f.name}>{t('Shown on: {field}', { field: f.label?.trim() || f.name })}</option>
                ))}
              </select>
            </div>
            {shown && <p className="text-[11px] text-error" data-error>{shown}</p>}
          </div>
        )
      })}
      {error && !problems.some(p => p.index >= 0) && <p className="text-[11px] text-error" data-error>{error}</p>}
      {rules.length > 0 && (
        <p className="text-[10px] text-secondary">
          {t('Fields by name;')} <code className="font-mono">and or not</code>, <code className="font-mono">== != &lt; &lt;= &gt; &gt;=</code>,{' '}
          <code className="font-mono">+ - * /</code> {t('(days on a date), texts in quotes;')} <span dir="ltr">{EXPR_FUNCTIONS.map(f => `${f}()`).join(', ')}</span>.
        </p>
      )}
    </div>
  )
}

/**
 * Unique keys over several fields and links: a row of chips per key, a member on or off. A key
 * needs two or more; one field is unique by its own Unique box.
 */
function UniqueKeysEditor({ entity, error, onChange }: {
  entity: FullstackEntityDef
  error?: string
  onChange: (keys: FullstackUniqueKey[] | undefined) => void
}) {
  const keys = entity.uniqueKeys ?? []
  const members = keyableMembers(entity)
  const set = (next: FullstackUniqueKey[]) => onChange(next.length ? next : undefined)
  return (
    <div className="space-y-2" data-unique-keys>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          {t('Unique together')} <span className="font-normal normal-case tracking-normal">{t('· no two rows share these values (a 409 names them)')}</span>
        </p>
        <button
          type="button"
          disabled={keys.length >= MAX_UNIQUE_KEYS || members.length < 2}
          onClick={() => set([...keys, { fields: [] }])}
          className="inline-flex items-center gap-1 rounded-md border border-outline-variant px-2 py-0.5 text-[11px] font-semibold text-secondary hover:border-primary/50 hover:text-primary disabled:opacity-40"
          title={keys.length >= MAX_UNIQUE_KEYS ? t('At most {max} keys', { max: MAX_UNIQUE_KEYS }) : t('Add a key over two or more fields')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">add</span>
          {t('Add key')}
        </button>
      </div>
      {keys.length === 0 && (
        <p className="text-[11px] text-secondary">{t('None. A single field’s uniqueness is its own Unique box.')}</p>
      )}
      {keys.map((key, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1 rounded-md border border-outline-variant px-2 py-1.5" data-unique-key={i}>
          {members.map(m => {
            const on = key.fields.includes(m.name)
            return (
              <button
                key={m.name}
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={t('{field} in unique key {n}', { field: m.name, n: i + 1 })}
                onClick={() => set(keys.map((k, j) => (j !== i ? k
                  : { fields: on ? k.fields.filter(f => f !== m.name) : [...k.fields, m.name] })))}
                className={`rounded-full px-2 py-0.5 text-[11px] ${on ? 'bg-primary/10 text-primary' : 'border border-dashed border-outline-variant text-secondary hover:text-primary'}`}
              >
                {m.name}
              </button>
            )
          })}
          <span className="flex-1" />
          <button type="button" onClick={() => set(keys.filter((_, j) => j !== i))}
            className="rounded p-0.5 text-secondary hover:text-error" aria-label={t('Remove unique key {n}', { n: i + 1 })}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">close</span>
          </button>
        </div>
      ))}
      {error && <p className="text-[11px] text-error" data-error>{error}</p>}
    </div>
  )
}

/**
 * The form in titled sections: each lists some of the entity's fields and relations (a chip per
 * name, on in at most one section). The drawer form, the record's details and a wizard without
 * steps of its own follow them; what no section lists comes after, untitled.
 */
function FormSectionsEditor({ entity, error, onChange }: {
  entity: FullstackEntityDef
  error?: string
  onChange: (sections: FullstackFormSection[] | undefined) => void
}) {
  const sections = entity.formSections ?? []
  const names = askableFields(entity).map(a => a.name)
  const owner = (name: string) => sections.findIndex(s => s.fields.includes(name))
  const set = (next: FullstackFormSection[]) => onChange(next.length ? next : undefined)
  const patch = (i: number, p: Partial<FullstackFormSection>) => set(sections.map((s, j) => (j === i ? { ...s, ...p } : s)))
  const unplaced = names.filter(n => owner(n) < 0)
  return (
    <div className="space-y-2" data-form-sections>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          {t('Form sections')} <span className="font-normal normal-case tracking-normal">{t("· group the form, the details and the wizard's steps")}</span>
        </p>
        <button
          type="button"
          disabled={sections.length >= MAX_FORM_SECTIONS || names.length === 0}
          onClick={() => set([...sections, { title: t('Section {n}', { n: sections.length + 1 }), fields: unplaced.slice(0, 4) }])}
          className="inline-flex items-center gap-1 rounded-md border border-outline-variant px-2 py-0.5 text-[11px] font-semibold text-secondary hover:border-primary/50 hover:text-primary disabled:opacity-40"
          title={sections.length >= MAX_FORM_SECTIONS ? t('At most {max} sections', { max: MAX_FORM_SECTIONS }) : t('Add a titled section')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">add</span>
          {t('Add section')}
        </button>
      </div>
      {sections.length === 0 && (
        <p className="text-[11px] text-secondary">{t('None — the form is one list of fields, in their order.')}</p>
      )}
      {sections.map((section, i) => (
        <div key={i} className="space-y-1.5 rounded-md border border-outline-variant px-2 py-1.5" data-form-section={i}>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              dir="auto"
              aria-label={t('Title of form section {n}', { n: i + 1 })}
              value={section.title}
              onChange={e => patch(i, { title: e.target.value })}
              className={`${inputClass(!section.title.trim() ? 'x' : undefined)} max-w-[16rem] py-1 text-xs`}
            />
            <span className="flex-1" />
            <button type="button" disabled={i === 0} onClick={() => set(sections.map((s, j) => (j === i - 1 ? sections[i] : j === i ? sections[i - 1] : s)))}
              className="rounded p-0.5 text-secondary hover:text-primary disabled:opacity-30" aria-label={t('Move form section {n} up', { n: i + 1 })}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">arrow_upward</span>
            </button>
            <button type="button" disabled={i === sections.length - 1} onClick={() => set(sections.map((s, j) => (j === i + 1 ? sections[i] : j === i ? sections[i + 1] : s)))}
              className="rounded p-0.5 text-secondary hover:text-primary disabled:opacity-30" aria-label={t('Move form section {n} down', { n: i + 1 })}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">arrow_downward</span>
            </button>
            <button type="button" onClick={() => set(sections.filter((_, j) => j !== i))}
              className="rounded p-0.5 text-secondary hover:text-error" aria-label={t('Remove form section {n}', { n: i + 1 })}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }} aria-hidden="true">close</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {names.map(name => {
              const at = owner(name)
              const on = at === i
              const elsewhere = at >= 0 && at !== i
              return (
                <button
                  key={name}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={t('{field} in form section {n}', { field: name, n: i + 1 })}
                  disabled={elsewhere}
                  title={elsewhere ? t('In “{section}”', { section: sections[at].title }) : on ? t('In this section — click to take it out') : t('Click to put it in this section')}
                  onClick={() => patch(i, { fields: on ? section.fields.filter(f => f !== name) : [...section.fields, name] })}
                  className={`rounded-full px-2 py-0.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-40 ${on ? 'bg-primary/10 text-primary' : 'border border-dashed border-outline-variant text-secondary hover:text-primary'}`}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {sections.length > 0 && unplaced.length > 0 && (
        <p className="text-[11px] text-secondary" data-form-sections-rest>{t('Not in a section (shown after them): {fields}', { fields: unplaced.join(', ') })}</p>
      )}
      {error && <p className="text-[11px] text-error">{error}</p>}
    </div>
  )
}
