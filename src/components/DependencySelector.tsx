import { useState, useMemo } from 'react'
import type { DependencySelectorProps, DependencyGroup, MetadataOption } from '../types'

export function DependencySelector({ metadata, selected, onChange }: DependencySelectorProps) {
  const [search, setSearch] = useState<string>('')

  const groups = useMemo<DependencyGroup[]>(() => {
    if (!metadata?.dependencies?.values) return []
    return metadata.dependencies.values
  }, [metadata])

  const allDeps = useMemo<MetadataOption[]>(() => groups.flatMap(g => g.values ?? []), [groups])

  const filtered = useMemo<DependencyGroup[]>(() => {
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

  function toggle(depId: string): void {
    if (selected.includes(depId)) {
      onChange(selected.filter(id => id !== depId))
    } else {
      onChange([...selected, depId])
    }
  }

  const selectedDeps = allDeps.filter(d => selected.includes(d.id))
  const isSearching = search.trim().length > 0

  return (
    <div className="bg-surface-container border border-outline-variant rounded-xl p-6 flex flex-col sticky top-24" style={{ minHeight: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">Dependencies</h3>
        <button className="text-xs font-bold text-primary hover:underline transition-all">
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
          className="w-full bg-background border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
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
                        : 'border-outline-variant bg-surface-container-low hover:border-primary/30'
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
                        <div className="text-xs text-on-surface-variant leading-relaxed mt-0.5">{dep.description}</div>
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
                className="p-4 rounded-xl border bg-surface-container-high border-outline-variant hover:border-primary/40 transition-all"
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className="text-sm font-bold text-on-surface">{dep.name}</h4>
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
            <div className="p-8 border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-secondary mb-2" style={{ fontSize: '28px' }}>inventory_2</span>
              <p className="text-xs text-secondary italic">
                Search and select dependencies to add to your project.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-6 border-t border-outline-variant text-[10px] text-secondary uppercase tracking-tighter flex justify-between">
        <span>{selected.length} {selected.length === 1 ? 'Dependency' : 'Dependencies'} Selected</span>
        <span className="text-tertiary">All stable versions</span>
      </div>
    </div>
  )
}
