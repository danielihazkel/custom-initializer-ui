function PillGroup({ options, value, onChange }) {
  return (
    <div className="pill-group">
      {options.map(opt => (
        <button
          key={opt.id}
          type="button"
          className={`pill ${value === opt.id ? 'active' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.name}
        </button>
      ))}
    </div>
  )
}

export function OptionsPanel({ metadata, values, onChange }) {
  if (!metadata) return null

  const bootVersions = metadata.bootVersion?.values ?? []
  const javaVersions = metadata.javaVersion?.values ?? []
  const languages = metadata.language?.values ?? []
  const packagings = metadata.packaging?.values ?? []
  const types = metadata.type?.values ?? []

  const buildTypes = types.filter(t => ['maven-project', 'gradle-project'].includes(t.id))

  return (
    <section className="form-section">
      <h2>Options</h2>
      <div className="options-grid">

        <div className="option-row">
          <span className="option-label">Spring Boot</span>
          <select value={values.bootVersion} onChange={e => onChange({ bootVersion: e.target.value })}>
            {bootVersions.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        <div className="option-row">
          <span className="option-label">Language</span>
          <PillGroup
            options={languages}
            value={values.language}
            onChange={val => onChange({ language: val })}
          />
        </div>

        <div className="option-row">
          <span className="option-label">Build</span>
          <PillGroup
            options={buildTypes}
            value={values.type}
            onChange={val => onChange({ type: val })}
          />
        </div>

        <div className="option-row">
          <span className="option-label">Packaging</span>
          <PillGroup
            options={packagings}
            value={values.packaging}
            onChange={val => onChange({ packaging: val })}
          />
        </div>

        <div className="option-row">
          <span className="option-label">Java</span>
          <select value={values.javaVersion} onChange={e => onChange({ javaVersion: e.target.value })}>
            {javaVersions.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

      </div>
    </section>
  )
}
