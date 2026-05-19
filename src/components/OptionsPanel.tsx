import type { OptionsPanelProps } from '../types'

export function OptionsPanel({ metadata, values, onChange, section }: OptionsPanelProps) {
  if (!metadata) return null

  const bootVersions = metadata.bootVersion?.values ?? []
  const javaVersions = metadata.javaVersion?.values ?? []
  const languages = (metadata.language?.values ?? []).filter(l => l.id !== 'kotlin')
  const packagings = metadata.packaging?.values ?? []
  const types = metadata.type?.values ?? []

  const buildTypes = types.filter(t => t.id === 'maven-project')

  function tonePillStyle(active: boolean, tone: 'azure' | 'emerald'): React.CSSProperties {
    const toneVar = tone === 'azure' ? 'var(--color-jewel-azure)' : 'var(--color-jewel-emerald)'
    if (active) {
      return {
        background: `color-mix(in srgb, ${toneVar} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${toneVar} 60%, transparent)`,
        color: toneVar,
        boxShadow: `inset 0 0 18px color-mix(in srgb, ${toneVar} 18%, transparent), 0 0 16px color-mix(in srgb, ${toneVar} 18%, transparent)`,
      }
    }
    return {}
  }

  if (section === 'upper') {
    return (
      <div className="space-y-6">
        {/* Project Build + Language side by side as tone-pill buttons */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="label-runic-sm text-primary flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>build</span>
              Project Build
            </span>
            <div className="flex flex-col gap-2">
              {buildTypes.map(t => {
                const active = values.type === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChange({ type: t.id })}
                    className="cut-corners flex items-center justify-center gap-2 px-4 py-3 text-sm border bg-surface-container/40 border-outline-variant hover:border-outline transition-colors"
                    style={tonePillStyle(active, 'azure')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      {t.id.includes('maven') ? 'add_circle' : 'build'}
                    </span>
                    {t.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="label-runic-sm text-primary flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>code</span>
              Language
            </span>
            <div className="flex flex-col gap-2">
              {languages.map(l => {
                const active = values.language === l.id
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onChange({ language: l.id })}
                    className="cut-corners flex items-center justify-center gap-2 px-4 py-3 text-sm border bg-surface-container/40 border-outline-variant hover:border-outline transition-colors"
                    style={tonePillStyle(active, 'emerald')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      {l.id === 'java' ? 'terminal' : l.id === 'kotlin' ? 'integration_instructions' : 'data_object'}
                    </span>
                    {l.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Spring Boot Version */}
        <div className="space-y-2">
          <span className="label-runic-sm text-primary flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>flag</span>
            Spring Boot Version
          </span>
          <select
            value={values.bootVersion}
            onChange={e => onChange({ bootVersion: e.target.value })}
            className="w-full bg-surface-container/40 border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='%238fa6cf' d='M6 8L0 0h12z'/></svg>")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 1rem center',
              paddingRight: '2.5rem',
            }}
          >
            {bootVersions.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  if (section === 'lower') {
    return (
      <div className="grid grid-cols-2 gap-4 pt-4">
        <div className="space-y-2">
          <span className="label-runic-sm text-primary flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>code_blocks</span>
            Java Version
          </span>
          <select
            value={values.javaVersion}
            onChange={e => onChange({ javaVersion: e.target.value })}
            className="w-full bg-surface-container/40 border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='%238fa6cf' d='M6 8L0 0h12z'/></svg>")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 1rem center',
              paddingRight: '2.5rem',
            }}
          >
            {javaVersions.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <span className="label-runic-sm text-primary flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>package_2</span>
            Packaging
          </span>
          <select
            value={values.packaging}
            onChange={e => onChange({ packaging: e.target.value })}
            className="w-full bg-surface-container/40 border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='%238fa6cf' d='M6 8L0 0h12z'/></svg>")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 1rem center',
              paddingRight: '2.5rem',
            }}
          >
            {packagings.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  return null
}
