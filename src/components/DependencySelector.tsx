import { useState, useMemo } from 'react'
import type { DependencySelectorProps, DependencyGroup, MetadataOption } from '../types'

export function DependencySelector({
  metadata,
  selected,
  onChange,
  extensions,
  selectedOptions,
  onOptionsChange,
  compatibilityRules,
}: DependencySelectorProps) {
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

  function toggleOption(depId: string, optId: string): void {
    const current = selectedOptions[depId] ?? []
    const next = current.includes(optId)
      ? current.filter(id => id !== optId)
      : [...current, optId]
    onOptionsChange(depId, next)
  }

  const selectedDeps = allDeps.filter(d => selected.includes(d.id))

  const warnings = useMemo(() => {
    const conflicts: { source: string; target: string; desc: string }[] = []
    const requires:  { source: string; target: string; desc: string }[] = []
    const recommends:{ source: string; target: string; desc: string }[] = []
    const depName = (id: string) => allDeps.find(d => d.id === id)?.name ?? id
    for (const rule of compatibilityRules) {
      if (!selected.includes(rule.sourceDepId)) continue
      if (rule.relationType === 'CONFLICTS' && selected.includes(rule.targetDepId)) {
        conflicts.push({ source: rule.sourceDepId, target: rule.targetDepId, desc: rule.description ?? `${depName(rule.sourceDepId)} conflicts with ${depName(rule.targetDepId)}` })
      }
      if (rule.relationType === 'REQUIRES' && !selected.includes(rule.targetDepId)) {
        requires.push({ source: rule.sourceDepId, target: rule.targetDepId, desc: rule.description ?? `${depName(rule.sourceDepId)} requires ${depName(rule.targetDepId)}` })
      }
      if (rule.relationType === 'RECOMMENDS' && !selected.includes(rule.targetDepId)) {
        recommends.push({ source: rule.sourceDepId, target: rule.targetDepId, desc: rule.description ?? `${depName(rule.sourceDepId)} recommends ${depName(rule.targetDepId)}` })
      }
    }
    return { conflicts, requires, recommends }
  }, [selected, compatibilityRules, allDeps])

  return (
    <div className="grid grid-cols-2 gap-4 sticky top-24" style={{ minHeight: 'calc(100vh - 8rem)' }}>

      {/* Panel 1: Selected Dependencies */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-4 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface">Selected Dependencies</h3>
          <span className="text-xs text-secondary">{selected.length} {selected.length === 1 ? 'dependency' : 'dependencies'}</span>
        </div>
        {/* Compatibility warnings */}
        {(warnings.conflicts.length > 0 || warnings.requires.length > 0 || warnings.recommends.length > 0) && (
          <div className="space-y-1.5 mb-3">
        {warnings.conflicts.map((w, i) => (
          <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-error/30 bg-error/5 text-xs text-error">
            <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: '14px' }}>warning</span>
            <span>{w.desc}</span>
          </div>
        ))}
        {warnings.requires.map((w, i) => (
          <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-xs text-yellow-600 dark:text-yellow-400">
            <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: '14px' }}>error</span>
            <span className="flex-1">{w.desc}</span>
            <button
              type="button"
              onClick={() => onChange([...selected, w.target])}
              className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border border-yellow-500/40 hover:bg-yellow-500/10 transition-colors"
            >
              Add
            </button>
          </div>
        ))}
        {warnings.recommends.map((w, i) => (
          <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-primary/5 text-xs text-secondary">
            <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: '14px' }}>info</span>
            <span className="flex-1">{w.desc}</span>
            <button
              type="button"
              onClick={() => onChange([...selected, w.target])}
              className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border border-primary/30 hover:bg-primary/10 text-primary transition-colors"
            >
              Add
            </button>
          </div>
        ))}
          </div>
        )}

        <div className="space-y-2 flex-grow overflow-y-auto pr-1">
          {selectedDeps.length > 0 ? selectedDeps.map(dep => (
            <div
              key={dep.id}
              className="p-3 rounded-lg border bg-surface-container-high border-outline-variant hover:border-primary/40 transition-all"
            >
              <div className="flex justify-between items-start">
                <h4 className="text-sm font-bold text-on-surface">{dep.name}</h4>
                <button
                  type="button"
                  onClick={() => toggle(dep.id)}
                  className="text-on-surface-variant/40 hover:text-error transition-colors ml-2 flex-shrink-0"
                  aria-label={`Remove ${dep.name}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                </button>
              </div>
              {dep.description && (
                <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5">{dep.description}</p>
              )}
              {(extensions[dep.id]?.length ?? 0) > 0 && (
                <div className="mt-2 pt-2 border-t border-outline-variant space-y-1">
                  {extensions[dep.id].map(opt => (
                    <label key={opt.id} className="flex items-center gap-2 text-xs cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={(selectedOptions[dep.id] ?? []).includes(opt.id)}
                        onChange={() => toggleOption(dep.id, opt.id)}
                        className="accent-secondary flex-shrink-0"
                      />
                      <span className="text-on-surface-variant group-hover:text-on-surface transition-colors" title={opt.description}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )) : (
            <div className="p-6 border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-secondary mb-1" style={{ fontSize: '22px' }}>inventory_2</span>
              <p className="text-xs text-secondary italic">No dependencies selected yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Panel 2: All Available Dependencies */}
      <div className="bg-surface-container border border-outline-variant rounded-xl p-4 flex flex-col flex-grow overflow-hidden">
        <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface mb-3">All Dependencies</h3>

        {/* Search */}
        <div className="relative mb-3">
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

        {/* Grouped checkboxes — always visible, filtered by search */}
        <div className="flex-grow space-y-3 overflow-y-auto pr-1">
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
                    <div className="text-sm font-medium text-on-surface">
                      {dep.name}
                      {dep.versionRange && (
                        <span className="ml-2 text-[10px] font-medium text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">
                          Boot {dep.versionRange}
                        </span>
                      )}
                    </div>
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
        </div>
      </div>

    </div>
  )
}
