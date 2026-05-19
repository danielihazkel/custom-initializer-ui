import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DependencyGroup, MetadataOption, InitializrMetadata, CompatibilityRule } from '../types'
import { SuggestionStrip } from './SuggestionStrip'
import { useDependencyCompatibility } from '../hooks/useDependencyCompatibility'

interface DependencyExplorerProps {
  metadata: InitializrMetadata | null
  selected: string[]
  onChange: (selected: string[]) => void
  compatibilityRules: CompatibilityRule[]
  compact?: boolean
}

export function DependencySelector({
  metadata,
  selected,
  onChange,
  compatibilityRules,
  compact = false,
}: DependencyExplorerProps) {
  const [search, setSearch] = useState<string>('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = useCallback((name: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const isCollapsed = (name: string) => !search.trim() && collapsedGroups.has(name)

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

  const { suggestions } = useDependencyCompatibility(
    compatibilityRules, selected, allDeps,
  )

  return (
    <div
      className={`glass-panel p-6 flex flex-col overflow-hidden text-on-surface ${compact ? '' : 'sticky top-20'}`}
      style={{ height: compact ? 'auto' : 'calc(100vh - 12rem)', maxHeight: compact ? '560px' : undefined }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-outline-variant/50">
        <h3 className="label-runic-sm text-primary flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>explore</span>
          Explore Dependencies
        </h3>
      </div>

      <SuggestionStrip
        suggestions={suggestions}
        onAdd={(depId) => onChange([...selected, depId])}
      />

      {/* Search */}
      <div className="relative mb-6 group">
        <span
          className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary transition-transform group-focus-within:scale-110"
          style={{ fontSize: '20px' }}
        >
          search
        </span>
        <input
          type="search"
          className="w-full bg-surface-container-highest border border-outline-variant rounded-xl pl-12 pr-12 py-3.5 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all placeholder-secondary/70 shadow-inner"
          placeholder="Search Web, Security, JPA..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-outline-variant text-[10px] font-bold text-secondary bg-surface-container">
          /
        </div>
      </div>

      {/* Grouped checkboxes */}
      <div className="flex-grow space-y-6 overflow-y-auto pr-2 tutorial-scroll pb-20">
        <AnimatePresence>
          {filtered.map(group => {
            const collapsed = isCollapsed(group.name)
            const selectedCount = group.values.filter(d => selected.includes(d.id)).length
            const gridId = `dep-group-${group.name.replace(/\s+/g, '-').toLowerCase()}`
            return (
              <motion.div
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                key={group.name}
                className="space-y-3"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.name)}
                  aria-expanded={!collapsed}
                  aria-controls={gridId}
                  className="w-full flex items-center gap-3 cursor-pointer group/header"
                >
                  <div className="h-px flex-1 bg-outline-variant/50"></div>
                  <div className="flex items-center gap-1.5 label-runic-sm text-primary px-2 py-1 bg-surface-container-lowest rounded-full border border-outline-variant/30 group-hover/header:border-primary/50 transition-colors">
                    <span
                      className={`material-symbols-outlined transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`}
                      style={{ fontSize: '14px' }}
                    >
                      expand_more
                    </span>
                    {group.name}
                    {selectedCount > 0 && (
                      <span className="ml-1 px-1.5 py-px rounded-full bg-primary/15 text-primary text-[9px] font-bold">
                        {selectedCount}
                      </span>
                    )}
                  </div>
                  <div className="h-px flex-1 bg-outline-variant/50"></div>
                </button>
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.div
                      key="grid"
                      id={gridId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="grid gap-2">
                        {group.values.map(dep => {
                          const isSelected = selected.includes(dep.id)
                          return (
                            <motion.label
                              layout
                              key={dep.id}
                              className={`flex items-start gap-4 p-4 rounded-xl border relative cursor-pointer overflow-hidden group transition-all duration-300
                      ${isSelected
                                  ? 'border-primary bg-primary/10 shadow-[0_4px_20px_rgba(139,92,246,0.1)]'
                                  : 'border-outline-variant bg-surface-container-high hover:border-primary/50 hover:bg-surface-container-highest'}`}
                            >
                              {isSelected && (
                                <motion.div layoutId="active-indicator" className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                              )}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggle(dep.id)}
                                className="sr-only"
                              />
                              <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all duration-300
                      ${isSelected
                                  ? 'bg-primary border-primary text-white shadow-[0_0_10px_rgba(139,92,246,0.5)]'
                                  : 'bg-surface-container-lowest border-secondary/40 group-hover:border-primary/50'}`}>
                                {isSelected && <span className="material-symbols-outlined font-bold" style={{ fontSize: '14px' }}>check</span>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-on-surface flex items-center flex-wrap gap-2">
                                  {dep.name}
                                  {dep.versionRange && (
                                    <span className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/30">
                                      Boot {dep.versionRange}
                                    </span>
                                  )}
                                </div>
                                {dep.description && (
                                  <div className="text-xs text-on-surface-variant leading-relaxed mt-1">{dep.description}</div>
                                )}
                              </div>
                            </motion.label>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {filtered.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-outlined text-secondary opacity-30 mb-3" style={{ fontSize: '48px' }}>search_off</span>
            <p className="text-sm font-medium text-on-surface">No results found</p>
            <p className="text-xs text-secondary mt-1 max-w-[200px]">We couldn't find any dependencies matching &ldquo;{search}&rdquo;</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
