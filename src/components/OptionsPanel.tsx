import type { OptionsPanelProps } from '../types'

export function OptionsPanel({ metadata, values, onChange, section, isDark }: OptionsPanelProps) {
  if (!metadata) return null

  const bootVersions = metadata.bootVersion?.values ?? []
  const javaVersions = metadata.javaVersion?.values ?? []
  const languages = metadata.language?.values ?? []
  const packagings = metadata.packaging?.values ?? []
  const types = metadata.type?.values ?? []

  const buildTypes = types.filter(t =>
    ['maven-project', 'gradle-project', 'gradle-project-kotlin'].includes(t.id)
  )

  const sectionLabelClass = 'text-xs font-bold uppercase tracking-widest text-secondary'

  function radioRowClass(active: boolean): string {
    if (isDark) {
      return `flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
        active
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-outline-variant bg-surface-container-low hover:border-primary/50 text-on-surface'
      }`
    } else {
      return `flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
        active
          ? 'bg-surface-container-lowest border border-primary/30 text-on-surface'
          : 'bg-surface-container-lowest border border-transparent hover:border-primary/20 text-on-surface'
      }`
    }
  }

  if (section === 'upper') {
    return (
      <div className="space-y-8">
        {/* Project + Language side by side */}
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-3">
            <span className={sectionLabelClass}>Project</span>
            <div className="flex flex-col gap-2 mt-1">
              {buildTypes.map(t => (
                <label key={t.id} className={radioRowClass(values.type === t.id)}>
                  <input
                    type="radio"
                    name="project-type"
                    value={t.id}
                    checked={values.type === t.id}
                    onChange={() => onChange({ type: t.id })}
                    className="accent-primary w-4 h-4"
                  />
                  <span className="text-sm font-medium">{t.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <span className={sectionLabelClass}>Language</span>
            <div className="flex flex-col gap-2 mt-1">
              {languages.map(l => (
                <label key={l.id} className={radioRowClass(values.language === l.id)}>
                  <input
                    type="radio"
                    name="language"
                    value={l.id}
                    checked={values.language === l.id}
                    onChange={() => onChange({ language: l.id })}
                    className="accent-primary w-4 h-4"
                  />
                  <span className="text-sm font-medium">{l.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Spring Boot version */}
        <div className="space-y-3">
          <span className={sectionLabelClass}>Spring Boot</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {bootVersions.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => onChange({ bootVersion: v.id })}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  isDark
                    ? values.bootVersion === v.id
                      ? 'rounded border border-primary text-primary bg-primary/5 font-bold'
                      : 'rounded border border-outline-variant text-secondary hover:text-on-surface hover:border-outline'
                    : values.bootVersion === v.id
                      ? 'rounded-full border border-primary text-primary bg-primary/5 font-bold'
                      : 'rounded-full border border-outline-variant/30 text-on-surface-variant hover:border-primary/50'
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
      <div className="grid grid-cols-2 gap-8 pt-4">
        <div className="space-y-3">
          <span className={sectionLabelClass}>Packaging</span>
          {isDark ? (
            <div className="flex gap-4 mt-1">
              {packagings.map(p => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="packaging"
                    value={p.id}
                    checked={values.packaging === p.id}
                    onChange={() => onChange({ packaging: p.id })}
                    className="accent-primary"
                  />
                  <span className="text-sm text-on-surface">{p.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="flex gap-2 mt-1">
              {packagings.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange({ packaging: p.id })}
                  className={`flex-1 py-2 text-sm rounded-lg transition-all ${
                    values.packaging === p.id
                      ? 'bg-white shadow-sm border border-primary/10 text-primary font-bold'
                      : 'bg-surface-container-low text-on-surface-variant font-medium'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <span className={sectionLabelClass}>Java Version</span>
          {isDark ? (
            <div className="flex gap-4 mt-1">
              {javaVersions.map(v => (
                <label key={v.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="java-version"
                    value={v.id}
                    checked={values.javaVersion === v.id}
                    onChange={() => onChange({ javaVersion: v.id })}
                    className="accent-primary"
                  />
                  <span className="text-sm text-on-surface">{v.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="flex gap-2 mt-1">
              {javaVersions.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onChange({ javaVersion: v.id })}
                  className={`flex-1 py-2 text-sm rounded-lg transition-all ${
                    values.javaVersion === v.id
                      ? 'bg-white shadow-sm border border-primary/10 text-primary font-bold'
                      : 'bg-surface-container-low text-on-surface-variant font-medium'
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
