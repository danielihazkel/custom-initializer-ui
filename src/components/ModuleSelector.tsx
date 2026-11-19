import type { ModuleTemplate } from '../types'
import { t, tn } from '../i18n'

interface Props {
  modules: ModuleTemplate[]
  selectedModules: string[]
  onChange: (modules: string[]) => void
  /**
   * Selected dependencies with a wizard set up (SQL, OpenAPI, WSDL, AsyncAPI). While there is one,
   * Generate goes to the wizard endpoint, which writes a single module — the ticked modules are
   * not used. That used to happen without a word.
   */
  wizardDeps?: string[]
}

export function ModuleSelector({ modules, selectedModules, onChange, wizardDeps = [] }: Props) {
  function toggle(moduleId: string) {
    onChange(
      selectedModules.includes(moduleId)
        ? selectedModules.filter(id => id !== moduleId)
        : [...selectedModules, moduleId]
    )
  }

  if (modules.length === 0) {
    return (
      <p className="text-xs text-secondary">{t('No module templates configured. Add modules in the admin panel.')}</p>
    )
  }

  const modulesUnused = wizardDeps.length > 0 && selectedModules.length > 0

  return (
    <div className="space-y-2">
      {modulesUnused && (
        <div
          role="status"
          data-modules-unused
          className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-on-surface"
        >
          <span className="material-symbols-outlined text-warning shrink-0" style={{ fontSize: '16px' }} aria-hidden="true">warning</span>
          <span>
            <strong className="font-semibold">{t('These modules will not be generated.')}</strong>{' '}
            {tn(wizardDeps.length,
              "{deps} has a wizard set up, and a wizard's code cannot be placed in modules, so the project is generated as one module. Remove the wizard, or switch multi-module off.",
              "{deps} have a wizard set up, and a wizard's code cannot be placed in modules, so the project is generated as one module. Remove the wizard, or switch multi-module off.",
              { deps: wizardDeps.join(', ') })}
          </span>
        </div>
      )}
      {modules.map(m => {
        const checked = selectedModules.includes(m.moduleId)
        return (
          <button
            key={m.moduleId}
            type="button"
            onClick={() => toggle(m.moduleId)}
            className={`w-full text-start rounded-lg border px-4 py-3 transition-all duration-200 ${
              checked
                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                : 'border-outline-variant hover:border-secondary bg-surface-container-lowest'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined text-base ${checked ? 'text-primary' : 'text-secondary'}`}>
                  {checked ? 'check_box' : 'check_box_outline_blank'}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span dir="auto" className="text-sm font-semibold text-on-surface">{m.label}</span>
                    <code className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-secondary">{m.suffix}</code>
                    {m.hasMainClass && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-tertiary/15 text-tertiary font-medium">{t('entry point')}</span>
                    )}
                  </div>
                  {m.description && (
                    <p dir="auto" className="text-xs text-secondary mt-0.5">{m.description}</p>
                  )}
                  {m.dependencyIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {m.dependencyIds.map(dep => (
                        <span key={dep} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                          {dep}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-xs text-secondary">{m.packaging}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
