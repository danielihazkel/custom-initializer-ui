import { useState, useMemo } from 'react'

export function DependencySelector({ metadata, selected, onChange }) {
  const [search, setSearch] = useState('')

  const groups = useMemo(() => {
    if (!metadata?.dependencies?.values) return []
    return metadata.dependencies.values
  }, [metadata])

  const allDeps = useMemo(() => groups.flatMap(g => g.values ?? []), [groups])

  const filtered = useMemo(() => {
    if (!search.trim()) return groups
    const q = search.toLowerCase()
    return groups
      .map(group => ({
        ...group,
        values: (group.values ?? []).filter(
          d => d.name.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q)
        )
      }))
      .filter(g => g.values.length > 0)
  }, [groups, search])

  function toggle(depId) {
    if (selected.includes(depId)) {
      onChange(selected.filter(id => id !== depId))
    } else {
      onChange([...selected, depId])
    }
  }

  const selectedDeps = allDeps.filter(d => selected.includes(d.id))

  return (
    <section className="dep-section">
      <h2>Dependencies</h2>

      {selectedDeps.length > 0 && (
        <div className="chips">
          {selectedDeps.map(d => (
            <span key={d.id} className="chip">
              {d.name}
              <button type="button" className="chip-remove" onClick={() => toggle(d.id)} aria-label={`Remove ${d.name}`}>×</button>
            </span>
          ))}
        </div>
      )}

      <input
        type="search"
        className="dep-search"
        placeholder="Search dependencies…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="dep-list">
        {filtered.map(group => (
          <div key={group.name} className="dep-group">
            <div className="dep-group-header">
              <span className="dep-group-name">{group.name}</span>
              <span className="dep-group-count">{group.values.length}</span>
            </div>
            {group.values.map(dep => (
              <label key={dep.id} className="dep-item">
                <input
                  type="checkbox"
                  checked={selected.includes(dep.id)}
                  onChange={() => toggle(dep.id)}
                />
                <div className="dep-info">
                  <span className="dep-name">{dep.name}</span>
                  {dep.description && <span className="dep-desc">{dep.description}</span>}
                </div>
              </label>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="dep-empty">No dependencies match "{search}"</p>
        )}
      </div>
    </section>
  )
}
