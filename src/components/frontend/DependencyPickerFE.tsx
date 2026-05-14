import { useMemo, useState } from 'react'
import { DESIGN_GROUP_NAME, type FrontendMetadata, type FeDependency } from '../../hooks/useFrontendMetadata'

interface Props {
  metadata: FrontendMetadata
  selectedDeps: string[]
  selectedOptions: Record<string, string[]>
  onToggleDep: (depId: string) => void
  onToggleOption: (depId: string, optionId: string) => void
}

export function DependencyPickerFE({
  metadata,
  selectedDeps,
  selectedOptions,
  onToggleDep,
  onToggleOption,
}: Props) {
  const [query, setQuery] = useState('')

  const filteredGroups = useMemo(() => {
    // The Design System group is rendered as a dedicated picker in OptionsPanelFE.
    const groups = metadata.dependencies.filter(g => g.name !== DESIGN_GROUP_NAME)
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map(g => ({
        ...g,
        entries: g.entries.filter(
          e =>
            e.id.toLowerCase().includes(q) ||
            e.name.toLowerCase().includes(q) ||
            (e.description ?? '').toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.entries.length > 0)
  }, [metadata.dependencies, query])

  const visibleSelectedDeps = useMemo(
    () => selectedDeps.filter(id => !id.startsWith('design-')),
    [selectedDeps]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>
            extension
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface">
            Dependencies
          </span>
          {visibleSelectedDeps.length > 0 && (
            <span className="text-[11px] text-secondary">({visibleSelectedDeps.length} selected)</span>
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter…"
          className="w-40 bg-surface-container-high border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      {/* Selected chips */}
      {visibleSelectedDeps.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-2 border-b border-outline-variant">
          {visibleSelectedDeps.map(id => {
            const dep = findDep(metadata, id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => onToggleDep(id)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] hover:bg-primary/20 transition-colors"
                title="Click to remove"
              >
                {dep?.name ?? id}
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                  close
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Grouped list */}
      <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
        {filteredGroups.map(group => (
          <div key={group.name}>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              {group.name}
            </h3>
            <div className="space-y-1.5">
              {group.entries.map(dep => {
                const checked = selectedDeps.includes(dep.id)
                const opts = selectedOptions[dep.id] ?? []
                return (
                  <div
                    key={dep.id}
                    className={`rounded-xl border transition-all ${
                      checked
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-outline-variant bg-surface-container-high hover:border-outline'
                    }`}
                  >
                    <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleDep(dep.id)}
                        className="mt-0.5 accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-on-surface">{dep.name}</div>
                        {dep.description && (
                          <div className="text-[11px] text-secondary mt-0.5">{dep.description}</div>
                        )}
                      </div>
                    </label>
                    {checked && dep.subOptions && dep.subOptions.length > 0 && (
                      <div className="px-3 pb-3 pl-9 space-y-1">
                        {dep.subOptions.map(o => (
                          <label
                            key={o.id}
                            className="flex items-start gap-2 text-[12px] text-on-surface-variant cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={opts.includes(o.id)}
                              onChange={() => onToggleOption(dep.id, o.id)}
                              className="mt-0.5 accent-primary"
                            />
                            <span>
                              <span className="font-medium text-on-surface">{o.label}</span>
                              {o.description && (
                                <span className="block text-[11px] text-secondary">
                                  {o.description}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function findDep(metadata: FrontendMetadata, id: string): FeDependency | undefined {
  for (const g of metadata.dependencies) {
    for (const e of g.entries) {
      if (e.id === id) return e
    }
  }
  return undefined
}
