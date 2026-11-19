import type { ReactNode } from 'react'
import type { CompatibilityRule, EntityTemplateSetSummary, FullstackEntityDef } from '../../types'
import type { FeColorPalette } from '../../hooks/useFrontendMetadata'
import type { MetaErrors } from './validation'
import type { ProjectMeta } from './snapshot'
import { canonicalVersion } from './validation'
import { Labeled, SectionHeading, SetDescription, SetLabel, inputClass } from './controls'
import { FullstackDepPicker } from './FullstackDepPicker'
import { OptionCoverage } from './OptionCoverage'
import { DepartmentSelect } from '../shared/DepartmentSelect'
import { OPTIONS_SECTION, RTL_OPTION, isEntityOptKey } from './scaffoldOptions'
import { t } from '../../i18n'

/**
 * Everything that configures the *project* rather than the *model*: Maven coordinates and
 * versions, the backend template set, a summary of the frontend look (edited in the layout
 * designer), the opt-in scaffolding extras, and the dependency catalog.
 *
 * It is one panel because it is one job, done once per project and then left alone — which is why
 * FullstackView collapses it behind a summary bar and gives the vertical space to the entity
 * modeller instead. The internal 5/7 split mirrors the Backend and Frontend tabs.
 *
 * Pure presentation: every value and setter is a prop, so all the editor state stays in
 * FullstackView and undo/redo, share links and the draft persistence keep working unchanged.
 */
export interface FullstackSetupPanelProps {
  meta: ProjectMeta
  metaErrors: MetaErrors
  updateMeta: (updates: Partial<ProjectMeta>) => void

  javaVersions: string[]
  bootVersions: string[]
  packagings: string[]

  backendSets: EntityTemplateSetSummary[]
  backendSet: string
  frontendSet: string
  setBackendSet: (setKey: string) => void
  currentBackendSet?: EntityTemplateSetSummary
  currentFrontendSet?: EntityTemplateSetSummary
  setsLoading: boolean
  setsError: string | null
  loadTemplateSets: () => void

  palettes: FeColorPalette[]
  /** The palette actually in force — the explicit choice, else the set's default. */
  effectivePalette: string
  /** The explicit choice ('' = the set's default). */
  colorPalette: string
  /** Opens the layout designer's Appearance view, where the frontend look is edited. */
  onEditFrontend: () => void

  scaffoldOpts: string[]
  toggleOpt: (value: string) => void

  selectedDeps: string[]
  setSelectedDeps: React.Dispatch<React.SetStateAction<string[]>>
  currentDefaults: string[]
  compatibilityRules: CompatibilityRule[]

  /** Only for the per-option "applies to N of M entities" coverage line. */
  entities: FullstackEntityDef[]
  revealRow: (uid: string) => void

  /** The section-jump pills, rendered above the grid so they sit inside the panel they target. */
  nav?: ReactNode
  /** A page layout is set: the classic dashboard's heading then has no effect (each dashboard
   *  page carries its own), so the summary does not mention it. */
  hasPages?: boolean
}

export function FullstackSetupPanel({
  meta, metaErrors, updateMeta,
  javaVersions, bootVersions, packagings,
  backendSets, backendSet, frontendSet, setBackendSet,
  currentBackendSet, currentFrontendSet, setsLoading, setsError, loadTemplateSets,
  palettes, effectivePalette, colorPalette, onEditFrontend,
  scaffoldOpts, toggleOpt,
  selectedDeps, setSelectedDeps, currentDefaults, compatibilityRules,
  entities, revealRow,
  nav,
  hasPages = false,
}: FullstackSetupPanelProps) {
  const palette = palettes.find(p => p.id === effectivePalette)
  return (
    <div className="space-y-5">
      {nav}
      {/* Settings on the left, the dependency catalog on the right; one column below lg
          (mirrors the Backend/Frontend tabs). */}
      <div className="grid grid-cols-12 gap-8 items-start">
        <div className="col-span-12 lg:col-span-5 space-y-8">
          <section id="fs-meta" className="space-y-3">
            <SectionHeading icon="tune" title={t('Project Metadata')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Labeled label={t('Group ID')} htmlFor="fs-groupId" error={metaErrors.groupId}>
                <input id="fs-groupId" dir="ltr" className={inputClass(metaErrors.groupId)} value={meta.groupId}
                       aria-invalid={Boolean(metaErrors.groupId)}
                       onChange={e => updateMeta({ groupId: e.target.value })} />
              </Labeled>
              <Labeled label={t('Artifact ID')} htmlFor="fs-artifactId" error={metaErrors.artifactId}>
                <input id="fs-artifactId" dir="ltr" className={inputClass(metaErrors.artifactId)} value={meta.artifactId}
                       aria-invalid={Boolean(metaErrors.artifactId)}
                       onChange={e => updateMeta({ artifactId: e.target.value })} />
              </Labeled>
              <Labeled label={t('Name')} htmlFor="fs-name" error={metaErrors.name}>
                <input id="fs-name" dir="auto" className={inputClass(metaErrors.name)} value={meta.name}
                       aria-invalid={Boolean(metaErrors.name)}
                       placeholder={meta.artifactId || 'demo'}
                       title={t('Project name in the generated pom.xml (blank = the artifact id)')}
                       onChange={e => updateMeta({ name: e.target.value })} />
              </Labeled>
              <Labeled label={t('Description')} htmlFor="fs-description">
                <input id="fs-description" dir="auto" className={inputClass()} value={meta.description}
                       placeholder={t('Optional one-liner for the pom')}
                       onChange={e => updateMeta({ description: e.target.value })} />
              </Labeled>
              <Labeled label={t('Package Name')} htmlFor="fs-packageName" error={metaErrors.packageName}>
                <input id="fs-packageName" dir="ltr" className={inputClass(metaErrors.packageName)} value={meta.packageName}
                       aria-invalid={Boolean(metaErrors.packageName)}
                       onChange={e => updateMeta({ packageName: e.target.value })} />
              </Labeled>
              <Labeled label={t('Domain Package')} htmlFor="fs-domainPackage" error={metaErrors.domainPackage}>
                <input id="fs-domainPackage" dir="ltr" className={inputClass(metaErrors.domainPackage)} value={meta.domainPackage}
                       aria-invalid={Boolean(metaErrors.domainPackage)}
                       placeholder={meta.packageName || 'com.menora.demo'}
                       onChange={e => updateMeta({ domainPackage: e.target.value })} />
                <p className="text-[11px] text-on-surface-variant">
                  {t('Where entities/repositories/controllers go, split into')} <code>.entity</code>, <code>.repository</code>,{' '}
                  <code>.dto</code>, <code>.service</code>, <code>.controller</code>. {t('Blank = same as Package Name; must be under it.')}
                </p>
              </Labeled>
              {/* A restored/imported version that has left the catalog is kept visible as an "(unknown)"
                  option and flagged, rather than silently snapping the select to the first entry. */}
              <Labeled label={t('Java Version')} htmlFor="fs-javaVersion" error={metaErrors.javaVersion}>
                <select id="fs-javaVersion" className={inputClass(metaErrors.javaVersion)} value={meta.javaVersion}
                        aria-invalid={Boolean(metaErrors.javaVersion)}
                        onChange={e => updateMeta({ javaVersion: e.target.value })}>
                  {(javaVersions.length === 0 || !javaVersions.includes(meta.javaVersion)) && (
                    <option value={meta.javaVersion}>{javaVersions.length > 0 ? t('{version} (unknown)', { version: meta.javaVersion }) : meta.javaVersion}</option>
                  )}
                  {javaVersions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Labeled>
              <Labeled label={t('Boot Version')} htmlFor="fs-bootVersion" error={metaErrors.bootVersion}>
                <select id="fs-bootVersion" className={inputClass(metaErrors.bootVersion)} value={meta.bootVersion}
                        aria-invalid={Boolean(metaErrors.bootVersion)}
                        onChange={e => updateMeta({ bootVersion: canonicalVersion(e.target.value) })}>
                  {(bootVersions.length === 0 || !bootVersions.includes(meta.bootVersion)) && (
                    <option value={meta.bootVersion}>{bootVersions.length > 0 ? t('{version} (unknown)', { version: meta.bootVersion }) : meta.bootVersion}</option>
                  )}
                  {bootVersions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Labeled>
              <Labeled label={t('Version')} htmlFor="fs-version" error={metaErrors.version}>
                <input id="fs-version" dir="ltr" className={inputClass(metaErrors.version)} value={meta.version}
                       aria-invalid={Boolean(metaErrors.version)}
                       placeholder="0.0.1-SNAPSHOT"
                       title={t('Artifact version in the generated pom.xml (blank = the catalog default)')}
                       onChange={e => updateMeta({ version: e.target.value })} />
              </Labeled>
              {/* configurationFileFormat is deliberately not offered: the common catalog writes
                  application.yaml and deletes application.properties whatever the request says. */}
              <Labeled label={t('Department')} htmlFor="fs-department"
                       hint={t("Exposed to both halves' templates as {{department}} (k8s namespace, image repo, …)")}>
                <DepartmentSelect id="fs-department" className={inputClass()} value={meta.department}
                                  onChange={department => updateMeta({ department })} />
              </Labeled>
              <Labeled label={t('Packaging')} htmlFor="fs-packaging">
                <select id="fs-packaging" className={inputClass()} value={meta.packaging}
                        onChange={e => updateMeta({ packaging: e.target.value })}>
                  {(packagings.length > 0 ? packagings : ['jar', 'war']).map(p => <option key={p} value={p}>{p}</option>)}
                  {packagings.length > 0 && !packagings.includes(meta.packaging) && <option value={meta.packaging}>{t('{version} (unknown)', { version: meta.packaging })}</option>}
                </select>
              </Labeled>
            </div>
          </section>

          {/* Backend: which template set renders the Spring side. Frontend (below): a summary of the
              generated SPA's look, which the layout designer edits. */}
          <section id="fs-backend" className="space-y-3">
            <SectionHeading icon="dns" title={t('Backend')} />
            <p className="text-[11px] text-on-surface-variant">
              {t('Generated files come from the selected template sets. Edit them in the Config admin panel under "Entity CRUD".')}
            </p>
            {setsError && (
              <div className="flex items-center justify-between gap-3 text-[11px] text-error border border-error/30 bg-error/10 rounded px-3 py-2">
                <span>{t("Couldn't load template sets ({error}); showing defaults.", { error: setsError })}</span>
                <button
                  type="button"
                  onClick={loadTemplateSets}
                  disabled={setsLoading}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-error/40 text-error hover:bg-error/10 transition-colors disabled:opacity-60"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>refresh</span>
                  {t('Retry')}
                </button>
              </div>
            )}
            {setsLoading ? (
              <div className="h-[58px] rounded bg-surface-container-low animate-pulse" aria-hidden="true" />
            ) : (
              <Labeled label={t('Template set')} htmlFor="fs-backendSet">
                {/* A single-option <select> is just visual noise — show read-only text until a
                    second set of this kind exists. */}
                {backendSets.length > 1 ? (
                  <select id="fs-backendSet" className={inputClass()} value={backendSet} onChange={e => setBackendSet(e.target.value)}>
                    {backendSets.map(s => <option key={s.setKey} value={s.setKey}>{s.name} ({s.setKey})</option>)}
                  </select>
                ) : (
                  <SetLabel name={currentBackendSet?.name} setKey={backendSet} />
                )}
                <SetDescription set={currentBackendSet} />
              </Labeled>
            )}
          </section>

          {/* The generated app's look is edited in the layout designer, beside its preview; here
              it is one line that says what is chosen and opens the designer there. */}
          <section id="fs-frontend" className="space-y-3">
            <SectionHeading icon="web" title={t('Frontend')} />
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant px-3 py-2.5" data-frontend-summary>
              {palette && (
                <span
                  className="h-6 w-6 shrink-0 rounded-full border border-outline-variant"
                  style={{ background: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.primary} 50%, ${palette.secondary} 50%, ${palette.secondary} 100%)` }}
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0 flex-1 text-sm text-on-surface">
                {currentFrontendSet?.name ?? frontendSet}
                <span className="text-[11px] text-secondary">
                  {palette && ` · ${colorPalette ? palette.name : t('{palette} (set default)', { palette: palette.name })}`}
                  {` · ${meta.locale === 'he' ? 'עברית' : 'English'} · ${scaffoldOpts.includes(RTL_OPTION.value) ? t('right-to-left') : t('left-to-right')}`}
                </span>
              </span>
              <button
                type="button"
                onClick={onEditFrontend}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                data-edit-frontend
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">palette</span>
                {t('Edit in designer')}
              </button>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              {hasPages
                ? t('Template set, colours, language and direction are set in the layout designer’s Appearance view, beside a live preview of the app.')
                : t('Template set, colours, language and direction, and the dashboard heading are set in the layout designer’s Appearance view, beside a live preview of the app.')}
            </p>
          </section>

          <section id="fs-options" className="space-y-3">
            <SectionHeading icon="toggle_on" title={t('Options')} />
            <p className="text-[11px] text-on-surface-variant">
              {t('Opt-in scaffolding extras applied to every entity. Off by default. An entity can switch the per-entity ones On/Off for itself under its')}{' '}
              <strong>{t('Overrides')}</strong>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {OPTIONS_SECTION.map(opt => {
                const checked = scaffoldOpts.includes(opt.value)
                const missingDep = checked && opt.requiresAnyDep && !opt.requiresAnyDep.some(d => selectedDeps.includes(d))
                return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors ${missingDep ? 'border-warning/50 bg-warning/5' : 'border-outline-variant'}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-primary"
                    checked={checked}
                    onChange={() => toggleOpt(opt.value)}
                  />
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm text-on-surface">
                      {opt.label}
                      {!opt.perEntity && <span className="ms-1.5 text-[10px] uppercase tracking-wider text-secondary" title={t('Applies to the whole project — entities cannot override it')}>{t('project-wide')}</span>}
                    </span>
                    <span className="text-[11px] text-secondary">{opt.hint}</span>
                    {checked && isEntityOptKey(opt.value) && (
                      <OptionCoverage optKey={opt.value} entities={entities} onReveal={revealRow} />
                    )}
                    {missingDep && opt.requiresAnyDep && (
                      <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-warning" role="alert">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>warning</span>
                        <span>{t('Has no effect without')} <code className="font-mono">{opt.requiresAnyDep[0]}</code>.</span>
                        <button
                          type="button"
                          onClick={e => { e.preventDefault(); setSelectedDeps(prev => [...prev, opt.requiresAnyDep![0]]) }}
                          className="font-semibold underline hover:no-underline"
                        >
                          {t('Add it')}
                        </button>
                      </span>
                    )}
                  </span>
                </label>
                )
              })}
            </div>
          </section>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <section id="fs-deps" className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <SectionHeading icon="inventory_2" title={t('Dependencies')} />
              <span className="text-[11px] text-secondary">{t('{n} selected', { n: selectedDeps.length })}</span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              {t("Pre-checked from the chosen backend set's defaults. You can uncheck anything — the generator respects your final selection. To change what a set ships pre-checked, edit it under Admin → Entity CRUD.")}
            </p>
            <FullstackDepPicker
              selected={selectedDeps}
              defaults={currentDefaults}
              onChange={setSelectedDeps}
              compatibilityRules={compatibilityRules}
            />
          </section>
        </div>
      </div>
    </div>
  )
}
