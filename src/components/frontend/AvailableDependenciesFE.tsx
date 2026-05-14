import { useCallback, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DESIGN_GROUP_NAME, type FrontendMetadata, type FeGroup } from '../../hooks/useFrontendMetadata'

interface Props {
  metadata: FrontendMetadata
  selectedDeps: string[]
  onToggleDep: (depId: string) => void
}

export function AvailableDependenciesFE({ metadata, selectedDeps, onToggleDep }: Props) {
  const [search, setSearch] = useState('')
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

  const filtered = useMemo<FeGroup[]>(() => {
    const groups = metadata.dependencies.filter(g => g.name !== DESIGN_GROUP_NAME)
    const q = search.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map(g => ({
        ...g,
        entries: g.entries.filter(
          e =>
            e.id.toLowerCase().includes(q) ||
            e.name.toLowerCase().includes(q) ||
            (e.description ?? '').toLowerCase().includes(q),
        ),
      }))
      .filter(g => g.entries.length > 0)
  }, [metadata.dependencies, search])

  return (
    <div className="flex flex-col h-full text-on-surface">
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-outline-variant/50">
        <span className="material-symbols-outlined text-tertiary" style={{ fontSize: '20px' }}>
          explore
        </span>
        <h3 className="text-xs font-bold uppercase tracking-widest">Explore Dependencies</h3>
      </div>

      <div className="relative mb-5 group">
        <span
          className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary transition-transform group-focus-within:scale-110"
          style={{ fontSize: '20px' }}
        >
          search
        </span>
        <input
          type="search"
          className="w-full bg-surface-container-highest border border-outline-variant rounded-xl pl-12 pr-12 py-3 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all placeholder-secondary/70 shadow-inner"
          placeholder="Search router, state, query…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-outline-variant text-[10px] font-bold text-secondary bg-surface-container">
          /
        </div>
      </div>

      <div className="flex-grow space-y-6 overflow-y-auto pr-2 pb-4 max-h-[60vh]">
        <AnimatePresence>
          {filtered.map(group => {
            const collapsed = isCollapsed(group.name)
            const selectedCount = group.entries.filter(d => selectedDeps.includes(d.id)).length
            const gridId = `fe-dep-group-${group.name.replace(/\s+/g, '-').toLowerCase()}`
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
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-secondary px-2 py-1 bg-surface-container-lowest rounded-full border border-outline-variant/30 group-hover/header:border-primary/50 group-hover/header:text-on-surface transition-colors">
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
                        {group.entries.map(dep => {
                          const isSelected = selectedDeps.includes(dep.id)
                          return (
                            <motion.label
                              layout
                              key={dep.id}
                              className={`flex items-start gap-4 p-4 rounded-xl border relative cursor-pointer overflow-hidden group transition-all duration-300 ${
                                isSelected
                                  ? 'border-primary bg-primary/10 shadow-[0_4px_20px_rgba(139,92,246,0.1)]'
                                  : 'border-outline-variant bg-surface-container-high hover:border-primary/50 hover:bg-surface-container-highest'
                              }`}
                            >
                              {isSelected && (
                                <motion.div layoutId={`fe-active-${dep.id}`} className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                              )}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => onToggleDep(dep.id)}
                                className="sr-only"
                              />
                              <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all duration-300 ${
                                isSelected
                                  ? 'bg-primary border-primary text-white shadow-[0_0_10px_rgba(139,92,246,0.5)]'
                                  : 'bg-surface-container-lowest border-secondary/40 group-hover:border-primary/50'
                              }`}>
                                {isSelected && (
                                  <span className="material-symbols-outlined font-bold" style={{ fontSize: '14px' }}>check</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-on-surface">{dep.name}</div>
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <span className="material-symbols-outlined text-secondary opacity-30 mb-3" style={{ fontSize: '48px' }}>
              search_off
            </span>
            <p className="text-sm font-medium text-on-surface">No results found</p>
            <p className="text-xs text-secondary mt-1 max-w-[200px]">
              We couldn&rsquo;t find any dependencies matching &ldquo;{search}&rdquo;
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
