import { useMemo, useState } from 'react'
import type { DependencyGroup } from '../../types'
import { useMetadata } from '../../hooks/useMetadata'

interface Props {
  selected: string[]
  defaults: string[]
  onChange: (next: string[]) => void
}

/**
 * Lightweight dep picker for the Fullstack wizard. Deliberately separate from
 * DependencySelector — that one bundles SQL/OpenAPI/SOAP wizard drawers which
 * don't apply here.
 *
 * Defaults are pre-checked but everything is uncheckable — the user has the final
 * say. Admin controls the defaults per template set.
 */
export function FullstackDepPicker({ selected, defaults, onChange }: Props) {
  const { metadata, loading, error } = useMetadata()
  const [query, setQuery] = useState('')

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const defaultsSet = useMemo(() => new Set(defaults), [defaults])

  const groups: DependencyGroup[] = metadata?.dependencies?.values ?? []
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map(g => ({
        ...g,
        values: g.values.filter(v =>
          v.id.toLowerCase().includes(q) ||
          v.name.toLowerCase().includes(q) ||
          (v.description ?? '').toLowerCase().includes(q)),
      }))
      .filter(g => g.values.length > 0)
  }, [groups, query])

  function toggle(depId: string, checked: boolean) {
    if (checked) {
      if (selectedSet.has(depId)) return
      onChange([...selected, depId])
    } else {
      onChange(selected.filter(d => d !== depId))
    }
  }

  function resetToDefaults() {
    onChange([...defaults])
  }

  if (loading) {
    return <div className="text-sm text-secondary">Loading dependency catalog…</div>
  }
  if (error) {
    return (
      <div className="text-sm text-error border border-error/30 bg-error/10 rounded px-3 py-2">
        Failed to load metadata: {error}
      </div>
    )
  }

  return (
    <div className="space-y-3 lg:flex lg:flex-col lg:flex-1 lg:min-h-0">
      <div className="flex items-center justify-between gap-3">
        <input
          type="text"
          placeholder="Filter dependencies…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 max-w-sm bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
        <button
          type="button"
          onClick={resetToDefaults}
          className="text-xs px-3 py-1.5 rounded-lg border border-outline-variant text-secondary hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      <p className="text-[11px] text-on-surface-variant">
        Pre-checked items come from the chosen backend set's admin-configured
        defaults. You can check or uncheck anything — the generator respects your
        final selection.
      </p>

      <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2 lg:max-h-none lg:flex-1 lg:min-h-0">
        {filteredGroups.map(group => (
          <div key={group.name} className="border border-outline-variant rounded-lg bg-surface-container-low">
            <div className="px-4 py-2 border-b border-outline-variant text-[11px] font-bold uppercase tracking-widest text-secondary">
              {group.name}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 p-2">
              {group.values.map(dep => {
                const isSelected = selectedSet.has(dep.id)
                const isDefault = defaultsSet.has(dep.id)
                return (
                  <label
                    key={dep.id}
                    className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-primary/5 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={isSelected}
                      onChange={e => toggle(dep.id, e.target.checked)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-on-surface">{dep.name}</span>
                        {isDefault && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                            default
                          </span>
                        )}
                        {dep.versionRange && (
                          <span className="text-[9px] font-bold text-secondary bg-surface-container px-1.5 py-0.5 rounded-full border border-outline-variant/50">
                            Boot {dep.versionRange}
                          </span>
                        )}
                      </div>
                      {dep.description && (
                        <div className="text-[11px] text-secondary truncate">{dep.description}</div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
        {filteredGroups.length === 0 && (
          <div className="text-sm text-secondary text-center py-6">No dependencies match "{query}"</div>
        )}
      </div>
    </div>
  )
}
