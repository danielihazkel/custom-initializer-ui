import type { ModuleTemplate } from '../types'

interface Props {
  modules: ModuleTemplate[]
  selectedModules: string[]
  onChange: (modules: string[]) => void
}

export function ModuleSelector({ modules, selectedModules, onChange }: Props) {
  function toggle(moduleId: string) {
    onChange(
      selectedModules.includes(moduleId)
        ? selectedModules.filter(id => id !== moduleId)
        : [...selectedModules, moduleId]
    )
  }

  if (modules.length === 0) {
    return (
      <p className="text-xs text-secondary">No module templates configured. Add modules in the admin panel.</p>
    )
  }

  return (
    <div className="space-y-2">
      {modules.map(m => {
        const checked = selectedModules.includes(m.moduleId)
        return (
          <button
            key={m.moduleId}
            type="button"
            onClick={() => toggle(m.moduleId)}
            className={`w-full text-left rounded-lg border px-4 py-3 transition-all duration-200 ${
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
                    <span className="text-sm font-semibold text-on-surface">{m.label}</span>
                    <code className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-secondary">{m.suffix}</code>
                    {m.hasMainClass && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-tertiary/15 text-tertiary font-medium">entry point</span>
                    )}
                  </div>
                  {m.description && (
                    <p className="text-xs text-secondary mt-0.5">{m.description}</p>
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
