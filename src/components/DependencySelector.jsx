import { useState, useMemo } from 'react'

export function DependencySelector({ metadata, selected, onChange, isDark }) {
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
  const isSearching = search.trim().length > 0

  const panelClass = isDark
    ? 'bg-surface-container border border-outline-variant rounded-xl p-6 flex flex-col'
    : 'glass-card rounded-2xl p-6 flex flex-col'

  const searchInputClass = isDark
    ? 'w-full bg-background border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all'
    : 'w-full bg-surface-container-low border-0 rounded-lg pl-10 pr-4 py-2.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all'

  return (
    <div className={`${panelClass} sticky top-24`} style={{ minHeight: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        {isDark ? (
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">Dependencies</h3>
        ) : (
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Dependencies</h3>
            <p className="text-2xl font-bold tracking-tight text-on-surface">Project Stack</p>
          </div>
        )}
        <button className={`text-xs font-bold transition-all ${
          isDark
            ? 'text-primary hover:underline'
            : 'flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full hover:bg-primary/20'
        }`}>
          {!isDark && <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>}
          Add Dependencies
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <span
          className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
          style={{ fontSize: '18px' }}
        >
          search
        </span>
        <input
          type="search"
          className={searchInputClass}
          placeholder="Search dependencies (e.g. Web, Security, JPA)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      <div className="flex-grow space-y-3 overflow-y-auto pr-1">
        {isSearching ? (
          <>
            {filtered.map(group => (
              <div key={group.name} className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-secondary px-1 py-1">
                  {group.name}
                </div>
                {group.values.map(dep => (
                  <label
                    key={dep.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected.includes(dep.id)
                        ? 'border-primary/40 bg-primary/5'
                        : isDark
                          ? 'border-outline-variant bg-surface-container-low hover:border-primary/30'
                          : 'border-outline-variant/20 bg-surface-container-lowest hover:border-primary/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(dep.id)}
                      onChange={() => toggle(dep.id)}
                      className="mt-0.5 accent-primary flex-shrink-0"
                    />
                    <div>
                      <div className="text-sm font-medium text-on-surface">{dep.name}</div>
                      {dep.description && (
                        <div className="text-xs text-secondary-fixed leading-relaxed mt-0.5">{dep.description}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-secondary italic text-center py-8">
                No dependencies match &ldquo;{search}&rdquo;
              </p>
            )}
          </>
        ) : (
          <>
            {selectedDeps.map(dep => (
              <div
                key={dep.id}
                className={`p-4 rounded-xl border transition-all ${
                  isDark
                    ? 'bg-surface-container-high border-outline-variant hover:border-primary/40'
                    : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/30'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`text-sm font-bold ${isDark ? 'text-on-surface' : 'text-primary'}`}>
                    {dep.name}
                  </h4>
                  <button
                    type="button"
                    onClick={() => toggle(dep.id)}
                    className="text-on-surface-variant/40 hover:text-error transition-colors ml-2 flex-shrink-0"
                    aria-label={`Remove ${dep.name}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                  </button>
                </div>
                {dep.description && (
                  <p className="text-xs text-on-surface-variant leading-relaxed">{dep.description}</p>
                )}
              </div>
            ))}
            {/* Empty state */}
            <div className={`p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center ${
              isDark ? 'border-outline-variant' : 'border-outline-variant/20 opacity-40'
            }`}>
              <span className="material-symbols-outlined text-secondary mb-2" style={{ fontSize: '28px' }}>
                {isDark ? 'inventory_2' : 'layers'}
              </span>
              <p className="text-xs text-secondary italic">
                {isDark
                  ? 'Search and select dependencies to add to your project.'
                  : 'Add more dependencies to customize your stack.'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {isDark ? (
        <div className="mt-6 pt-6 border-t border-outline-variant text-[10px] text-secondary uppercase tracking-tighter flex justify-between">
          <span>{selected.length} {selected.length === 1 ? 'Dependency' : 'Dependencies'} Selected</span>
          <span className="text-tertiary">All stable versions</span>
        </div>
      ) : (
        <div className="mt-6 pt-6 border-t border-outline-variant/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '22px' }}>auto_awesome</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                {selected.length} {selected.length === 1 ? 'Dependency' : 'Dependencies'} Selected
              </p>
              <p className="text-xs text-on-surface-variant/70 mt-0.5">
                Press <kbd className="px-1.5 py-0.5 bg-surface-container-high rounded text-[10px]">Ctrl + B</kbd> to explore the project structure.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
