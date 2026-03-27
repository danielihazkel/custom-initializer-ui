import type { OptionsPanelProps } from '../types'

export function OptionsPanel({ metadata, values, onChange, section }: OptionsPanelProps) {
  if (!metadata) return null

  const bootVersions = metadata.bootVersion?.values ?? []
  const javaVersions = metadata.javaVersion?.values ?? []
  const languages = (metadata.language?.values ?? []).filter(l => l.id !== 'kotlin')
  const packagings = metadata.packaging?.values ?? []
  const types = metadata.type?.values ?? []

  const buildTypes = types.filter(t => t.id === 'maven-project')

  const sectionLabelClass = 'text-[10px] font-bold uppercase tracking-widest text-secondary flex items-center gap-2'

  if (section === 'upper') {
    return (
      <div className="space-y-8">
        {/* Project + Language side by side */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <span className={sectionLabelClass}>
              <span className="material-symbols-outlined outline-none text-primary/70" style={{ fontSize: '16px' }}>account_tree</span>
              Project Build
            </span>
            <div className="flex flex-col gap-3 mt-2">
              {buildTypes.map(t => (
                <label key={t.id} className="relative cursor-pointer group">
                  <input
                    type="radio"
                    name="project-type"
                    value={t.id}
                    checked={values.type === t.id}
                    onChange={() => onChange({ type: t.id })}
                    className="sr-only"
                  />
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex items-center gap-4
                    ${values.type === t.id 
                      ? 'bg-primary/10 border-primary ring-1 ring-primary/30 shadow-[0_0_15px_rgba(139,92,246,0.1)]' 
                      : 'bg-surface-container-high border-outline-variant hover:bg-surface-container-highest hover:border-outline'}`}
                  >
                    <div className={`p-2 rounded-lg flex items-center justify-center transition-colors ${values.type === t.id ? 'bg-primary text-on-primary' : 'bg-surface text-secondary group-hover:text-on-surface'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                        {t.id.includes('maven') ? 'data_object' : 'build'}
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${values.type === t.id ? 'text-primary' : 'text-on-surface'}`}>{t.name}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <span className={sectionLabelClass}>
              <span className="material-symbols-outlined outline-none text-tertiary/70" style={{ fontSize: '16px' }}>code</span>
              Language
            </span>
            <div className="flex flex-col gap-3 mt-2">
              {languages.map(l => (
                <label key={l.id} className="relative cursor-pointer group">
                  <input
                    type="radio"
                    name="language"
                    value={l.id}
                    checked={values.language === l.id}
                    onChange={() => onChange({ language: l.id })}
                    className="sr-only"
                  />
                  <div className={`p-4 rounded-xl border transition-all duration-300 flex items-center gap-4
                    ${values.language === l.id 
                      ? 'bg-tertiary/10 border-tertiary ring-1 ring-tertiary/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                      : 'bg-surface-container-high border-outline-variant hover:bg-surface-container-highest hover:border-outline'}`}
                  >
                    <div className={`p-2 rounded-lg flex items-center justify-center transition-colors ${values.language === l.id ? 'bg-tertiary text-on-tertiary' : 'bg-surface text-secondary group-hover:text-on-surface'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                        {l.id === 'java' ? 'local_cafe' : l.id === 'kotlin' ? 'integration_instructions' : 'terminal'}
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${values.language === l.id ? 'text-tertiary' : 'text-on-surface'}`}>{l.name}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Spring Boot version */}
        <div className="space-y-3 pt-4 border-t border-outline-variant/50">
          <span className={sectionLabelClass}>
            <span className="material-symbols-outlined outline-none text-secondary/70" style={{ fontSize: '16px' }}>update</span>
            Spring Boot Version
          </span>
          <div className="flex flex-wrap gap-1 mt-2 p-1.5 bg-surface-container-low rounded-xl border border-outline-variant w-fit shadow-inner">
            {bootVersions.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => onChange({ bootVersion: v.id })}
                className={`px-4 py-2 text-xs font-bold transition-all rounded-lg ${
                  values.bootVersion === v.id
                    ? 'bg-surface border border-outline-variant shadow-sm text-on-surface'
                    : 'text-secondary hover:text-on-surface hover:bg-surface border border-transparent hover:border-outline-variant/50'
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (section === 'lower') {
    return (
      <div className="grid grid-cols-2 gap-8 pt-8 pb-4 mt-8 border-t border-outline-variant/50">
        <div className="space-y-3">
          <span className={sectionLabelClass}>Packaging</span>
          <div className="flex gap-2 mt-2 p-1 bg-surface-container-low rounded-lg border border-outline-variant w-fit">
            {packagings.map(p => (
              <label key={p.id} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="packaging"
                  value={p.id}
                  checked={values.packaging === p.id}
                  onChange={() => onChange({ packaging: p.id })}
                  className="sr-only"
                />
                <div className={`px-4 py-1.5 text-xs font-bold transition-all rounded-md ${
                  values.packaging === p.id
                    ? 'bg-surface border border-outline-variant shadow-sm text-on-surface'
                    : 'text-secondary hover:text-on-surface'
                }`}>
                  {p.name}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <span className={sectionLabelClass}>Java Version</span>
          <div className="flex gap-2 mt-2 p-1 bg-surface-container-low rounded-lg border border-outline-variant w-fit">
            {javaVersions.map(v => (
              <label key={v.id} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="java-version"
                  value={v.id}
                  checked={values.javaVersion === v.id}
                  onChange={() => onChange({ javaVersion: v.id })}
                  className="sr-only"
                />
                <div className={`px-4 py-1.5 text-xs font-bold transition-all rounded-md ${
                  values.javaVersion === v.id
                    ? 'bg-surface border border-outline-variant shadow-sm text-on-surface'
                    : 'text-secondary hover:text-on-surface'
                }`}>
                  {v.name}
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return null
}
