import { useMemo, useState } from 'react'
import type { CompatibilityRule, DependencyGroup } from '../../types'
import { useMetadata } from '../../hooks/useMetadata'
import { useDependencyCompatibility } from '../../hooks/useDependencyCompatibility'
import { SuggestionStrip } from '../SuggestionStrip'
import { useStarterTemplates } from '../../hooks/useStarterTemplates'

interface Props {
  selected: string[]
  defaults: string[]
  onChange: (next: string[]) => void
  /** REQUIRES / CONFLICTS / RECOMMENDS rules for BACKEND deps — rendered as banners above the
   *  selection (same semantics as the Backend and Frontend tabs via useDependencyCompatibility). */
  compatibilityRules?: CompatibilityRule[]
}

const NO_RULES: CompatibilityRule[] = []

/**
 * Lightweight dep picker for the Fullstack wizard. Deliberately separate from
 * DependencySelector — that one bundles SQL/OpenAPI/SOAP wizard drawers which
 * don't apply here.
 *
 * Defaults are pre-checked but everything is uncheckable — the user has the final
 * say. Admin controls the defaults per template set.
 */
export function FullstackDepPicker({ selected, defaults, onChange, compatibilityRules = NO_RULES }: Props) {
  const { metadata, loading, error } = useMetadata()
  // The same curated bundles the Backend tab offers as Quick Start cards. Here they are just
  // additive shortcuts: a bundle adds its deps to the selection, it never replaces it, because
  // the template set's own defaults are already checked and are not the user's to lose.
  const { templates: bundles } = useStarterTemplates('BACKEND')
  const [query, setQuery] = useState('')

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const defaultsSet = useMemo(() => new Set(defaults), [defaults])

  const groups: DependencyGroup[] = metadata?.dependencies?.values ?? []
  const allDeps = useMemo(
    () => groups.flatMap(g => g.values.map(v => ({ id: v.id, name: v.name }))),
    [groups],
  )
  const { conflicts, requires, suggestions } = useDependencyCompatibility(compatibilityRules, selected, allDeps)

  // id -> human-readable name, so the selected-chips tray can show names instead of
  // raw ids. Falls back to the id itself for any selected dep not in the catalog
  // (e.g. one filtered out by the current Boot version) — it still shows + removes.
  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groups) for (const v of g.values) m.set(v.id, v.name)
    return m
  }, [groups])
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
  /** Adds every dep in a bundle that is not already selected. */
  function addBundle(depIds: string[]) {
    const missing = depIds.filter(id => !selectedSet.has(id))
    if (missing.length > 0) onChange([...selected, ...missing])
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
      {bundles.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap" data-dep-bundles>
          <span className="text-[11px] text-secondary shrink-0">Add a bundle:</span>
          {bundles.map(bundle => {
            const depIds = bundle.dependencies.map(d => d.depId)
            const already = depIds.length > 0 && depIds.every(id => selectedSet.has(id))
            return (
              <button
                key={bundle.id}
                type="button"
                onClick={() => addBundle(depIds)}
                disabled={already}
                title={already
                  ? `Already selected: ${depIds.join(', ')}`
                  : `${bundle.description || bundle.name} \u2014 adds ${depIds.join(', ')}`}
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full border border-outline-variant text-[11px] text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:hover:border-outline-variant disabled:hover:text-secondary"
              >
                {bundle.icon && <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{bundle.icon}</span>}
                {bundle.name}
                {already
                  ? <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check</span>
                  : <span className="text-secondary/60">+{depIds.filter(id => !selectedSet.has(id)).length}</span>}
              </button>
            )
          })}
        </div>
      )}

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
          title="Reset only the dependency selection to this set's defaults"
        >
          Reset dependencies
        </button>
      </div>

      {(conflicts.length > 0 || requires.length > 0) && (
        <div className="space-y-2">
          {conflicts.map((w, i) => (
            <div key={`conflict-${i}`} role="alert" className="flex items-start gap-2 text-xs rounded-lg border border-error/30 bg-error/10 text-on-surface p-2.5">
              <span className="material-symbols-outlined text-error mt-0.5" style={{ fontSize: '16px' }}>error</span>
              <span className="flex-1">
                <span className="font-semibold">{nameById.get(w.source) ?? w.source}</span> conflicts with{' '}
                <span className="font-semibold">{nameById.get(w.target) ?? w.target}</span>
                <span className="block text-on-surface-variant mt-0.5">{w.desc}</span>
              </span>
              <button type="button" onClick={() => toggle(w.target, false)} className="text-error font-semibold hover:underline shrink-0">
                Remove {nameById.get(w.target) ?? w.target}
              </button>
            </div>
          ))}
          {requires.map((w, i) => (
            <div key={`require-${i}`} role="alert" className="flex items-start gap-2 text-xs rounded-lg border border-warning/30 bg-warning/10 text-on-surface p-2.5">
              <span className="material-symbols-outlined text-warning mt-0.5" style={{ fontSize: '16px' }}>info</span>
              <span className="flex-1">
                <span className="font-semibold">{nameById.get(w.source) ?? w.source}</span> requires{' '}
                <span className="font-semibold">{nameById.get(w.target) ?? w.target}</span>
                <span className="block text-on-surface-variant mt-0.5">{w.desc}</span>
              </span>
              <button type="button" onClick={() => toggle(w.target, true)} className="text-warning font-semibold hover:underline shrink-0">
                Add {nameById.get(w.target) ?? w.target}
              </button>
            </div>
          ))}
        </div>
      )}
      <SuggestionStrip suggestions={suggestions} onAdd={id => toggle(id, true)} />

      {/* Pinned selection tray — always visible above the scrolling catalog so the
          user can see (and remove) what's selected without scrolling. */}
      <div className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2">
        <div className="text-[11px] font-bold uppercase tracking-widest text-secondary mb-2">
          Selected ({selected.length})
        </div>
        {selected.length === 0 ? (
          <p className="text-[11px] text-on-surface-variant">No dependencies selected yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto pr-1" aria-live="polite">
            {selected.map(id => {
              const name = nameById.get(id) ?? id
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
                >
                  <span className="truncate max-w-[12rem]" title={name}>{name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => toggle(id, false)}
                    className="flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>

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
                      className="mt-0.5 h-4 w-4 accent-primary"
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
